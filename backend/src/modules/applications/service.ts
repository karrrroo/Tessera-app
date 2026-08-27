import { randomUUID } from "node:crypto";
import { ApiError, CONFLICT, NOT_FOUND, RATE_LIMITED } from "../../http/errors.js";
import { env } from "../../lib/env.js";
import { storage } from "../../lib/storage.js";
import * as repo from "./repo.js";
import { checkAndRecord } from "./rate-limit.js";
import { signTranscriptKey, verifyTranscriptKey } from "./transcript-key.js";
import { MAIN_SCHOOL, type ApplicationCreateInput } from "./validation.js";

const APPLICATIONS_CLOSED = () => new ApiError(403, "APPLICATIONS_CLOSED");
const APPLICATIONS_NOT_PROVISIONED = () => new ApiError(503, "APPLICATIONS_NOT_PROVISIONED");
const APPLICATION_SCHOOL_NOT_ACCEPTING = () => new ApiError(422, "APPLICATION_SCHOOL_NOT_ACCEPTING");
const APPLICATION_DUPLICATE_PENDING = () => new ApiError(409, "APPLICATION_DUPLICATE_PENDING");
const APPLICATION_TRANSCRIPT_MISSING = () => new ApiError(404, "APPLICATION_TRANSCRIPT_MISSING");
const APPLICATION_LINK_INVALID = () => new ApiError(403, "APPLICATION_LINK_INVALID");

/** B6: an applicant's own view never includes the transcript key. */
export type PublicApplicationReceipt = { id: string; submittedAt: string };

export type AdminApplication = Omit<repo.ApplicationRow, "transcriptKey"> & {
  /** A short-lived signed token, or null when there is no transcript. */
  transcriptToken: string | null;
};

/**
 * B6: "The transcript is never logged, never in an error payload, never
 * reachable without a signed key." The storage key never leaves this module —
 * every row that goes to a client is passed through here first, and it drops
 * `transcriptKey` and substitutes a token that expires.
 */
function toAdminView(row: repo.ApplicationRow): AdminApplication {
  const { transcriptKey, ...rest } = row;
  return { ...rest, transcriptToken: transcriptKey ? signTranscriptKey(row.id) : null };
}

/**
 * Turns "the `application` table does not exist" into a clean, specific 503
 * instead of a 500.
 *
 * This matters for shipping, not just for tidiness. Schema changes on this
 * project are applied by hand (C2), so there is a real window in which the
 * code is deployed and the table is not yet there — and during that window the
 * admin dashboard links to a queue that would otherwise answer with an opaque
 * INTERNAL error and no indication of why. Postgres reports an unknown
 * relation as 42P01; that is a deployment state, not a fault, and the UI can
 * say so plainly.
 *
 * Self-healing: nothing is cached, so the moment the table exists every one of
 * these calls starts working with no restart.
 */
async function guardTable<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isUndefinedTable(err)) throw APPLICATIONS_NOT_PROVISIONED();
    throw err;
  }
}

function isUndefinedTable(err: unknown): boolean {
  // 42P01 = undefined_table. Checked on the error and on its cause, because
  // the driver error can arrive wrapped — the same wrapped-error trap that
  // once made a Postgres constraint violation look like a generic 500.
  const code = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e ? (e as { code?: unknown }).code : undefined;
  if (code(err) === "42P01") return true;
  const cause = typeof err === "object" && err !== null && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  return code(cause) === "42P01";
}

/**
 * "Open" means the flag is set AND there is a table to write to.
 *
 * The flag alone was not enough: with `APPLICATIONS_OPEN=true` and no
 * `application` table, the login screen showed the link and `/apply` rendered
 * the full form, and every submission failed at the insert. That is exactly
 * what B2 forbids — a form that takes a child's details and drops them is
 * worse than a disabled button. A missing table now reads as closed, so the
 * link is absent from the page source and `/apply` shows its closed state.
 *
 * Not cached, so the moment the table is created this flips to open with no
 * restart and no redeploy.
 */
