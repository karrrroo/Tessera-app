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
