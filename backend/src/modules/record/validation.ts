import { z } from "zod";

export const recordQuerySchema = z.object({
  termId: z.string().uuid().optional(),
});
