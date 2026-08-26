import { GoogleGenAI } from "@google/genai";
import { env } from "../../lib/env.js";
import { ApiError, RATE_LIMITED } from "../../http/errors.js";
import { getRecord } from "../record/service.js";
import { getTeacherClasses } from "../gradebook/service.js";

const ITER_MESSAGE_EMPTY = () => new ApiError(422, "ITER_MESSAGE_EMPTY");
const ITER_UPSTREAM_ERROR = () => new ApiError(502, "ITER_UPSTREAM_ERROR");

type AuthClaims = { sub: string; role: "student" | "teacher" | "admin" };
type Locale = "hy" | "en" | "ru";
type ChatTurn = { role: "user" | "model"; text: string };

const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
const MODEL = "gemini-3.6-flash";

// No server-side message persistence by design (D-54-adjacent decision,
// made outside the roadmap's own original plan for an `iter_message`
// table): this build never alters the database schema, and the roadmap's
// own IT-11/S-14 note flags storing minors' conversations as an open legal
// question this project isn't positioned to resolve. History lives
// client-side only (IndexedDB) and is replayed on every request instead.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 12;
const sendTimestamps = new Map<string, number[]>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const recent = (sendTimestamps.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000);
    throw RATE_LIMITED(retryAfterSeconds);
  }
  recent.push(now);
  sendTimestamps.set(userId, recent);
}

function subjectName(s: { nameHy: string; nameEn: string; nameRu: string }, locale: Locale): string {
  return locale === "hy" ? s.nameHy : locale === "ru" ? s.nameRu : s.nameEn;
}

function localeName(locale: Locale): string {
  return locale === "hy" ? "Armenian" : locale === "ru" ? "Russian" : "English";
}

// Best-effort, read-only context about the caller's own data — never a
// different student's or a different teacher's. A failure here degrades to
// no context rather than blocking the chat; Iter answering generically is
// better than Iter not answering.
async function buildContext(auth: AuthClaims, locale: Locale): Promise<string> {
  try {
    if (auth.role === "student") {
      const record = await getRecord(auth);
      if (record.subjects.length === 0) return "The student has no subjects on record yet.";
      const lines = record.subjects.map((s) => {
        const name = subjectName(s, locale);
        const avg = s.average ?? "no marks yet";
        const trend = s.trend ?? "not enough marks to tell";
        return `- ${name}: average ${avg}, trend ${trend}, taught by ${s.teacherName}, ${s.marks.length} mark(s) this term`;
      });
      return `The student's current term is "${record.term.label}", class ${record.class.label}. Their subjects:\n${lines.join("\n")}`;
    }
    if (auth.role === "teacher") {
      const classes = await getTeacherClasses(auth);
      if (classes.length === 0) return "The teacher has no assigned classes on record yet.";
      const lines = classes.map((c) => {
        const name = locale === "hy" ? c.subjectNameHy : locale === "ru" ? c.subjectNameRu : c.subjectNameEn;
        return `- ${c.classLabel} ${name}: ${c.studentCount} students, ${c.draftCount} unpublished draft mark(s)`;
      });
      return `The teacher's classes:\n${lines.join("\n")}`;
    }
    return "";
  } catch {
    return "";
  }
}

function buildSystemInstruction(role: AuthClaims["role"], locale: Locale, context: string): string {
  return [
    "You are Iter, the assistant built into Tessera, a school-records app used by K-12 students, teachers, and administrators in Armenia.",
    "You can only see the data provided below about the current user's own record or classes — you have no access to any other student's or teacher's data.",
    "You cannot change grades, publish marks, submit or decide credential requests, or send messages to anyone on the user's behalf. You can only answer questions and explain what you see.",
    "If asked to do something you cannot do, say so plainly and suggest the right screen in the app instead.",
    "Be concise and warm. Use specific numbers when you have them. Do not invent data that isn't in the context below.",
    `The current user's role is ${role}.`,
    `Respond in the same language the user writes in; if that is unclear, respond in ${localeName(locale)}.`,
    context ? `Context:\n${context}` : "No record data is available right now — answer generally and say so if the question needs specific numbers.",
  ].join("\n");
}

export async function sendMessage(
  auth: AuthClaims,
  input: { text: string; screen?: string; locale: Locale; history: ChatTurn[] },
) {
  const text = input.text.trim();
  if (!text) throw ITER_MESSAGE_EMPTY();
  checkRateLimit(auth.sub);

  const context = await buildContext(auth, input.locale);
  const systemInstruction = buildSystemInstruction(auth.role, input.locale, context);

  const contents = [
    ...input.history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: "user" as const, parts: [{ text }] },
  ];

  let reply: string;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction },
    });
    reply = response.text?.trim() || "";
  } catch (err) {
    console.error("[iter] Gemini call failed:", err);
    throw ITER_UPSTREAM_ERROR();
  }

  return {
    id: crypto.randomUUID(),
    storedAt: new Date().toISOString(),
    reply: reply || null,
  };
}
