import express from "express";
import { pool } from "../db/client.js";

export function createApp() {
  const app = express();

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

  return app;
}
