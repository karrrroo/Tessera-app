import { GoogleGenAI } from "@google/genai";
import { env } from "../../lib/env.js";
import { ApiError, NOT_FOUND, RATE_LIMITED } from "../../http/errors.js";
import { getRecord } from "../record/service.js";
import { getTeacherClasses } from "../gradebook/service.js";
import * as repo from "./repo.js";

const ITER_MESSAGE_EMPTY = () => new ApiError(422, "ITER_MESSAGE_EMPTY");
const ITER_UPSTREAM_ERROR = () => new ApiError(502, "ITER_UPSTREAM_ERROR");

type AuthClaims = { sub: string; role: "student" | "teacher" | "admin" };
type Locale = "hy" | "en" | "ru";
type ChatTurn = { role: "user" | "model"; text: string };

const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
const MODEL = "gemini-3.6-flash";

// SERVER-SIDE HISTORY, per group A5 — which reverses D-57.
//
// D-57 had deliberately kept every message out of the database so that no
// retention question about minors' conversations had to be answered, and the
// client replayed its own IndexedDB history on each request. A5 asks for
// per-user server-side history instead, and that is now what happens: each
// exchange is stored in `iter_message`, scoped to the user id from the TOKEN.
//
// Two notes that are not decoration. First, A5 says the stored reply "stays
// null"; with a live model that would make history show only half of every
// conversation, so the real reply is stored and D-173 records the divergence.
// Second, Q10 — the retention policy for exactly this data — is STILL
// unresolved, and nothing here deletes anything on a schedule. The user-facing
// erase path and the table's `on delete cascade` are the only removal
// mechanisms that exist.

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
  // `sessionId` was accepted by the validation schema and then dropped by the
  // route before it reached here; it is now carried through, because
  // `iter_message.session_id` is not nullable and one browser session's worth
  // of exchanges is the natural grouping for a conversation.
  input: { sessionId: string; text: string; screen?: string; locale: Locale; history: ChatTurn[] },
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

  // Stored AFTER the model answers, so a failed upstream call cannot leave a
  // half-exchange in a minor's history. A storage failure must not lose the
  // reply the user is already waiting on, so it degrades to an unstored id
  // rather than turning a successful answer into an error.
  try {
    const row = await repo.insertMessage({
      userId: auth.sub,
      sessionId: input.sessionId,
      screen: input.screen,
      locale: input.locale,
      body: text,
      reply: reply || null,
    });
    return { id: row.id, storedAt: row.createdAt, reply: reply || null };
  } catch (err) {
    console.error("[iter] could not store the exchange:", err);
    return { id: crypto.randomUUID(), storedAt: new Date().toISOString(), reply: reply || null };
  }
}

export type IterHistoryPage = {
  items: { id: string; body: string; reply: string | null; createdAt: string; screen: string | null }[];
  nextCursor: string | null;
};

/**
 * This user's own history, newest first.
 *
 * `auth.sub` comes from the verified token and is the ONLY source of the user
 * id — no parameter, query string or body field can change whose messages come
 * back. A5 is explicit about that, and repo.ts enforces it by offering no
 * query that omits the owner.
 */
export async function getHistory(
  auth: AuthClaims,
  opts: { cursor?: string; limit?: number },
): Promise<IterHistoryPage> {
  const limit = opts.limit ?? repo.HISTORY_PAGE_SIZE;
  const rows = await repo.listMessages(auth.sub, { cursor: opts.cursor, limit });
  return {
    items: rows.map((r) => ({
      id: r.id,
      body: r.body,
      reply: r.reply,
      createdAt: r.createdAt,
      screen: r.screen,
    })),
    // The cursor is the oldest row on this page, and is absent when the page
    // came back short — the only reliable "no more" signal a keyset page has.
    nextCursor: rows.length === limit ? rows[rows.length - 1].createdAt : null,
  };
}

/**
 * One message of this user's own. Returns NOT_FOUND — not FORBIDDEN — for a
 * message belonging to someone else, because confirming that a message exists
 * but is not yours is itself a disclosure. A5 accepts either; this picks the
 * one that reveals less.
 */
export async function getOwnMessage(auth: AuthClaims, id: string) {
  const row = await repo.findOwnMessage(auth.sub, id);
  if (!row) throw NOT_FOUND();
  return { id: row.id, body: row.body, reply: row.reply, createdAt: row.createdAt, screen: row.screen };
}

/** Erases this user's own history. The only deletion path a person controls. */
export async function clearHistory(auth: AuthClaims): Promise<{ deleted: number }> {
  return { deleted: await repo.deleteAllForUser(auth.sub) };
}
