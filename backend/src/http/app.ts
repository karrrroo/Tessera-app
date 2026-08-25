import express from "express";
import cookieParser from "cookie-parser";
import { pool } from "../db/client.js";
import { authRouter } from "../modules/auth/routes.js";
import { requireAuth } from "./middleware/require-auth.js";
import { asyncHandler } from "./async-handler.js";
import { ApiError } from "./errors.js";
import { errorHandler } from "./error-handler.js";
import { getUserProfile } from "../modules/auth/repo.js";

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

  app.use(errorHandler);

  return app;
}
