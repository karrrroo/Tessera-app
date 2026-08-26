import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  student,
  enrollment,
  academicYear,
  term,
  schoolClass,
  subject,
  teacher,
  teachingAssignment,
  assessment,
  mark,
  credentialRequest,
} from "../../db/schema.js";

export async function findStudentByUserId(userId: string) {
  const [row] = await db.select().from(student).where(eq(student.userId, userId)).limit(1);
  return row;
}

// Most-recent-by-year enrollment, same tie-breaking limitation as D-27 —
// there is no institution-wide "current year" flag anywhere in the schema.
export async function findCurrentEnrollment(studentId: string) {
  const [row] = await db
    .select({
      enrollmentId: enrollment.id,
      status: enrollment.status,
      classId: enrollment.classId,
      academicYearId: enrollment.academicYearId,
      grade: schoolClass.grade,
      letter: schoolClass.letter,
    })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .where(eq(enrollment.studentId, studentId))
    .orderBy(desc(academicYear.startsOn))
    .limit(1);
  return row;
}

export async function findTermsForYear(academicYearId: string) {
  return db.select().from(term).where(eq(term.academicYearId, academicYearId)).orderBy(term.index);
}

export async function findTermById(termId: string) {
  const [row] = await db.select().from(term).where(eq(term.id, termId)).limit(1);
  return row;
}

export async function findAssignmentsForClass(classId: string, academicYearId: string) {
  return db
    .select({
      subjectId: subject.id,
      nameHy: subject.nameHy,
      nameEn: subject.nameEn,
      nameRu: subject.nameRu,
      teacherFirstName: teacher.firstName,
      teacherLastName: teacher.lastName,
    })
    .from(teachingAssignment)
    .innerJoin(subject, eq(subject.id, teachingAssignment.subjectId))
    .innerJoin(teacher, eq(teacher.id, teachingAssignment.teacherId))
    .where(and(eq(teachingAssignment.classId, classId), eq(teachingAssignment.academicYearId, academicYearId)));
}

// REC-7, enforced here not in a filter: `state in ('published','superseded')`
// is the only where-clause a draft could possibly match, and it excludes
// 'draft' entirely — a draft is never fetched, not fetched-then-hidden.
export async function findMarksForStudentTerm(studentId: string, termId: string) {
  return db
    .select({
      markId: mark.id,
      assessmentId: mark.assessmentId,
      value: mark.value,
      state: mark.state,
      supersedesMarkId: mark.supersedesMarkId,
      reason: mark.reason,
      enteredAt: mark.enteredAt,
      enteredByTeacherId: mark.enteredByTeacherId,
      publishedAt: mark.publishedAt,
      heldOn: assessment.heldOn,
      kind: assessment.kind,
      title: assessment.title,
      topic: assessment.topic,
      subjectId: assessment.subjectId,
    })
    .from(mark)
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .where(and(eq(mark.studentId, studentId), eq(assessment.termId, termId), inArray(mark.state, ["published", "superseded"])))
    .orderBy(assessment.heldOn);
}

export type MarkRow = Awaited<ReturnType<typeof findMarksForStudentTerm>>[number];

export async function findMarkById(markId: string) {
  const [row] = await db.select().from(mark).where(eq(mark.id, markId)).limit(1);
  return row;
}

export async function findTeacherNames(teacherIds: string[]) {
  if (teacherIds.length === 0) return [];
  return db
    .select({ id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName })
    .from(teacher)
    .where(inArray(teacher.id, teacherIds));
}

export async function findApprovedAndPendingCredentials(studentId: string, subjectIds: string[]) {
  if (subjectIds.length === 0) return [];
  return db
    .select({
      id: credentialRequest.id,
      subjectId: credentialRequest.subjectId,
      title: credentialRequest.title,
      category: credentialRequest.category,
      status: credentialRequest.status,
      decidedAt: credentialRequest.decidedAt,
    })
    .from(credentialRequest)
    .where(and(eq(credentialRequest.studentId, studentId), inArray(credentialRequest.subjectId, subjectIds), inArray(credentialRequest.status, ["approved", "pending"])));
}

// "Previous years" (roadmap): every other enrollment this student has, most
// recent first — a departed or graduated one still appears (ADM-7).
export async function findOtherEnrollments(studentId: string, excludeAcademicYearId: string) {
  return db
    .select({
      status: enrollment.status,
      classId: enrollment.classId,
      academicYearId: enrollment.academicYearId,
      yearLabel: academicYear.label,
      startsOn: academicYear.startsOn,
      grade: schoolClass.grade,
      letter: schoolClass.letter,
    })
    .from(enrollment)
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(and(eq(enrollment.studentId, studentId), ne(enrollment.academicYearId, excludeAcademicYearId)))
    .orderBy(desc(academicYear.startsOn));
}

// "Final marks per subject" for a past year — every published mark across
// both terms of that year, averaged per subject in the service layer.
export async function findPublishedMarksForYear(studentId: string, classId: string) {
  return db
    .select({
      subjectId: subject.id,
      nameHy: subject.nameHy,
      nameEn: subject.nameEn,
      nameRu: subject.nameRu,
      value: mark.value,
    })
    .from(mark)
    .innerJoin(assessment, eq(assessment.id, mark.assessmentId))
    .innerJoin(subject, eq(subject.id, assessment.subjectId))
    .where(and(eq(mark.studentId, studentId), eq(assessment.classId, classId), eq(mark.state, "published")));
}
