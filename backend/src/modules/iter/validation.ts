import { z } from "zod";

// `text` deliberately accepts any string, including empty — an empty/
// whitespace-only message gets the specific `ITER_MESSAGE_EMPTY` code,
// thrown from the service layer once attachments (still unbuilt) are also
// accounted for, not folded into a generic `VALIDATION_FAILED` here.
export const sendMessageSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().max(4000),
  screen: z.string().max(200).optional(),
  locale: z.enum(["hy", "en", "ru"]).default("hy"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().max(4000),
      }),
    )
    .max(40)
    .default([]),
});

// The history cursor is a timestamp this API itself issued, so it is validated
// as one rather than trusted. It is deliberately NOT a user id and cannot
// become one: whose history comes back is decided by the token alone.
export const historyQuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
