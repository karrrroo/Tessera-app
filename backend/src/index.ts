import os from "node:os";

// Must be set before anything touches libuv's threadpool — argon2's async
// hash() is an N-API AsyncWorker queued on that same pool (default size 4),
// and Phase 5's bulk student import needs real parallelism across cores to
// hit its 600-rows-under-30s target (roadmap: "Argon2 is the bottleneck, not
// Postgres... hash across a worker pool sized to os.cpus().length - 1").
process.env.UV_THREADPOOL_SIZE = String(Math.max(4, os.cpus().length - 1));

import "dotenv/config";
import { env } from "./lib/env.js";
import { createApp } from "./http/app.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
