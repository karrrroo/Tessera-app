import { LoginView } from "./login-view";

// Deliberately a server component, not "use client" — SHOW_DEMO_CREDENTIALS
// is read once per request, on the server, and its value never reaches the
// browser bundle at all (unlike a NEXT_PUBLIC_ var). Demo and production are
// the same build (Phase 15 has no separate "demo" environment), so this
// decision has to happen before the page ever renders, not be hidden with
// CSS afterward — see .env.example.
//
// APPLICATIONS_OPEN is asked of the BACKEND rather than read from a second
// copy of the same variable here. B3 requires that when applications are
// closed the link is "not rendered server-side at all", and the backend is
// what actually enforces the gate — two independent copies of one flag can
// disagree, and the failure mode of disagreeing is a visible "Apply" link
// leading to an endpoint that rejects every submission. One source of truth,
// asked at render time. A failure to reach it is treated as closed: showing
// no link is always safe, showing one that cannot work is not.
async function applicationsOpen(): Promise<boolean> {
  const base = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${base}/api/applications/status`, { cache: "no-store" });
    if (!res.ok) {
      console.warn(
        `[login] the admissions link is hidden because ${base}/api/applications/status answered ${res.status}. ` +
          "That is a REACHABLE backend refusing, not a closed intake — check APPLICATIONS_OPEN and the application table.",
      );
      return false;
    }
    const body = (await res.json()) as { open?: unknown };
    return body.open === true;
  } catch (err) {
    // Next.js probes this route during a build to decide whether it can be
    // prerendered; the `no-store` fetch above makes that probe throw
    // DynamicServerError, which is how the route gets marked dynamic (verified:
    // /login is absent from .next/prerender-manifest.json, so it really is
    // rendered per request and the link is re-evaluated on every load). That
    // throw says nothing about the backend, so it must not be reported as if
    // the backend were down — a misleading line in a deploy log is exactly what
    // costs somebody an afternoon.
    const message = err instanceof Error ? err.message : String(err);
    if (/Dynamic server usage/i.test(message)) return false;

    // Failing closed is still right — a link that leads to an endpoint which
    // rejects every submission is worse than no link. What was wrong is that it
    // failed closed SILENTLY, so "the backend is unreachable" looked exactly
    // like "admissions are closed", with nothing anywhere to tell them apart.
    //
    // This is the deployment trap it hid: BACKEND_INTERNAL_URL is unset on a
    // fresh Vercel project, so this fetch goes to localhost:4000 inside a
    // serverless function, throws, and the admissions link vanishes with no
    // explanation. It was reported as "the apply part is missing on Vercel",
    // and every other /api/* call was equally broken by the same unset
    // variable — this is just the only symptom visible without signing in.
    console.warn(
      `[login] the admissions link is hidden because ${base}/api/applications/status could not be reached ` +
        `(${message}). ` +
        (process.env.BACKEND_INTERNAL_URL
          ? "BACKEND_INTERNAL_URL is set, so the backend itself is down or blocked."
          : "BACKEND_INTERNAL_URL is NOT SET, so this defaulted to localhost — set it to the backend's public URL."),
    );
    return false;
  }
}

export default async function LoginPage() {
  return (
    <LoginView
      showDemo={process.env.SHOW_DEMO_CREDENTIALS === "true"}
      applicationsOpen={await applicationsOpen()}
    />
  );
}
