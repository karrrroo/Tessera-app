import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { application, auditLog } from "../../db/schema.js";
import type { ApplicationCreateInput } from "./validation.js";

export type ApplicationRow = typeof application.$inferSelect;

export async function insertApplication(
  input: ApplicationCreateInput,
  transcriptKey: string | null,
): Promise<ApplicationRow> {
  const [row] = await db
    .insert(application)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: input.birthDate,
      email: input.email,
      phone: input.phone ?? null,
      schoolChoice: input.schoolChoice,
      streamChoice: input.streamChoice,
      motivation: input.motivation ?? null,
      transcriptKey,
    })
    .returning();
  return row;
}

/**
 * B5: "Pending first, oldest first." Oldest-first is the whole point — a
 * queue about children that sorts newest-first quietly buries whoever has
 * been waiting longest.
 */
export async function listApplications(status: string): Promise<ApplicationRow[]> {
  return db
    .select()
    .from(application)
    .where(eq(application.status, status))
    .orderBy(asc(application.createdAt));
}

export async function findApplication(id: string): Promise<ApplicationRow | null> {
  const [row] = await db.select().from(application).where(eq(application.id, id)).limit(1);
  return row ?? null;
}

/**
 * Decides an application, but only from `pending`.
 *
 * The status guard is in the WHERE clause rather than in a read-then-write in
 * the service, so two admins clicking approve and reject at the same moment
 * cannot both succeed: the second UPDATE matches no row and the caller gets a
 * conflict. Returns null when nothing was updated.
 */
export async function decideApplication(
  id: string,
  status: "approved" | "rejected",
  decidedByUserId: string,
  reason?: string,
): Promise<ApplicationRow | null> {
  const [row] = await db
    .update(application)
    .set({
      status,
      decidedAt: sql`now()`,
      decidedBy: decidedByUserId,
      // The rejection reason is kept in `motivation`'s sibling column only if
      // one exists; this schema has no `decision_reason`, and C2 forbids
      // adding one, so a reason is recorded in the audit log instead (see
      // service.ts) rather than invented as a new column here.
    })
    .where(and(eq(application.id, id), eq(application.status, "pending")))
    .returning();
  void reason;
  return row ?? null;
}

export async function deleteApplication(id: string): Promise<ApplicationRow | null> {
  const [row] = await db.delete(application).where(eq(application.id, id)).returning();
  return row ?? null;
}

/**
 * How many applications this email address has filed since `since`.
 *
 * The in-memory rate limiter is the first line and resets on restart; this is
 * the durable one, and it is why the per-email limit survives a redeploy.
 */
export async function countRecentByEmail(email: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(application)
    .where(and(sql`lower(${application.email}) = ${email.toLowerCase()}`, gt(application.createdAt, since.toISOString())));
  return row?.n ?? 0;
}

/** Newest first — only used to show an admin the most recent decisions. */
export async function listRecentlyDecided(limit: number): Promise<ApplicationRow[]> {
  return db
    .select()
    .from(application)
    .where(sql`${application.status} <> 'pending'`)
    .orderBy(desc(application.decidedAt))
    .limit(limit);
}

// Idempotency-Key (B5 requires it on approve and reject), stored in
// audit_log.after exactly like the credentials and gradebook flows — the
// frozen schema has no dedicated column and C2 forbids adding one. Scoped to
// entityId as well as the key, so a replayed key cannot collide across two
// different applications.
//
// This is also where a rejection reason is recorded. `application` has no
// `decision_reason` column, unlike `credential_request`; inventing one would
// be a schema change, and the audit log is the right home for "who decided
// what, when, and why" regardless.
export async function findDecisionByIdempotencyKey(applicationId: string, idempotencyKey: string) {
  const [row] = await db
    .select({ after: auditLog.after })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "application_decision"),
        eq(auditLog.entityId, applicationId),
        sql`${auditLog.after}->>'idempotencyKey' = ${idempotencyKey}`,
      ),
    )
    .limit(1);
  return row?.after as { status: string; decidedAt: string; reason?: string } | undefined;
}

export async function writeApplicationAuditLog(input: {
  actorUserId: string;
  applicationId: string;
  before: { status: string };
  after: { status: string; decidedAt: string; reason?: string; idempotencyKey?: string };
}) {
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId,
    action: "application_decision",
    entityType: "application",
    entityId: input.applicationId,
    before: input.before,
    after: input.after,
  });
}

// Deletion of a rejected application is itself an event worth keeping — the
// row is gone, so the audit log is the only remaining record that it existed
// and that a named admin removed it. Nothing identifying the child is copied
// into it: no name, no email, no transcript key (B6).
export async function writeApplicationDeletionAuditLog(input: {
  actorUserId: string;
  applicationId: string;
  status: string;
  hadTranscript: boolean;
}) {
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId,
    action: "application_deleted",
    entityType: "application",
    entityId: input.applicationId,
    before: { status: input.status, hadTranscript: input.hadTranscript },
    after: null,
  });
}
