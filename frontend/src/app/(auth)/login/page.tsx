import { LoginView } from "./login-view";

// Deliberately a server component, not "use client" — SHOW_DEMO_CREDENTIALS
// is read once per request, on the server, and its value never reaches the
// browser bundle at all (unlike a NEXT_PUBLIC_ var). Demo and production are
// the same build (Phase 15 has no separate "demo" environment), so this
// decision has to happen before the page ever renders, not be hidden with
// CSS afterward — see .env.example.
export default function LoginPage() {
  return <LoginView showDemo={process.env.SHOW_DEMO_CREDENTIALS === "true"} />;
}
