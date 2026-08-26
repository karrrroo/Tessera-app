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