export async function applicationsOpen(): Promise<boolean> {
  if (!env.APPLICATIONS_OPEN) return false;
  try {
    return await repo.tableExists();
  } catch {
    // Database unreachable: report closed rather than offering a form whose
    // submission cannot be stored.
    return false;
  }
}

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 3;

/**
 * The public submission. No token, no session, no call that requires auth.
 *
 * Order matters and is deliberate: the gate first, then the school check, then
 * the rate limit, then the duplicate check, and only then is anything written
 * or stored. A file is saved last of all, so a rejected submission never
 * leaves an orphaned object about a child in storage.
 */
export async function submitApplication(
  input: ApplicationCreateInput,
  transcript: { buffer: Buffer; mime: string; ext: string; originalName: string } | null,
  context: { ip: string },
): Promise<PublicApplicationReceipt> {
  if (!(await applicationsOpen())) throw APPLICATIONS_CLOSED();

  // B2: never accept an application that cannot be processed.
  if (input.schoolChoice !== MAIN_SCHOOL) throw APPLICATION_SCHOOL_NOT_ACCEPTING();

  const verdict = checkAndRecord([`ip:${context.ip}`, `email:${input.email.toLowerCase()}`]);
  if (!verdict.allowed) throw RATE_LIMITED(verdict.retryAfterSeconds);

  // The durable half of the same limit: the in-memory counter resets on
  // restart, this does not.
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  if ((await guardTable(() => repo.countRecentByEmail(input.email, since))) >= RATE_MAX) {
    throw RATE_LIMITED(Math.ceil(RATE_WINDOW_MS / 1000));
  }

  let transcriptKey: string | null = null;
  if (transcript) {
    // Key shape mirrors the credentials module: an opaque uuid, never the
    // applicant's name, so the storage layout leaks nothing about a child
    // even to someone who can list it.
    transcriptKey = `applications/${randomUUID()}${transcript.ext}`;
  }

  let row: repo.ApplicationRow;
  try {
    row = await guardTable(() => repo.insertApplication(input, transcriptKey));
  } catch (err) {
    // The partial unique index on (lower(email)) where status = 'pending'
    // turns a second pending application from the same address into a
    // constraint violation. That is a real product rule, not a database
    // accident, so it gets its own code rather than a 500.
    if (isUniqueViolation(err)) throw APPLICATION_DUPLICATE_PENDING();
    throw err;
  }

  if (transcript && transcriptKey) {
    await storage.save(transcriptKey, transcript.buffer, {
      originalName: transcript.originalName,
      contentType: transcript.mime,
    });
  }

  // Deliberately thin: an applicant gets an id and a timestamp, not the row.
  return { id: row.id, submittedAt: row.createdAt };
}

function isUniqueViolation(err: unknown): boolean {
  // Postgres 23505. The driver error can arrive wrapped, so both the error and
  // its cause are checked — the same wrapped-error classification bug this
  // codebase already hit once elsewhere.
  const code = (e: unknown) => (typeof e === "object" && e !== null && "code" in e ? (e as { code?: unknown }).code : undefined);
  if (code(err) === "23505") return true;
  const cause = typeof err === "object" && err !== null && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  return code(cause) === "23505";
}

export async function listApplications(status: string): Promise<AdminApplication[]> {
  return (await guardTable(() => repo.listApplications(status))).map(toAdminView);
}

export async function getApplication(id: string): Promise<AdminApplication> {
  const row = await guardTable(() => repo.findApplication(id));
  if (!row) throw NOT_FOUND();
  return toAdminView(row);
}

/**
 * B5: "APPROVE DOES NOT CREATE THE ACCOUNT. It marks the application approved
 * and opens the EXISTING account-creation form prefilled."
 *
 * So this returns the prefill payload and nothing else happens. No user row,
 * no password, no email. A human still creates the account through the path
 * that already exists, which is what keeps the PRD's trust model intact:
 * accounts are created by the institution, deliberately.
 */
