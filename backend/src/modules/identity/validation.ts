import { z } from "zod";

export const verifySchema = z.object({
  payload: z.string().min(1).max(64),
  scannerId: z.string().min(1).max(120),
  location: z.string().max(200).optional(),
});

export const anomaliesQuerySchema = z.object({
  since: z.string().datetime().optional(),
});
