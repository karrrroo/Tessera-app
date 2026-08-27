import { z } from "zod";

export const institutionPatchSchema = z.object({
  name: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
});

export const academicYearCreateSchema = z.object({
  label: z.string().min(1),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
});
export const academicYearPatchSchema = academicYearCreateSchema.partial();

export const termCreateSchema = z.object({
  academicYearId: z.string().uuid(),
  index: z.number().int().min(1),
  label: z.string().min(1),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
});
export const termPatchSchema = termCreateSchema.partial().omit({ academicYearId: true });

export const subjectCreateSchema = z.object({
  nameHy: z.string().min(1),
  nameEn: z.string().min(1),
  nameRu: z.string().min(1),
  code: z.string().optional(),
});
export const subjectPatchSchema = subjectCreateSchema.partial();

export const classCreateSchema = z.object({
  academicYearId: z.string().uuid(),
  grade: z.number().int().min(1).max(12),
  letter: z.string().min(1).max(4),
});

const ARMENIAN_LETTER = /^[Ա-Ֆ]$/;
export const classGenerateSchema = z.object({
  academicYearId: z.string().uuid(),
  grades: z.array(z.number().int().min(1).max(12)).min(1),
  letters: z.array(z.string().regex(ARMENIAN_LETTER)).min(1),
});
export const GENERATE_RANGE_MAX = 60;

export const enrollmentPatchSchema = z.union([
  z.object({ status: z.literal("transferred"), toClassId: z.string().uuid() }),
  z.object({ status: z.literal("departed") }),
  z.object({ status: z.literal("graduated") }),
]);

export const studentCreateSchema = z.object({
  classId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  patronymic: z.string().optional(),
  birthDate: z.string().date().optional(),
  email: z.string().email(),
});

// Creating one teacher account. Deliberately NOT a mirror of
// studentCreateSchema: a student must be put in a class to exist meaningfully
// (their marks hang off an enrolment), whereas a teacher's classes are
// teaching assignments made afterwards on /admin/assignments and a teacher
// with none is a perfectly valid record — someone hired before the timetable
// is set. So there is no classId here, and no birthDate either: the schema
// has no column for a teacher's date of birth.
// Creating one teacher account, with what they teach.
//
// NO EMIS ID. Tessera replaces that system, so asking an admin to type an
// identifier from the thing being replaced is backwards — the column stays
// nullable in the schema for imported records, but nothing this product's own
// UI creates will populate it.
//
// Instead: the subjects they teach and the classes they teach them to. Those
// two lists are a cross product — three subjects across four classes is twelve
// teaching assignments — which is what `teaching_assignment` actually stores
// (one row per class + subject + year). Both are optional: a teacher hired
// before the timetable is settled is a valid record, and assignments can still
// be added later on /admin/assignments.
export const teacherCreateSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  patronymic: z.string().trim().min(1).optional(),
  email: z.string().trim().email(),
  // Capped so one request cannot try to write an unbounded number of
  // assignment rows. 20 x 40 is far past any real timetable.
  subjectIds: z.array(z.string().uuid()).max(20).optional().default([]),
  classIds: z.array(z.string().uuid()).max(40).optional().default([]),
  // Which year the assignments belong to. Required only when there is
  // something to assign, because `teaching_assignment.academic_year_id` is not
  // nullable and guessing the year would silently put a timetable in the wrong
  // one.
  academicYearId: z.string().uuid().optional(),
}).refine(
  (v) => (v.subjectIds.length === 0 && v.classIds.length === 0) || Boolean(v.academicYearId),
  { message: "academicYearId is required when subjects or classes are given", path: ["academicYearId"] },
).refine(
  // Subjects without classes, or classes without subjects, describes no
  // assignment at all. Rejecting it is kinder than silently creating none.
  (v) => (v.subjectIds.length > 0) === (v.classIds.length > 0),
  { message: "give both subjects and classes, or neither", path: ["subjectIds"] },
);

export const assignmentCreateSchema = z.object({
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

export const importTemplateQuerySchema = z.object({
  kind: z.enum(["students", "teachers"]),
});

export const importUploadQuerySchema = z.object({
  kind: z.enum(["students", "teachers"]),
});

export const importRowPatchSchema = z.object({
  raw: z.record(z.string(), z.unknown()),
});

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_PREVIEW_TTL_HOURS = 24;
