import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  user,
  student,
  teacher,
  institution,
  schoolClass,
  enrollment,
  teachingAssignment,
  deviceSession,
} from "../../db/schema.js";

// Dev-only (routes.ts mounts the endpoint using this behind NODE_ENV !==
// "production") — feeds the login screen's demo row.
export async function listDemoAccounts() {
  return db
    .select({ email: user.email, role: user.role, mustChangePassword: user.mustChangePassword })
    .from(user)
    .where(eq(user.isDemo, true));
}

// Login identifier resolution order (AUTH-3): citext email, then the
// institution-issued id on the matching role table. Neither EMIS id column is
// populated by tessera-seed.sql (see docs/decisions.md), so only the email
// path is exercisable against seed data — the id fallback is still correct
// and ready for real rosters.
export async function findUserByIdentifier(identifier: string) {
  const [byEmail] = await db.select().from(user).where(eq(user.email, identifier)).limit(1);
  if (byEmail) return byEmail;

  const [viaStudent] = await db
    .select({ user })
    .from(user)
    .innerJoin(student, eq(student.userId, user.id))
    .where(eq(student.emisStudentId, identifier))
    .limit(1);
  if (viaStudent) return viaStudent.user;

  const [viaTeacher] = await db
    .select({ user })
    .from(user)
    .innerJoin(teacher, eq(teacher.userId, user.id))
    .where(eq(teacher.emisTeacherId, identifier))
    .limit(1);
  return viaTeacher?.user;
}

export async function findUserById(userId: string) {
  const [row] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  return row;
}

// Shapes the role-dependent "user" object in the login/me response (roadmap
// Phase 3, POST /api/auth/login). `preferences` is a Phase 4 placeholder —
// there's no preferences storage yet (that's /api/me/preferences, Phase 4).
export async function getUserProfile(userId: string) {
  const u = await findUserById(userId);
  if (!u) return null;

  const base = {
    id: u.id,
    role: u.role,
    locale: u.locale,
    mustChangePassword: u.mustChangePassword,
    preferences: { theme: "system", accent: "black", background: "deep", iterPosition: "floating" },
  };

  if (u.role === "student") {
    const [row] = await db
      .select({
        firstName: student.firstName,
        lastName: student.lastName,
        studentId: student.id,
        institutionId: institution.id,
        institutionName: institution.name,
        grade: schoolClass.grade,
        letter: schoolClass.letter,
      })
      .from(student)
      .innerJoin(institution, eq(institution.id, student.institutionId))
      .leftJoin(enrollment, and(eq(enrollment.studentId, student.id), eq(enrollment.status, "active")))
      .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
      .where(eq(student.userId, userId))
      .limit(1);
    return {
      ...base,
      firstName: row?.firstName,
      lastName: row?.lastName,
      institutionId: row?.institutionId,
      institutionName: row?.institutionName,
      studentId: row?.studentId,
      classLabel: row?.grade && row?.letter ? `${row.grade}-${row.letter}` : null,
    };
  }

  if (u.role === "teacher") {
    const [row] = await db
      .select({
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        teacherId: teacher.id,
        institutionId: institution.id,
        institutionName: institution.name,
      })
      .from(teacher)
      .innerJoin(institution, eq(institution.id, teacher.institutionId))
      .where(eq(teacher.userId, userId))
      .limit(1);
    const subjectRows = row
      ? await db
          .select({ subjectId: teachingAssignment.subjectId })
          .from(teachingAssignment)
          .where(eq(teachingAssignment.teacherId, row.teacherId))
      : [];
    return {
      ...base,
      firstName: row?.firstName,
      lastName: row?.lastName,
      institutionId: row?.institutionId,
      institutionName: row?.institutionName,
      teacherId: row?.teacherId,
      subjectIds: [...new Set(subjectRows.map((r) => r.subjectId))],
    };
  }

  // admin — no student/teacher profile row.
  return base;
}

export async function createDeviceSession(input: { userId: string; deviceLabel: string; refreshTokenHash: string }) {
  const [row] = await db
    .insert(deviceSession)
    .values({ userId: input.userId, deviceLabel: input.deviceLabel, refreshTokenHash: input.refreshTokenHash, lastSeenAt: new Date().toISOString() })
    .returning();
  return row;
}

export async function findActiveDeviceSessionByHash(refreshTokenHash: string) {
  const [row] = await db
    .select()
    .from(deviceSession)
    .where(and(eq(deviceSession.refreshTokenHash, refreshTokenHash), isNull(deviceSession.revokedAt)))
    .limit(1);
  return row;
}

// Includes revoked rows. Used only to tell "a real, known session that's
// since been revoked" (AUTH_SESSION_REVOKED) apart from "not a real token at
// all" (AUTH_REFRESH_INVALID) — rotation-reuse detection is a separate signal
// entirely (rotation-tracker.ts), since a revoked row alone doesn't say
// *why* it was revoked (docs/decisions.md D-12).
export async function findAnyDeviceSessionByHash(refreshTokenHash: string) {
  const [row] = await db.select().from(deviceSession).where(eq(deviceSession.refreshTokenHash, refreshTokenHash)).limit(1);
  return row;
}

// Rotation = revoke the presented session and insert its replacement, not an
// in-place update — see findAnyDeviceSessionByHash above for why.
export async function rotateDeviceSession(oldSessionId: string, input: { userId: string; deviceLabel: string; newHash: string }) {
  await db.update(deviceSession).set({ revokedAt: new Date().toISOString() }).where(eq(deviceSession.id, oldSessionId));
  const [row] = await db
    .insert(deviceSession)
    .values({
      userId: input.userId,
      deviceLabel: input.deviceLabel,
      refreshTokenHash: input.newHash,
      lastSeenAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function revokeDeviceSession(sessionId: string) {
  await db.update(deviceSession).set({ revokedAt: new Date().toISOString() }).where(eq(deviceSession.id, sessionId));
}

export async function revokeAllDeviceSessionsForUser(userId: string) {
  await db
    .update(deviceSession)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(deviceSession.userId, userId), isNull(deviceSession.revokedAt)));
}

export async function revokeAllDeviceSessionsExcept(userId: string, keepSessionId: string) {
  await db
    .update(deviceSession)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(deviceSession.userId, userId), isNull(deviceSession.revokedAt), ne(deviceSession.id, keepSessionId)));
}

export async function listDeviceSessions(userId: string) {
  return db
    .select()
    .from(deviceSession)
    .where(and(eq(deviceSession.userId, userId), isNull(deviceSession.revokedAt)))
    .orderBy(desc(deviceSession.lastSeenAt));
}

export async function setPasswordHash(userId: string, passwordHash: string, clearMustChange: boolean) {
  await db
    .update(user)
    .set({ passwordHash, ...(clearMustChange ? { mustChangePassword: false } : {}), updatedAt: new Date().toISOString() })
    .where(eq(user.id, userId));
}

export async function setLockedUntil(userId: string, lockedUntil: Date | null) {
  await db
    .update(user)
    .set({ lockedUntil: lockedUntil ? lockedUntil.toISOString() : null })
    .where(eq(user.id, userId));
}

export async function setLastLoginAt(userId: string) {
  await db.update(user).set({ lastLoginAt: new Date().toISOString() }).where(eq(user.id, userId));
}
