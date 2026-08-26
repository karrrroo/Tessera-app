import { z } from "zod";

export const gradebookQuerySchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
});

export const createAssessmentSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
  heldOn: z.string().date().optional(),
  kind: z.enum(["lesson", "test", "exam", "project"]),
  title: z.string().trim().min(1).optional(),
  topic: z.string().trim().min(1).optional(),
});

export const patchAssessmentSchema = z.object({
  title: z.string().trim().min(1).nullable().optional(),
  topic: z.string().trim().min(1).nullable().optional(),
  heldOn: z.string().date().optional(),
});

const MARK_VALUE = z.number().int().min(1).max(10);

export const putMarksSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
  items: z
    .array(
      z.object({
        assessmentId: z.string().uuid(),
        studentId: z.string().uuid(),
        value: MARK_VALUE.nullable(),
      }),
    )
    .min(1)
    .max(2000),
});

export const publishSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
});

// `reason` deliberately accepts any string here, including empty — an
// empty/whitespace-only reason gets its own specific code,
// `MARK_REASON_REQUIRED`, thrown from the service layer, not folded into
// a generic VALIDATION_FAILED the way a malformed value/uuid is.
export const supersedeSchema = z.object({
  value: MARK_VALUE,
  reason: z.string(),
});
