import { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { ApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { sendMessageSchema } from "./validation.js";
import * as service from "./service.js";

export const iterRouter = Router();

iterRouter.use(requireAuth);
iterRouter.use(asyncHandler(requirePasswordChanged));

function auth(req: { auth?: { sub: string; role: "student" | "teacher" | "admin" } }) {
  if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
  return req.auth;
}

iterRouter.post(
  "/iter/messages",
  asyncHandler(async (req, res) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED();
    const { text, screen, locale, history } = parsed.data;
    res.status(201).json(await service.sendMessage(auth(req), { text, screen, locale, history }));
  }),
);
