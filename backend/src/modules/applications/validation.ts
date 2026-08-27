import { z } from "zod";

// Group B4: "Validate server-side always. Client validation is convenience,
// never a gate." Everything the public form can send is bounded here, and
// nothing about the shape of this schema depends on the client having run
// its own checks first.
//
// The field lengths are not decoration. This is the only unauthenticated
// endpoint in the product that writes to the database, so an unbounded text
// column is a free write amplifier for anyone who finds it.

/** The one school that accepts applications. B2: hardcoded, not data. */
export const MAIN_SCHOOL = "main";

/** Every school the form offers. Only MAIN_SCHOOL accepts applications. */
export const SCHOOL_CHOICES = [MAIN_SCHOOL, "north", "south", "regional"] as const;

/** Streams are the same everywhere; the labels live in the locale files. */
export const STREAM_CHOICES = ["general", "science", "humanities", "languages"] as const;

export const MOTIVATION_MAX = 1000;

// A date, not a datetime, and it has to be a real one. `z.coerce.date()`
// would accept "2010-13-45" by rolling it over into 2011; this does not.
const birthDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "birthDate is not a real date")
  .refine((v) => {
    // A plausible school applicant. Rejecting a 90-year-old or a date in the
    // future is not paperwork pedantry: this table holds data about children,
    // and a wildly wrong birth date is the clearest signal that a submission
    // is junk or a typo that will follow the child into their record.
    const year = Number(v.slice(0, 4));
    const thisYear = new Date().getUTCFullYear();
    return year >= thisYear - 25 && year <= thisYear;
  }, "birthDate is outside the plausible range for an applicant");

export const applicationCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  birthDate,
  email: z.string().trim().email().max(254),
  // Optional, and an empty string counts as absent — an untouched optional
  // input posts "" rather than omitting the field.
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
  schoolChoice: z.enum(SCHOOL_CHOICES),
  streamChoice: z.enum(STREAM_CHOICES),
  motivation: z
    .string()
    .trim()
    .max(MOTIVATION_MAX)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;

export const applicationListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional().default("pending"),
});

export const applicationRejectSchema = z.object({
  // B5: "REJECT takes an optional reason and sends nothing to the applicant
  // unless the admin explicitly chooses to." Nothing here sends anything;
  // the reason is stored for the school's own record only.
  reason: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : undefined)),
});