export async function approveApplication(id: string, adminUserId: string, idempotencyKey?: string) {
  // A replayed Idempotency-Key returns the same answer instead of a conflict.
  // Without this, a retried request after a dropped response reads as "already
  // decided" and an admin cannot tell a genuine double-decision from a flaky
  // network.
  if (idempotencyKey) {
    const seen = await repo.findDecisionByIdempotencyKey(id, idempotencyKey);
    if (seen) {
      const existing = await guardTable(() => repo.findApplication(id));
      if (existing) return buildApproval(existing);
    }
  }
  const row = await guardTable(() => repo.decideApplication(id, "approved", adminUserId));
  if (!row) {
    // Either it does not exist, or it was already decided. Distinguishing the
    // two tells an admin something useful, so read once more to find out.
    const existing = await guardTable(() => repo.findApplication(id));
    throw existing ? CONFLICT() : NOT_FOUND();
  }
  await repo.writeApplicationAuditLog({
    actorUserId: adminUserId,
    applicationId: row.id,
    before: { status: "pending" },
    after: { status: "approved", decidedAt: row.decidedAt ?? new Date().toISOString(), idempotencyKey },
  });
  return buildApproval(row);
}

function buildApproval(row: repo.ApplicationRow) {
  return {
    application: toAdminView(row),
    // Field names match the existing new-student form's own inputs so the
    // frontend can hand this straight to it without a translation layer.
    prefill: {
      firstName: row.firstName,
      lastName: row.lastName,
      birthDate: row.birthDate,
      email: row.email,
    },
    accountCreated: false as const,
  };
}

export async function rejectApplication(
  id: string,
  adminUserId: string,
  reason?: string,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const seen = await repo.findDecisionByIdempotencyKey(id, idempotencyKey);
    if (seen) {
      const existing = await guardTable(() => repo.findApplication(id));
      if (existing) return { application: toAdminView(existing), notified: false as const };
    }
  }
  const row = await guardTable(() => repo.decideApplication(id, "rejected", adminUserId, reason));
  if (!row) {
    const existing = await guardTable(() => repo.findApplication(id));
    throw existing ? CONFLICT() : NOT_FOUND();
  }
  await repo.writeApplicationAuditLog({
    actorUserId: adminUserId,
    applicationId: row.id,
    before: { status: "pending" },
    after: { status: "rejected", decidedAt: row.decidedAt ?? new Date().toISOString(), reason, idempotencyKey },
  });
  // Nothing is sent to the applicant. B5 is explicit that a rejection notifies
  // no one unless an admin explicitly chooses to, and there is no such choice
  // built, so there is no code path here that could contact anybody.
  return { application: toAdminView(row), notified: false as const };
}

/**
 * B6: "Rejected applications are hard-deletable by the admin in one action,
 * including the R2 object."
 *
 * The row goes first and the object second, in that order: if the object
 * delete fails, an admin can retry the action, whereas deleting the object
 * first and then failing on the row would leave a row pointing at nothing and
 * no way to tell it from a row that never had a transcript.
 */
export async function deleteApplication(
  id: string,
  adminUserId: string,
): Promise<{ deletedRow: true; deletedObject: boolean }> {
  const row = await guardTable(() => repo.deleteApplication(id));
  if (!row) throw NOT_FOUND();
  await repo.writeApplicationDeletionAuditLog({
    actorUserId: adminUserId,
    applicationId: row.id,
    status: row.status,
    hadTranscript: Boolean(row.transcriptKey),
  });
  if (!row.transcriptKey) return { deletedRow: true, deletedObject: false };
  await storage.delete(row.transcriptKey);
  return { deletedRow: true, deletedObject: true };
}

/** Streams a transcript for a valid, unexpired, admin-presented token. */
export async function readTranscript(token: string) {
  const verified = verifyTranscriptKey(token);
  if (!verified.ok) throw APPLICATION_LINK_INVALID();
  const row = await guardTable(() => repo.findApplication(verified.applicationId));
  if (!row || !row.transcriptKey) throw APPLICATION_TRANSCRIPT_MISSING();
  const object = await storage.read(row.transcriptKey);
  if (!object) throw APPLICATION_TRANSCRIPT_MISSING();
  return object;
}
