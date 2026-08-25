import { Router } from "express";
import type { Request, Response } from "express";
import { ApiError, sendApiError, VALIDATION_FAILED } from "../../http/errors.js";
import { asyncHandler } from "../../http/async-handler.js";
import { requireAuth } from "../../http/middleware/require-auth.js";
import { requirePasswordChanged } from "../../http/middleware/require-password-changed.js";
import { env } from "../../lib/env.js";
import * as service from "./service.js";
import { forgotPasswordSchema, loginSchema, passwordChangeSchema, resetPasswordSchema } from "./validation.js";

const REFRESH_COOKIE_NAME = "tsr_rt";
const REFRESH_COOKIE_PATH = "/api/auth/refresh";

function setRefreshCookie(res: Response, cookie: { token: string; maxAgeSeconds: number }) {
  res.cookie(REFRESH_COOKIE_NAME, cookie.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: cookie.maxAgeSeconds * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

export const authRouter = Router();

// requireAuth populates req.auth; requirePasswordChanged then checks it live
// against the DB and 403s unless the route is on its own exemption list
// (password/change and logout always are — see that middleware's comment).
const guarded = [requireAuth, asyncHandler(requirePasswordChanged)];

authRouter.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED({ issues: parsed.error.issues.map((i) => i.path.join(".")) });

    const { refreshCookie, ...body } = await service.login(parsed.data);
    setRefreshCookie(res, refreshCookie);
    res.json(body);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const { refreshCookie, ...body } = await service.refresh(presented);
    setRefreshCookie(res, refreshCookie);
    res.json(body);
  }),
);

authRouter.post(
  "/logout",
  ...guarded,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.auth) await service.logout(req.auth.sid);
    clearRefreshCookie(res);
    res.status(204).end();
  }),
);

authRouter.post(
  "/password/change",
  ...guarded,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED({ issues: parsed.error.issues.map((i) => i.path.join(".")) });
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");

    await service.changePassword(req.auth.sub, req.auth.sid, parsed.data);
    res.status(204).end();
  }),
);

authRouter.post(
  "/password/forgot",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED({ issues: parsed.error.issues.map((i) => i.path.join(".")) });

    await service.forgotPassword(parsed.data.email);
    res.status(202).end();
  }),
);

authRouter.post(
  "/password/reset",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw VALIDATION_FAILED({ issues: parsed.error.issues.map((i) => i.path.join(".")) });

    await service.resetPassword(parsed.data);
    res.status(204).end();
  }),
);

authRouter.get(
  "/sessions",
  ...guarded,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    res.json(await service.listSessions(req.auth.sub, req.auth.sid));
  }),
);

authRouter.delete(
  "/sessions/:id",
  ...guarded,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    await service.revokeSession(req.auth.sub, req.params.id);
    res.status(204).end();
  }),
);

authRouter.delete(
  "/sessions",
  ...guarded,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
    await service.revokeAllOtherSessions(req.auth.sub, req.auth.sid);
    res.status(204).end();
  }),
);

// Dev-only — asserted absent in production by Phase 14's checklist.
if (env.NODE_ENV !== "production") {
  authRouter.get("/dev/last-reset-token", (req: Request, res: Response) => {
    const email = req.query.email;
    if (typeof email !== "string") {
      sendApiError(res, VALIDATION_FAILED({ issues: ["email"] }));
      return;
    }
    const link = service.getDevLastResetLink(email);
    res.json({ link: link ?? null });
  });

  authRouter.get(
    "/dev/demo-accounts",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await service.listDemoAccounts());
    }),
  );
}
