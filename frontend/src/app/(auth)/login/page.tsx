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
    if (!res.ok) return false;
    const body = (await res.json()) as { open?: unknown };
    return body.open === true;
  } catch {
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
