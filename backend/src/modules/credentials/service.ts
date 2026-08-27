import { randomUUID } from "node:crypto";
import { ApiError, FORBIDDEN, NOT_FOUND } from "../../http/errors.js";
import { storage } from "../../lib/storage.js";
import * as repo from "./repo.js";

type AuthClaims = { sub: string; role: "student" | "teacher" | "admin" };

const CREDENTIAL_SUBJECT_INVALID = () => new ApiError(422, "CREDENTIAL_SUBJECT_INVALID");
const CREDENTIAL_REASON_REQUIRED = () => new ApiError(422, "CREDENTIAL_REASON_REQUIRED");
const CREDENTIAL_ALREADY_DECIDED = (currentStatus: string) =>
  new ApiError(409, "CREDENTIAL_ALREADY_DECIDED", { details: { currentStatus } });
const CREDENTIAL_NOT_REVIEWABLE = () => new ApiError(403, "CREDENTIAL_NOT_REVIEWABLE");
const CREDENTIAL_SUBJECT_MISSING = () => new ApiError(409, "CREDENTIAL_SUBJECT_MISSING");
const CREDENTIAL_SCOPE_FORBIDDEN = () => new ApiError(403, "FORBIDDEN");

async function requireStudent(auth: AuthClaims) {
  if (auth.role !== "student") throw FORBIDDEN();
  const row = await repo.findStudentByUserId(auth.sub);
  if (!row) throw NOT_FOUND();
  return row;
}

async function requireTeacher(auth: AuthClaims) {
  if (auth.role !== "teacher") throw FORBIDDEN();
  const row = await repo.findTeacherByUserId(auth.sub);
  if (!row) throw NOT_FOUND();
  return row;
}

export async function submitCredential(
  auth: AuthClaims,
  input: { category: string; title: string; description?: string; subjectId?: string },
  file: { buffer: Buffer; mime: string; ext: string; originalName: string },
) {
  const studentRow = await requireStudent(auth);

  if (input.subjectId) {
    const subjectRow = await repo.findSubjectById(input.subjectId);
    if (!subjectRow) throw CREDENTIAL_SUBJECT_INVALID();
  }

  const id = randomUUID();
  const key = `credentials/${studentRow.institutionId}/${id}/${randomUUID()}${file.ext}`;
  await storage.save(key, file.buffer, { originalName: file.originalName, contentType: file.mime });

  return repo.insertCredentialRequest({
    id,
    studentId: studentRow.id,
    subjectId: input.subjectId,
    category: input.category,
    title: input.title,
    description: input.description,
    attachmentUrl: key,
    attachmentMime: file.mime,
  });
}

async function resolveListScope(auth: AuthClaims) {
  if (auth.role === "student") {
    const studentRow = await requireStudent(auth);
    return { role: "student" as const, studentId: studentRow.id };
  }
  if (auth.role === "teacher") {
    const teacherRow = await requireTeacher(auth);
    const subjectIds = await repo.findSubjectIdsTaughtByTeacher(teacherRow.id);
    return { role: "teacher" as const, subjectIds };
  }
  return { role: "admin" as const };
}

export async function listCredentials(
  auth: AuthClaims,
  filters: { status?: "pending" | "approved" | "declined"; subjectId?: string; cursor?: string },
) {
  const LIMIT = 50;
  const scope = await resolveListScope(auth);
  const rows = await repo.findCredentialsList(scope, filters, LIMIT);

  const classLabels = await repo.findClassLabelsForStudents([...new Set(rows.map((r) => r.studentId))]);
  const deciderIds = [...new Set(rows.map((r) => r.decidedByUserId).filter((id): id is string => !!id))];
  const deciders = new Map(await Promise.all(deciderIds.map(async (id) => [id, await repo.findDeciderDisplay(id)] as const)));

  const items = rows.map((row) => ({
    id: row.id,
    status: row.status,
    category: row.category,
    title: row.title,
    description: row.description,
    subject: row.subjectId
      ? { id: row.subjectId, nameHy: row.subjectNameHy, nameEn: row.subjectNameEn, nameRu: row.subjectNameRu }
      : null,
    ...(auth.role === "student"
      ? {}
      : {
          student: {
            id: row.studentId,
            firstName: row.studentFirstName,
            lastName: row.studentLastName,
            classLabel: classLabels.get(row.studentId) ?? null,
          },
        }),
    attachment: row.attachmentUrl ? { mime: row.attachmentMime, key: row.attachmentUrl } : null,
    createdAt: row.createdAt,
    decision:
      row.status === "pending"
        ? null
        : {
            status: row.status,
            reason: row.decisionReason,
            decidedAt: row.decidedAt,
            decidedBy: row.decidedByUserId
              ? { name: deciders.get(row.decidedByUserId)?.name ?? deciders.get(row.decidedByUserId)?.email ?? null }
              : null,
          },
  }));

  const nextCursor = rows.length === 50 ? rows[rows.length - 1].createdAt : null;
  return { items, nextCursor };
}

export async function getAttachment(auth: AuthClaims, credentialId: string) {
  const credential = await repo.findCredentialById(credentialId);
  if (!credential || !credential.attachmentUrl) throw NOT_FOUND();

  if (auth.role === "student") {
    const studentRow = await requireStudent(auth);
    if (credential.studentId !== studentRow.id) throw NOT_FOUND();
  } else if (auth.role === "teacher") {
    const teacherRow = await requireTeacher(auth);
    if (!credential.subjectId || !(await repo.teacherTeachesSubject(teacherRow.id, credential.subjectId))) {
      throw NOT_FOUND();
    }
  } else if (auth.role !== "admin") {
    throw FORBIDDEN();
  }

  const object = await storage.read(credential.attachmentUrl);
  if (!object) throw NOT_FOUND();
  return object;
}

export async function decideCredential(
  auth: AuthClaims,
  credentialId: string,
  input: { decision: "approved" | "declined"; reason?: string },
  idempotencyKey?: string,
) {
  if (auth.role === "student") throw CREDENTIAL_SCOPE_FORBIDDEN();

  const credential = await repo.findCredentialById(credentialId);
  if (!credential) throw NOT_FOUND();

  if (idempotencyKey) {
    const existing = await repo.findDecisionByIdempotencyKey(credentialId, idempotencyKey);
    if (existing) return { ...credential, ...existing };
  }

  if (credential.status !== "pending") throw CREDENTIAL_ALREADY_DECIDED(credential.status);

  if (auth.role === "teacher") {
    const teacherRow = await requireTeacher(auth);
    if (!credential.subjectId) throw CREDENTIAL_SUBJECT_MISSING();
    if (!(await repo.teacherTeachesSubject(teacherRow.id, credential.subjectId))) throw CREDENTIAL_NOT_REVIEWABLE();
  }
  // admin may decide any request, including one with no subject.

  if (input.decision === "declined" && !input.reason?.trim()) throw CREDENTIAL_REASON_REQUIRED();

  const decidedAt = new Date().toISOString();
  const updated = await repo.decideCredential({
    id: credentialId,
    status: input.decision,
    decidedByUserId: auth.sub,
    decidedAt,
    decisionReason: input.decision === "declined" ? input.reason?.trim() : undefined,
  });

  await repo.writeCredentialAuditLog({
    actorUserId: auth.sub,
    credentialId,
    before: { status: "pending" },
    after: {
      status: input.decision,
      decidedAt,
      decisionReason: updated?.decisionReason ?? undefined,
      idempotencyKey,
    },
  });

  return updated;
}
