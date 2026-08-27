// B4: "3 per hour per IP and per email -> RATE_LIMITED. This is an
// unauthenticated endpoint that writes to the database and accepts uploads —
// the most attackable surface in the app. Make it real, not a comment."
//
// So it is real, and it is enforced on BOTH keys independently: three from
// one address, and three for one email address however many addresses they
// arrive from. Either limit alone is trivially defeated — per-IP by a phone
// switching networks, per-email by inventing an address per attempt.
//
// In-memory, like Iter's own limiter (modules/iter/service.ts). That is a
// stated limitation, not an oversight: it resets when the process restarts
// and it does not coordinate across instances. A shared counter would need
// Redis, which this build does not have and D-4 already declined to add for
// storage. Documented in docs/decisions.md alongside the absence of a
// captcha, because the honest description of this control is "raises the
// cost of casual abuse", not "prevents abuse".

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;

/** hits[key] = timestamps within the window, oldest first. */
const hits = new Map<string, number[]>();

// Bounded so a flood of distinct keys cannot grow the map without limit —
// which would turn the rate limiter itself into the denial of service.
const MAX_TRACKED_KEYS = 20_000;

function prune(now: number): void {
  for (const [key, times] of hits) {
    const kept = times.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
  }
}

export type RateLimitVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Checks every key and, only if all of them are under the limit, records the
 * attempt against all of them.
 *
 * Check-all-then-record matters: recording as it goes would charge the IP for
 * an attempt that the email limit then rejected, so a blocked email address
 * would burn through an innocent address's quota.
 */
export function checkAndRecord(keys: string[], now = Date.now()): RateLimitVerdict {
  prune(now);

  let worstRetry = 0;
  for (const key of keys) {
    const times = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (times.length >= MAX_PER_WINDOW) {
      const retry = Math.ceil((WINDOW_MS - (now - times[0])) / 1000);
      worstRetry = Math.max(worstRetry, retry);
    }
  }
  if (worstRetry > 0) return { allowed: false, retryAfterSeconds: worstRetry };

  if (hits.size >= MAX_TRACKED_KEYS) {
    // Over the cap, drop the oldest-touched key rather than refusing service.
    const oldest = hits.keys().next();
    if (!oldest.done) hits.delete(oldest.value);
  }
  for (const key of keys) {
    const times = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    times.push(now);
    hits.set(key, times);
  }
  return { allowed: true };
}

/** Test/diagnostic seam — never called by the app. */
export function resetRateLimit(): void {
  hits.clear();
}

/**
 * The client address to rate-limit on.
 *
 * `req.ip` is only trustworthy when Express is told which proxies to trust;
 * behind Render's load balancer without `trust proxy` it is the balancer's
 * address, which would put every applicant in the world into one bucket and
 * lock the form after three submissions globally. So the header is read
 * explicitly and the LEFTMOST entry is ignored in favour of the rightmost —
 * X-Forwarded-For is client-appendable, so the left end is attacker-controlled
 * and only the entries the infrastructure itself appended can be believed.
 */
export function clientIp(headers: Record<string, unknown>, fallback: string | undefined): string {
  const raw = headers["x-forwarded-for"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string" && value.trim()) {
    const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return fallback ?? "unknown";
}
