import express from "express";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { pool } from "../db/client.js";
import { authRouter } from "../modules/auth/routes.js";
import { adminRouter } from "../modules/admin/routes.js";
import { identityRouter } from "../modules/identity/routes.js";
import { recordRouter } from "../modules/record/routes.js";
import { gradebookRouter } from "../modules/gradebook/routes.js";
import { iterRouter } from "../modules/iter/routes.js";
import { exportRouter } from "../modules/export/routes.js";
import { credentialsRouter } from "../modules/credentials/routes.js";
import { publicApplicationsRouter, adminApplicationsRouter } from "../modules/applications/routes.js";
import { requireAuth } from "./middleware/require-auth.js";
import { requirePasswordChanged } from "./middleware/require-password-changed.js";
import { asyncHandler } from "./async-handler.js";
import { ApiError, VALIDATION_FAILED } from "./errors.js";
import { errorHandler } from "./error-handler.js";
import { getUserProfile, setLocale } from "../modules/auth/repo.js";

const LOCALES = ["hy", "en", "ru"] as const;
const preferencesPatchSchema = z.object({
  locale: z.enum(LOCALES).optional(),
});

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", async (_req, res) => {
    const startedAt = Date.now();
    try {
      const { rows } = await pool.query("select version() as server_version");
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        db: {
          reachable: true,
          serverVersion: rows[0].server_version,
          latencyMs: Date.now() - startedAt,
        },
      });
    } catch {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        db: { reachable: false },
      });
    }
  });

  app.use("/api/auth", authRouter);
  // /api/admin/applications (group B5). Mounted BEFORE adminRouter and scoped
  // to its own prefix, so adminRouter's own guards (requireAuth,
  // requirePasswordChanged, requireAdmin, plus an institution lookup that
  // costs a query) do not run twice for every request in this subtree.
  app.use("/api/admin/applications", adminApplicationsRouter);
  app.use("/api/admin", adminRouter);
  // /api/applications and /api/applications/status (group B4) — the only
  // UNAUTHENTICATED endpoints in the product that write to the database.
  // Mounted with no guard middleware in front of it on purpose; every check
  // lives inside the route, where it can return a real error code.
  app.use("/api", publicApplicationsRouter);
  // /api/me/credential, /api/me/today, /api/verify, /api/verify/anomalies
  // (roadmap Phase 6) — mounted at /api, not /api/me, since it also owns
  // the /api/verify* paths.
  app.use("/api", identityRouter);
  // /api/me/record, /api/me/subjects/:id, /api/me/archive,
  // /api/me/marks/:id/history (roadmap Phase 7).
  app.use("/api/me", recordRouter);
  // /api/teacher/classes, /api/gradebook, /api/assessments,
  // /api/marks[...] (roadmap Phase 8).
  app.use("/api", gradebookRouter);
  // /api/iter/messages (roadmap Phase 11, built early — see docs/decisions.md).
  app.use("/api", iterRouter);
  // /api/export, /api/export/logs (roadmap Phase 9).
  app.use("/api", exportRouter);
  // /api/credentials, /api/credentials/:id/attachment,
  // /api/credentials/:id/decision (roadmap Phase 10).
  app.use("/api", credentialsRouter);

  app.get(
    "/api/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
      const profile = await getUserProfile(req.auth.sub);
      if (!profile) throw new ApiError(401, "UNAUTHENTICATED");
      res.json(profile);
    }),
  );

  // Only `locale` persists here — theme/accent/background/iterPosition are
  // appearance, and appearance following a person to a shared school
  // computer is wrong (roadmap Phase 4), so the client keeps those four in
  // localStorage and never sends them here.
  app.get(
    "/api/me/preferences",
    requireAuth,
    asyncHandler(requirePasswordChanged),
    asyncHandler(async (req, res) => {
      if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
      const profile = await getUserProfile(req.auth.sub);
      if (!profile) throw new ApiError(401, "UNAUTHENTICATED");
      res.json({ locale: profile.locale, ...profile.preferences });
    }),
  );

  app.patch(
    "/api/me/preferences",
    requireAuth,
    asyncHandler(requirePasswordChanged),
    asyncHandler(async (req, res) => {
      if (!req.auth) throw new ApiError(401, "UNAUTHENTICATED");
      const parsed = preferencesPatchSchema.safeParse(req.body);
      if (!parsed.success) throw VALIDATION_FAILED({ allowed: LOCALES });
      if (parsed.data.locale) await setLocale(req.auth.sub, parsed.data.locale);
      res.status(204).end();
    }),
  );

  app.use(errorHandler);

  return app;
}
