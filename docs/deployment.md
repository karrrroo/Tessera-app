# Deploying Tessera

Two pieces, two hosts. Vercel builds and serves the Next.js frontend; the Express
backend runs somewhere that has a normal server and a disk. They are joined by a
single variable, `BACKEND_INTERNAL_URL`, and the browser never talks to the
backend directly — every `/api/*` request goes to the Vercel domain and is
rewritten server-side, so there is no CORS configuration anywhere in this app.

```
  browser
    |  https://your-app.vercel.app/api/...
    v
  Vercel  (Next.js)  ── rewrite, from next.config.ts ──►  backend host
                                                            |
                                                            ├─► Neon Postgres
                                                            ├─► Google Gemini (Iter)
                                                            └─► /app/backend/storage  (a real volume)
```

---

## The one thing that breaks deployments

**`BACKEND_INTERNAL_URL` is baked into the frontend at BUILD time, not read at
runtime.** `next.config.ts` returns the rewrite from `rewrites()`, and the result
is compiled into `.next/routes-manifest.json`. The same source built twice:

| build | baked destination |
| --- | --- |
| variable unset | `http://localhost:4000/api/:path*` |
| `BACKEND_INTERNAL_URL=http://localhost:4999` | `http://localhost:4999/api/:path*` |

So if it is set as a runtime-only variable, or not set at all, every `/api/*`
request from the browser is rewritten to `localhost:4000` — which inside a Vercel
function is nothing. Login fails, every screen is empty, and the admissions link
disappears from `/login` entirely, because that page asks the backend whether
applications are open and treats "cannot reach it" as "closed".

In the Vercel dashboard the variable must be enabled for the environment being
**built** (Production, and Preview if you use preview deployments), not only
exposed at runtime. A Vercel build with it unset now **fails on purpose**, with a
message saying this, rather than shipping a site where nothing works.

---

## 1. The backend

Any host that takes a Dockerfile. `backend/Dockerfile` is built **from the
repository root**, because this is an npm workspaces monorepo and the lockfile is
at the root:

```
docker build -f backend/Dockerfile -t tessera-backend .
```

On Railway or Render: point the service at this repo, set the Dockerfile path to
`backend/Dockerfile`, and leave the build context at the repository root.

Without Docker, a plain Node host works too:

```
npm ci
npm run build -w backend      # tsc -> backend/dist
cd backend && node dist/index.js
```

`npm start -w backend` also works and runs the build first.

### A persistent volume is not optional

`backend/src/lib/storage.ts` writes uploaded application transcripts and
credential attachments to `process.cwd()/storage`, i.e. **`/app/backend/storage`**
in the image. Nothing about them is in the database except the key. A container
filesystem is wiped on every deploy, so without a volume mounted there, every
document a family has ever uploaded is gone the next time you deploy.

Mount a persistent disk at `/app/backend/storage`.

### Backend environment

Copy the values from your local `backend/.env`. Never commit that file — it is
gitignored, and `.dockerignore` excludes it again so it cannot reach an image.

| variable | notes |
| --- | --- |
| `DATABASE_URL` | The Neon connection string. Keep the `-pooler` host: the pool holds connections open and the pooler is what makes that cheap. |
| `JWT_ACCESS_SECRET` | |
| `RESET_SECRET` | |
| `QR_HANDLE_KEY` | |
| `QR_SIGNING_SECRET` | |
| `SCANNER_API_KEY` | Handed to the scanner device, not to browsers. |
| `GOOGLE_AI_API_KEY` | Iter. Without it Iter is the only thing that breaks; the rest of the app is unaffected. |
| `APPLICATIONS_OPEN` | `true` to show the admissions link and accept submissions. |
| `NODE_ENV` | **`production`.** This is what removes the `/api/auth/dev/*` routes — verified: they answer 200/422 in development and 404 in production. |
| `PORT` | Usually injected by the host. The app reads it. |

Optional: `SHOW_DEMO_CREDENTIALS` is a **frontend** flag, and it must stay unset
in production or the login page offers the demo accounts to the public.

---

## 2. The frontend, on Vercel

Zero-config is more reliable than a hand-written `vercel.json` for Next.js, so
there isn't one. In the Vercel project settings:

- **Root Directory:** `frontend`
- **Framework preset:** Next.js (detected)
- **Build & install commands:** leave as detected — Vercel installs from the
  repository root, so the workspace resolves on its own.

### Frontend environment

| variable | value |
| --- | --- |
| `BACKEND_INTERNAL_URL` | The backend's public URL, no trailing slash, e.g. `https://tessera-api.up.railway.app`. **Must be available at build time.** |
| `SHOW_DEMO_CREDENTIALS` | Leave unset in production. |

---

## 3. Checking a deployment

In order, because each step depends on the one above:

1. `curl https://<backend>/api/health` — expects `{"status":"ok","db":{"reachable":true,...}}`. If `db.reachable` is false, `DATABASE_URL` is wrong or Neon is blocking the host.
2. `curl https://<backend>/api/auth/dev/demo-accounts` — expects **404**. A 200 means `NODE_ENV` is not `production` and the dev routes are exposed.
3. `curl https://<frontend>/api/health` — the same JSON, through the rewrite. If this fails while step 1 passed, `BACKEND_INTERNAL_URL` was not set at build time. Rebuild, do not just redeploy.
4. Load `/login`. The admissions link ("Դիմել ընդունելության համար") should be at the bottom of the card. If it is missing, read the Vercel function logs: the page now says exactly why, naming the URL it tried and whether the variable was set.
5. Sign in, then open Iter and ask something.

---

## Iter, and what it actually costs

Iter is the app's only AI feature. It calls Google Gemini through `@google/genai`
with `GOOGLE_AI_API_KEY`, model `gemini-3.5-flash`, and it works — measured
end to end at roughly three to four seconds.

The ceiling is the API key's plan, and it is low. The free tier's quota is
`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, value **20 — twenty requests
per day, per model.** Past that the upstream returns 429 and the app answers
`503 ITER_DAILY_QUOTA_SPENT`, which the panel renders as "the assistant's
questions for today are used up; it will be available again tomorrow" rather than
pretending to be briefly busy.

For a school, twenty questions a day is a demonstration, not a feature. Raising it
is a billing change on the Google Cloud project behind the key — there is no code
change that lifts it.

---

## Things that are still not solved

- **Q7 and Q10** — data residency and retention for minors' data. Both the
  `application` table and `iter_message` hold data about children and nothing
  deletes either on a schedule. The mechanisms exist (self-erase, admin hard
  delete, `on delete cascade`); the policy does not.
- **`sessions:prune`** — `device_session` grows by one row per token refresh by
  design. `npm run sessions:prune` clears rows revoked more than 30 days ago, and
  nothing runs it automatically. Give it a scheduled job on the backend host.
