import { z } from "zod";

// The five category values actually used in tessera-seed.sql — the design
// source and roadmap never enumerate a fixed list (the schema column is
// free `text`), so the real seed data is the closest thing to an
// authoritative set. See docs/decisions.md.
export const CREDENTIAL_CATEGORIES = ["olympiad", "course", "sport", "volunteering", "art"] as const;
export type CredentialCategory = (typeof CREDENTIAL_CATEGORIES)[number];

export const credentialCreateSchema = z.object({
  category: z.enum(CREDENTIAL_CATEGORIES),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  subjectId: z.string().uuid().optional(),
});

export const credentialListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "declined"]).optional(),
  subjectId: z.string().uuid().optional(),
  cursor: z.string().optional(),
});

// `reason` is deliberately not validated as non-empty here — CR-4's
// "empty or whitespace is not a reason" rule is a service-layer concern
// with its own named error code (CREDENTIAL_REASON_REQUIRED), the same
// split gradebook's MARK_REASON_REQUIRED already uses.
export const credentialDecisionSchema = z.object({
  decision: z.enum(["approved", "declined"]),
  reason: z.string().optional(),
});
