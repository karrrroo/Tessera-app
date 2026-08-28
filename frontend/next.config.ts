import type { NextConfig } from "next";

// WHERE THE BACKEND IS. Read here, and this is the single most important thing
// to understand about deploying this app: the value is BAKED INTO THE BUILD.
//
// `rewrites()` runs when the config is evaluated, and its result is compiled
// into .next/routes-manifest.json. Proved rather than assumed — the same source
// built twice:
//
//   built with the variable unset                     -> http://localhost:4000/api/:path*
//   built with BACKEND_INTERNAL_URL=http://…:4999      -> http://localhost:4999/api/:path*
//
// So setting BACKEND_INTERNAL_URL as a RUNTIME-only variable does nothing at
// all. On Vercel it has to be present for the build, or every /api/* request
// the browser makes is rewritten to localhost:4000 — which, inside a Vercel
// function, is nothing. That is exactly how this app came to be deployed with
// no working login and no admissions link, reported as "the apply part is
// missing on Vercel".
//
// Good news, also measured: the rewrite passes `x-forwarded-for` through
// unchanged, so the per-IP application rate limit still sees the real
// applicant's address and not the proxy's.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

// On Vercel, localhost can never be right, so this is a hard failure rather
// than a warning. A production build whose entire API layer points at
// localhost:4000 is not a usable artifact, and failing the build says so at
// the one moment somebody is watching the log — instead of shipping a site
// where every screen is silently empty.
if (process.env.VERCEL && !process.env.BACKEND_INTERNAL_URL) {
  throw new Error(
    "BACKEND_INTERNAL_URL is not set, and this is a Vercel build.\n" +
      "Every /api/* request would be rewritten to http://localhost:4000, which does not exist inside a Vercel function.\n" +
      "Set BACKEND_INTERNAL_URL to the backend's public URL in the Vercel project's Environment Variables, " +
      "make sure it is enabled for the environment being built (not just for runtime), and redeploy.\n" +
      "See docs/deployment.md.",
  );
}

// Self-hosting with the default is legitimate (that is the local setup), so
// this is only a warning — but a loud one during a production build, because
// the same mistake is just as fatal on any other host.
if (process.env.NODE_ENV === "production" && !process.env.BACKEND_INTERNAL_URL) {
  console.warn(
    "[next.config] BACKEND_INTERNAL_URL is not set — this production build will send every /api/* request to " +
      "http://localhost:4000. That is correct only if the backend really runs on the same machine as this server.",
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
