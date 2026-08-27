import { ApplyView } from "./apply-view";

// B3: "/apply stays public either way, so a shared link or a QR code works."
// When applications are closed this route renders a localised closed state
// rather than 404ing — a printed QR code on a poster outlives an admissions
// window, and landing on a clear "closed for now" is the difference between a
// school that looks shut and one that looks broken.
//
// The open/closed decision is made HERE, on the server, and asked of the
// backend rather than read from a second copy of APPLICATIONS_OPEN. One
// source of truth: the same flag that decides whether the POST will be
// accepted decides whether the form is rendered, so the two can never
// disagree. Unreachable backend is treated as closed, because offering a form
// that cannot submit is worse than saying admission is closed.
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

export default async function ApplyPage() {
  return <ApplyView open={await applicationsOpen()} />;
}
