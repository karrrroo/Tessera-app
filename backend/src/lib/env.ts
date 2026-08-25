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
