// In-memory only. The durable half of lockout (user.locked_until) is a real
// DB column and survives a restart; only the "how many failures so far, this
// window" counter is ephemeral — losing it on restart just grants a few extra
// attempts, not a security-critical persistence gap (unlike the reset-token
// design, which is why that one got asked about explicitly).

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 6;
const FORGOT_COOLDOWN_MS = 60 * 1000;

const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const lastForgotRequestAt = new Map<string, number>();

export function recordFailedLogin(identifier: string): { shouldLock: boolean } {
  const now = Date.now();
  const existing = loginAttempts.get(identifier);
  if (!existing || now - existing.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(identifier, { count: 1, windowStart: now });
    return { shouldLock: false };
  }
  existing.count += 1;
  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.delete(identifier);
    return { shouldLock: true };
  }
  return { shouldLock: false };
}

export function clearFailedLogins(identifier: string): void {
  loginAttempts.delete(identifier);
}

export function checkForgotCooldown(email: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const last = lastForgotRequestAt.get(email);
  if (last && now - last < FORGOT_COOLDOWN_MS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((FORGOT_COOLDOWN_MS - (now - last)) / 1000) };
  }
  lastForgotRequestAt.set(email, now);
  return { allowed: true, retryAfterSeconds: 0 };
}
