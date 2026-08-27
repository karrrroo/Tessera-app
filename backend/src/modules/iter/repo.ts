import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { iterMessage } from "../../db/schema.js";

// Iter's per-user history (group A5).
//
// EVERY function here takes a userId and puts it in the WHERE clause. There is
// no function that reads a message by id alone, deliberately — an endpoint
// cannot leak one user's conversation to another if the query layer offers no
// way to ask for a message without saying whose it is. A5 is explicit: "Scope
// every query by the user id from the TOKEN. Never from a parameter, never
// from a query string."
//
// These are minors' messages. Q10 (retention) is unresolved and nothing here
// deletes anything on a schedule; the table's `on delete cascade` on user_id
// is the only guarantee, and it only fires when a user is erased.

export type IterMessageRow = typeof iterMessage.$inferSelect;

/** The default page size for history; A5's cursor is keyset, not offset. */
export const HISTORY_PAGE_SIZE = 30;

export async function insertMessage(input: {
  userId: string;
  sessionId: string;
  screen?: string;
  locale: "hy" | "en" | "ru";
  body: string;
  reply: string | null;
}): Promise<IterMessageRow> {
  const [row] = await db
    .insert(iterMessage)
    .values({
      userId: input.userId,
      sessionId: input.sessionId,
      screen: input.screen ?? null,
      locale: input.locale,
      body: input.body,
      reply: input.reply,
    })
    .returning();
  return row;
}

/**
 * One page of this user's own history, newest first.
 *
 * Keyset on `created_at` rather than an offset: an offset page shifts under
 * its own reader every time a new message is stored, which for a chat log —
 * where new rows arrive at exactly the end being paged from — means silently
 * skipped or repeated messages. The cursor is the `created_at` of the oldest
 * row already seen.
 */
export async function listMessages(
  userId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<IterMessageRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? HISTORY_PAGE_SIZE, 1), 100);
  const where = opts.cursor
    ? and(eq(iterMessage.userId, userId), lt(iterMessage.createdAt, opts.cursor))
    : eq(iterMessage.userId, userId);
  return db.select().from(iterMessage).where(where).orderBy(desc(iterMessage.createdAt)).limit(limit);
}

/**
 * A single message, but only if it belongs to `userId`.
 *
 * The id and the owner are both in the WHERE clause, so a caller asking for
 * someone else's message gets nothing back rather than a row they can then be
 * checked against — the check cannot be forgotten at the call site because
 * there is no call site that receives an unowned row.
 */
export async function findOwnMessage(userId: string, id: string): Promise<IterMessageRow | null> {
  const [row] = await db
    .select()
    .from(iterMessage)
    .where(and(eq(iterMessage.id, id), eq(iterMessage.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** How many messages this user has stored. Used only for the empty state. */
export async function countMessages(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(iterMessage)
    .where(eq(iterMessage.userId, userId));
  return row?.n ?? 0;
}

/** Erases this user's own history, at their own request. */
export async function deleteAllForUser(userId: string): Promise<number> {
  const rows = await db.delete(iterMessage).where(eq(iterMessage.userId, userId)).returning({ id: iterMessage.id });
  return rows.length;
}
