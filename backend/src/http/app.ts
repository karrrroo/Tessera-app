import express from "express";

export function createApp() {
  const app = express();

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}
