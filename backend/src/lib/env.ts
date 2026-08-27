import { z } from "zod";

export class EnvValidationError extends Error {
  constructor(issues: string) {
    super(`Invalid environment configuration:\n${issues}`);
    this.name = "EnvValidationError";
  }
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required (see .env.example)" })
    .regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a postgres:// connection string"),
  JWT_ACCESS_SECRET: z
    .string({ required_error: "JWT_ACCESS_SECRET is required (see .env.example)" })
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  RESET_SECRET: z
    .string({ required_error: "RESET_SECRET is required (see .env.example)" })
    .min(32, "RESET_SECRET must be at least 32 characters"),
  // Phase 6 (identity/QR) — two independent keys, not one, so that a leak of
  // the verifier's signing key alone can't be used to mint new handles, and
  // vice versa (roadmap "the payload is an opaque handle plus a truncated MAC").
  QR_HANDLE_KEY: z
    .string({ required_error: "QR_HANDLE_KEY is required (see .env.example)" })
    .min(32, "QR_HANDLE_KEY must be at least 32 characters"),
  QR_SIGNING_SECRET: z
    .string({ required_error: "QR_SIGNING_SECRET is required (see .env.example)" })
    .min(32, "QR_SIGNING_SECRET must be at least 32 characters"),
  // Shared door-reader key (roadmap: "a door reader is not a person" — not a
  // user role, checked by requireScannerKey, not requireAuth).
  SCANNER_API_KEY: z
    .string({ required_error: "SCANNER_API_KEY is required (see .env.example)" })
    .min(32, "SCANNER_API_KEY must be at least 32 characters"),
  // Phase 11 (Iter) — Gemini API key for generating real replies.
  GOOGLE_AI_API_KEY: z.string({ required_error: "GOOGLE_AI_API_KEY is required (see .env.example)" }).min(1),
  // Group B (admissions) — gates the "Apply for admission" link on the login
  // screen. Default false, and deliberately not a required variable: an
  // existing deployment that never sets it stays closed rather than silently
  // starting to accept applications about children on upgrade.
  //
  // /apply itself stays reachable either way (it shows a localised closed
  // state when this is false), so a shared link or a QR code keeps working
  // and the closed message is what an applicant sees instead of a 404.
  APPLICATIONS_OPEN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new EnvValidationError(issues);
  }
  return parsed.data;
}

export const env = loadEnv();
