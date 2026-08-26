import express from "express";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { pool } from "../db/client.js";
import { authRouter } from "../modules/auth/routes.js";
import { adminRouter } from "../modules/admin/routes.js";
import { requireAuth } from "./middleware/require-auth.js";
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
  app.use("/api/admin", adminRouter);

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
