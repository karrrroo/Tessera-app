"use client";

import { useState } from "react";
import Link from "next/link";
import { GradientMesh } from "@/components/design/gradient-mesh";
import { Glass } from "@/components/design/glass";
import { LanguagePill } from "@/components/auth/language-pill";
import { useT, interpolate } from "@/i18n/locale-provider";
import { submitApplication, ApplicationError } from "@/lib/api/applications";

// B4 DESIGN: "a public page, so it uses the LOGIN screen's language —
// continuous mesh, glass card, language pill. Not the admin flat treatment."
// So this reuses the exact same primitives the login screen does, including a
// single full-bleed mesh rather than a column split.
//
// One mesh instance, not login's two: login needs a desktop instance and a
// mobile one because its desktop layout is a two-column grid and its mobile
// layout is a centred card. This screen is a centred card at every width, so
// the same mesh serves both and there is nothing to keep in step.

const MAIN_SCHOOL = "main";
const MOTIVATION_MAX = 1000;
const MAX_BYTES = 5 * 1024 * 1024;

const SCHOOLS = [MAIN_SCHOOL, "north", "south", "regional"] as const;
const STREAMS = ["general", "science", "humanities", "languages"] as const;

// Backend codes to locale keys. The backend never sends prose (B4), so this
// is the only place an applicant-facing sentence is chosen.
const ERROR_KEY: Record<string, keyof ReturnType<typeof useT>["apply"]> = {
  VALIDATION_FAILED: "errRequired",
  APPLICATIONS_CLOSED: "errClosed",
  APPLICATION_SCHOOL_NOT_ACCEPTING: "errSchoolNotAccepting",
  APPLICATION_DUPLICATE_PENDING: "errDuplicate",
  APPLICATION_FILE_TOO_LARGE: "errFileSize",
  APPLICATION_FILE_TYPE_INVALID: "errFileType",
  RATE_LIMITED: "errRateLimited",
};

type Status = "editing" | "sending" | "sent";

