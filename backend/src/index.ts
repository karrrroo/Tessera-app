import "dotenv/config";
import { env } from "./lib/env.js";
import { createApp } from "./http/app.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
