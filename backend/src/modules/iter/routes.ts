import { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { ApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { requireUuidParam } from "../../http/middleware/require-uuid-param.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { historyQuerySchema, sendMessageSchema } from "./validation.js";
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
    const { sessionId, text, screen, locale, history } = parsed.data;
    res.status(201).json(await service.sendMessage(auth(req), { sessionId, text, screen, locale, history }));
  }),
);

// GET /api/iter/messages — the authenticated user's OWN history (group A5).
//
// There is no user id anywhere in this request: not a path segment, not a
// query parameter, not a header. Whose messages come back is decided solely by
// `req.auth.sub` from the verified token, and repo.ts offers no query that can
// omit the owner, so there is no way for a future edit here to widen it by
// accident.
iterRouter.get(
  "/iter/messages",
  asyncHandler(async (req, res) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) throw VALIDATION_FAILED();
    res.json(await service.getHistory(auth(req), parsed.data));
  }),
);

// One message, and only if it is the caller's own. A message belonging to
// someone else answers NOT_FOUND rather than FORBIDDEN: confirming that it
// exists but is not yours would itself be a disclosure.
iterRouter.get(
  "/iter/messages/:id",
  requireUuidParam("id"),
  asyncHandler(async (req, res) => {
    res.json(await service.getOwnMessage(auth(req), req.params.id));
  }),
);

// The only deletion path a person controls over their own history. Q10
// (retention) is still unresolved, so this is deliberately available now
// rather than waiting for a policy: a minor being able to erase their own
// messages is the one guarantee that does not need a policy decision first.
iterRouter.delete(
  "/iter/messages",
  asyncHandler(async (req, res) => {
    res.json(await service.clearHistory(auth(req)));
  }),
);
