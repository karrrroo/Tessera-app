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

// The age window for an applicant, in years, deliberately WIDER than any real
// intake. Armenian schooling starts at six, so a genuine application is for a
// child of about five upward; the floor is set at four so that no real
// applicant can ever be turned away by it, while an infant or a
// date-of-submission typo is refused. Raise the floor if the school wants a
// stricter intake — it is one number and the browser-side `min`/`max` on the
// form is derived from the same pair.
const MIN_AGE_YEARS = 4;
const MAX_AGE_YEARS = 25;

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
    //
    // Compared as DATES, not as years. The previous version tested
    // `year >= thisYear - 25 && year <= thisYear`, which fails at both ends of
    // its own stated intent: a date later today this year passed the
    // "no future dates" rule it claims to enforce, and an applicant aged ZERO
    // passed as plausible. A real submission in this database has a birth date
    // of 2026-08-08 — an infant — which is how the gap was found.
    const [y, m, d] = v.split("-").map(Number);
    const born = Date.UTC(y, m - 1, d);
    const now = new Date();
    const oldest = Date.UTC(now.getUTCFullYear() - MAX_AGE_YEARS, now.getUTCMonth(), now.getUTCDate());
    const youngest = Date.UTC(now.getUTCFullYear() - MIN_AGE_YEARS, now.getUTCMonth(), now.getUTCDate());
    // `born <= youngest` also rules out any future date, since `youngest` is
    // years in the past.
    return born >= oldest && born <= youngest;
  }, "birthDate is outside the plausible range for an applicant");

export const applicationCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  birthDate,
  email: z.string().trim().email().max(254),
  // Optional, and an empty string counts as absent — an untouched optional
  // input posts "" rather than omitting the field. When it IS given it has to
  // be dialable: the same real submission that carried an infant's birth date
  // carried "4ybebbu" as a phone number, and the entire point of this field is
  // that the school can reach the family. Only a digit count is required, and
  // only five of them, so every real international format survives (+374 10
  // 123456, (010) 12-34-56, 077-123456) while free text does not.
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || (v.match(/[0-9]/g) ?? []).length >= 5,
      "phone must contain at least 5 digits"),
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