export function ApplyView({ open }: { open: boolean }) {
  const t = useT();
  const [status, setStatus] = useState<Status>("editing");
  const [errorKey, setErrorKey] = useState<keyof typeof t.apply | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [schoolChoice, setSchoolChoice] = useState<string>(MAIN_SCHOOL);
  const [streamChoice, setStreamChoice] = useState<string>("general");
  const [motivation, setMotivation] = useState("");
  const [transcript, setTranscript] = useState<File | null>(null);

  // B2: only the main school accepts applications, and selecting another
  // disables submit rather than taking data the school cannot process. "A
  // form that swallows a child's data and does nothing with it is worse than
  // a disabled button."
  const schoolAccepts = schoolChoice === MAIN_SCHOOL;
  const required = firstName.trim() && lastName.trim() && birthDate && email.trim();
  const canSubmit = Boolean(required) && schoolAccepts && status === "editing";

  const schoolLabel = (id: string) =>
    id === "main" ? t.apply.schoolMain
    : id === "north" ? t.apply.schoolNorth
    : id === "south" ? t.apply.schoolSouth
    : t.apply.schoolRegional;

  const streamLabel = (id: string) =>
    id === "general" ? t.apply.streamGeneral
    : id === "science" ? t.apply.streamScience
    : id === "humanities" ? t.apply.streamHumanities
    : t.apply.streamLanguages;

  function pickFile(file: File | null) {
    setErrorKey(null);
    if (!file) {
      setTranscript(null);
      return;
    }
    // Client-side checks are convenience only — the backend sniffs the bytes
    // and enforces the size regardless of what happens here (B4).
    if (file.size > MAX_BYTES) {
      setErrorKey("errFileSize");
      setTranscript(null);
      return;
    }
    setTranscript(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setErrorKey(null);
    try {
      await submitApplication(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate,
          email: email.trim(),
          phone: phone.trim() || undefined,
          schoolChoice,
          streamChoice,
          motivation: motivation.trim() || undefined,
        },
        transcript,
      );
      setStatus("sent");
    } catch (err) {
      const code = err instanceof ApplicationError ? err.code : "UNKNOWN";
      setErrorKey(ERROR_KEY[code] ?? "errGeneric");
      setStatus("editing");
    }
  }

  const label = (text: string, optional?: boolean) => (
    <span className="mb-1 block text-[12.5px]" style={{ color: "var(--ink-2)" }}>
      {text}
      {optional && (
        <span style={{ color: "var(--ink-3)" }}> · {t.apply.optional}</span>
      )}
    </span>
  );

  const fieldStyle = {
    borderColor: "var(--hair)",
    background: "var(--surface2)",
    color: "var(--ink)",
  } as const;
  const fieldClass = "w-full rounded-2xl border px-3.5 py-2.5 text-sm";

  // min-w-0 on the card is load-bearing. As a grid item it gets `min-width:
  // auto`, which refuses to shrink below its own min-content width — and that
  // width is set by the header row, where a fixed-114px language pill sits
  // next to a title whose longest Armenian word does not break. Measured at
  // 390px before the fix: the card came out 372px wide inside a 342px content
  // box and pushed the whole page 6px sideways.
  const card = (
    <Glass radius={28} className="login-card relative z-10 min-w-0 w-full max-w-[520px] space-y-5 p-8">
      {/* flex-wrap so the pill drops below the title rather than competing
          with it for width on a narrow screen. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="font-serif text-xl font-semibold" style={{ color: "var(--ink)" }}>
            {open ? t.apply.title : t.apply.closedTitle}
          </h1>
          <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            {open ? t.apply.sub : t.apply.closedBody}
          </p>
        </div>
        <LanguagePill />
      </div>

      {!open ? (
        <Link href="/login" className="inline-block text-[13px] underline underline-offset-2" style={{ color: "var(--ink-3)" }}>
          {t.apply.backToLogin}
        </Link>
      ) : status === "sent" ? (
        // B4: "a localised confirmation that the school will be in contact.
        // Do not promise a timeline you cannot guarantee." No dates here.
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: "var(--ok)" }}>
            {t.apply.successTitle}
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {t.apply.successBody}
          </p>
          <Link href="/login" className="inline-block text-[13px] underline underline-offset-2" style={{ color: "var(--ink-3)" }}>
            {t.apply.backToLogin}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            <label>
              {label(t.apply.firstName)}
              <input className={fieldClass} style={fieldStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
            </label>
            <label>
              {label(t.apply.lastName)}
              <input className={fieldClass} style={fieldStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
            </label>
            <label>
              {label(t.apply.birthDate)}
              <input className={fieldClass} style={fieldStyle} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
            </label>
            <label>
              {label(t.apply.email)}
              <input className={fieldClass} style={fieldStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label>
              {label(t.apply.phone, true)}
              <input className={fieldClass} style={fieldStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </label>
            <label>
              {label(t.apply.stream)}
              <select className={fieldClass} style={fieldStyle} value={streamChoice} onChange={(e) => setStreamChoice(e.target.value)}>
                {STREAMS.map((s) => (
                  <option key={s} value={s}>
                    {streamLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            {label(t.apply.school)}
            <select className={fieldClass} style={fieldStyle} value={schoolChoice} onChange={(e) => setSchoolChoice(e.target.value)}>
              {SCHOOLS.map((s) => (
                <option key={s} value={s}>
                  {schoolLabel(s)}
                </option>
              ))}
            </select>
          </label>

          {!schoolAccepts && (
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--warning-ink, var(--ink))" }} role="alert">
              {t.apply.schoolNotAccepting}
            </p>
          )}

          <label className="block">
            {label(t.apply.motivation, true)}
            <textarea
              className={`${fieldClass} resize-none`}
              style={fieldStyle}
              rows={4}
              maxLength={MOTIVATION_MAX}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
            />
            <span className="mt-1 block text-right text-[11px]" style={{ color: "var(--ink-3)" }}>
              {interpolate(t.apply.charsLeft, { count: MOTIVATION_MAX - motivation.length })}
            </span>
          </label>

          <div>
            {label(t.apply.transcript, true)}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[12.5px]"
              style={{ color: "var(--ink-2)" }}
            />
            <span className="mt-1 block text-[11px]" style={{ color: "var(--ink-3)" }}>
              {t.apply.transcriptHint}
            </span>
          </div>

          {errorKey && (
            <p className="text-[12.5px]" style={{ color: "var(--danger)" }} role="alert">
              {t.apply[errorKey]}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-45"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {status === "sending" ? t.apply.submitting : t.apply.submit}
          </button>

          <p className="text-center">
            <Link href="/login" className="text-[13px] underline underline-offset-2" style={{ color: "var(--ink-3)" }}>
              {t.apply.backToLogin}
            </Link>
          </p>
        </form>
      )}
    </Glass>
  );

  return (
    <div className="relative min-h-screen bg-base">
      {/* The mesh is fixed rather than absolute: this page scrolls (the form is
          taller than a phone), and an absolutely-positioned mesh would scroll
          away and leave flat --bg-base behind the lower half of the card. */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
        <GradientMesh />
      </div>
      <div className="relative grid min-h-screen place-items-center p-6 tablet:p-8">{card}</div>
    </div>
  );
}
