# The Express backend, for any host that takes a Dockerfile (Railway, Render,
# Fly). The Next.js frontend is NOT in here — it goes to Vercel, which builds it
# itself; see docs/deployment.md.
#
# Built from the REPOSITORY ROOT, not from this directory, because this is an
# npm workspaces monorepo and the lockfile lives at the root:
#
#   docker build -f backend/Dockerfile -t tessera-backend .
#
# On Railway/Render, set the Dockerfile path to `backend/Dockerfile` and leave
# the build context at the repository root.

# ---------- build ----------
# node:24 matches the version this was developed and tested on. The full image
# rather than -slim for this stage: argon2 is a native module, and if npm cannot
# find a prebuilt binary for the platform it compiles from source and needs a
# toolchain. The runtime stage is slim, so the toolchain does not ship.
FROM node:24 AS build
WORKDIR /app

# Manifests first, so a dependency-only change is the only thing that busts this
# layer. Every workspace's package.json has to be present or npm ci refuses the
# lockfile as out of sync.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --include-workspace-root

# Sources. `scripts/` comes along because the root package.json's lifecycle
# scripts reference it and a missing file there fails the install in confusing
# ways.
COPY backend backend
COPY scripts scripts

# tsc -> backend/dist. Not `npm start`, which would also try to run the server.
RUN npm run build -w backend

# Drop everything only the build needed (typescript, tsx, drizzle-kit).
RUN npm prune --omit=dev --include-workspace-root

# ---------- runtime ----------
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

# Runs as an unprivileged user. The node images already ship a `node` user;
# the storage directory is created and chowned before dropping to it, because
# a container that cannot write its own upload directory fails at the first
# application rather than at boot.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
RUN mkdir -p /app/backend/storage/applications /app/backend/storage/credentials \
    && chown -R node:node /app/backend/storage
USER node

# UPLOADS LIVE HERE AND THEY ARE NOT IN THE DATABASE. storage.ts writes
# application transcripts and credential attachments under
# `process.cwd()/storage`, which is /app/backend/storage given the WORKDIR
# below. A container filesystem is wiped on every deploy, so this MUST have a
# persistent volume mounted on it or every previously uploaded document is gone
# the next time you deploy. docs/deployment.md says the same thing louder.
VOLUME ["/app/backend/storage"]
WORKDIR /app/backend

# The host supplies PORT; the app reads it (verified: PORT=4003 made it listen
# on 4003). 4000 is only the local default.
EXPOSE 4000

# `node dist/index.js`, not `npm start` — npm start now runs a build first,
# which is right for a bare host and pointless in an image that is already
# built, and npm as PID 1 swallows signals.
CMD ["node", "dist/index.js"]
