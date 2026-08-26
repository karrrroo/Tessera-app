import { z } from "zod";

export const exportQuerySchema = z.object({
  scope: z.enum(["class-subject-term", "class-term", "institution-term"]),
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  termId: z.string().uuid(),
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
  locale: z.enum(["hy", "en", "ru"]).default("hy"),
});

export const exportLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
