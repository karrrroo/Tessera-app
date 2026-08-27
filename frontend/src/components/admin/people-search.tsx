"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, type StudentHit, type TeacherHit } from "@/lib/api/admin";
import { useLocale, useT, interpolate } from "@/i18n/locale-provider";
import { displayFullName, transliterateName } from "@/i18n/transliterate-name";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

type Kind = "students" | "teachers";
type Status = "idle" | "loading" | "ok" | "error";

// One field, a students/teachers toggle, every match ranked — the server does
// the matching and ranking (admin/search.ts); this is the picker over it.
//
// The same field finds a person by name, login, external id, class, or (for
// teachers) subject, so the admin never has to declare which kind of query
// they are making.
//
// Secondary text inside the glass panel uses --ink-2, never --ink-3.
// Measured: composited over the .06 glass, --ink-3 lands at 4.42:1 on the
// darker of the two dark backgrounds and 3.46:1 in the light theme, both
// below AA, while --ink-2 holds 6.97-8.74:1 everywhere. Ratios and the
// background values they were measured against are in docs/decisions.md
// (tokens:check forbids naming a hex literal outside tessera.css).
export function PeopleSearch() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();

  const [kind, setKind] = useState<Kind>("students");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [students, setStudents] = useState<{ items: StudentHit[]; total: number } | null>(null);
  const [teachers, setTeachers] = useState<{ items: TeacherHit[]; total: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  const trimmed = query.trim();
  const show = trimmed.length >= MIN_QUERY;
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY;

  useEffect(() => {
    const q = query.trim();
    // Nothing is written to state synchronously here on purpose — the
    // too-short case is derived at render (`show` below), which keeps this
    // effect clear of the set-state-in-effect rule.
    if (q.length < MIN_QUERY) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setStatus("loading");
      const done = (apply: () => void) => {
        if (cancelled) return;
        apply();
        setStatus("ok");
      };
      // Always the first page (offset 0) — a new query or a kind switch
      // replaces the result set entirely; loadMore (below) is the only path
      // that appends.
      const req =
        kind === "students"
          ? adminApi.searchStudents(q, { limit: PAGE_SIZE, offset: 0 }).then((p) => done(() => setStudents(p)))
          : adminApi.searchTeachers(q, { limit: PAGE_SIZE, offset: 0 }).then((p) => done(() => setTeachers(p)));
      req.catch(() => {
        if (!cancelled) setStatus("error");
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, kind]);

  // A real bug, reported live: `PAGE_SIZE` capped every search at its first
  // 20 matches with no way to reach the rest — the admin was told "showing
  // 20 of 140" with nothing to click. The backend already supported
  // `offset` end to end (admin/search.ts, the /students and /teachers
  // routes); only this picker never passed one. Appends rather than
  // replacing, and keeps `total` from the first page.
  async function loadMore() {
    const q = query.trim();
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (kind === "students" && students) {
        const next = await adminApi.searchStudents(q, { limit: PAGE_SIZE, offset: students.items.length });
        setStudents({ items: [...students.items, ...next.items], total: next.total });
      } else if (kind === "teachers" && teachers) {
        const next = await adminApi.searchTeachers(q, { limit: PAGE_SIZE, offset: teachers.items.length });
        setTeachers({ items: [...teachers.items, ...next.items], total: next.total });
      }
    } catch {
      setStatus("error");
    } finally {
      setLoadingMore(false);
    }
  }

  const page = kind === "students" ? students : teachers;
  const rows = show && status !== "error" ? (page?.items ?? []) : [];

  // Highlight every matched term, split on the same whitespace boundary the
  // server splits on, so what gets emphasised is what actually matched.
  // Two regexes on purpose: a global one to split, and a NON-global one to
  // test each part. A global regex's .test() advances lastIndex, so reusing
  // it here would flip between true and false and lose half the highlights.
  const highlight = (() => {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, (m) => "\\" + m);
    const raw = trimmed.split(/\s+/).filter(Boolean);
    // Names are transliterated for display (an Armenian given name renders as
    // Latin in en and Cyrillic in ru), so an Armenian query never matched the
    // rendered string and nothing got highlighted -- measured: 9 matching rows,
    // 0 highlighted spans. Match against the query AND its transliterated form,
    // using the same function that produced the visible text.
    const terms = [...new Set([...raw, ...raw.map((s) => transliterateName(s, locale))])]
      .filter(Boolean)
      .map(escape);
    if (terms.length === 0) return (text: string) => text as React.ReactNode;
    const group = terms.join("|");
    const splitter = new RegExp("(" + group + ")", "gi");
    const isMatch = new RegExp("^(?:" + group + ")$", "i");
    return (text: string): React.ReactNode =>
      text.split(splitter).map((part, i) =>
        part && isMatch.test(part) ? (
          <mark key={i} style={{ background: "var(--accent)", color: "var(--accent-fg)", padding: "0 1px", borderRadius: 2 }}>
            {part}
          </mark>
        ) : (
          part
        ),
      );
  })();

  function studentHref(index: number): string | null {
    const hit = students?.items[index];
    return kind === "students" && hit ? `/admin/students/${hit.id}` : null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setQuery("");
      setCursor(0);
      return;
    }
    if (rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      const target = studentHref(cursor);
      if (target) router.push(target);
    }
  }

  useEffect(() => {
    rowRefs.current[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const subjectName = (a: { nameHy: string; nameEn: string; nameRu: string }) =>
    locale === "hy" ? a.nameHy : locale === "ru" ? a.nameRu : a.nameEn;

  const statusLine = tooShort
    ? t.admin.stu.searchHint
    : status === "loading" && show
      ? t.admin.stu.searching
      : status === "error" && show
        ? t.admin.stu.errorSearch
        : show && page
          ? page.total === 0
            ? `${t.admin.stu.noResults}: “${trimmed}”`
            : interpolate(t.admin.stu.resultCount, { count: page.total })
          : "";

  return (
    <section className="glass-admin rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--ink-2)" }}>
          {t.admin.stu.searchTitle}
        </h2>
        <div className="flex gap-1" role="tablist">
          {(["students", "teachers"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setCursor(0);
              }}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: kind === k ? "var(--accent)" : "transparent",
                color: kind === k ? "var(--accent-fg)" : "var(--ink-2)",
                border: kind === k ? "none" : "1px solid var(--hair)",
              }}
            >
              {k === "students" ? t.admin.stu.tabStudents : t.admin.stu.tabTeachers}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={kind === "students" ? t.admin.stu.placeholderAll : t.admin.stu.placeholderTeachers}
        aria-label={t.admin.stu.searchTitle}
        className="mt-3 w-full rounded-2xl border px-4 py-2.5 text-sm"
        style={{ borderColor: "var(--hair)", background: "var(--surface2)", color: "var(--ink)" }}
      />

      <p className="mt-2 min-h-[1.25rem] text-xs" style={{ color: "var(--ink-2)" }} aria-live="polite">
        {statusLine}
      </p>

      {/* Skeleton rows while the first query for this mode is in flight.
          Plain surfaces — deliberately no glass per row, which is what makes
          a long list crawl. */}
      {show && status === "loading" && !page && (
        <ul className="mt-1 space-y-1.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-10 animate-pulse rounded-xl" style={{ background: "var(--surface2)" }} />
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <>
          <ul
            className="mt-1 divide-y rounded-xl border"
            /* A results table opts out of the ambient gradient — flat --bg-base. */
            style={{ borderColor: "var(--hair)", background: "var(--bg-base)" }}
            role="listbox"
          >
            {kind === "students"
              ? (students?.items ?? []).map((s, i) => (
                  <li
                    key={s.id}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={cursor === i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => router.push(`/admin/students/${s.id}`)}
                    className="cursor-pointer px-3 py-2 text-sm"
                    style={{ background: cursor === i ? "var(--surface2)" : "transparent", color: "var(--ink)" }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate">{highlight(displayFullName(s.firstName, s.lastName, locale))}</span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--ink-2)" }}>
                        {s.className ?? "—"}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[11px]" style={{ color: "var(--ink-2)" }}>
                      {highlight(s.email)}
                      {s.externalId ? ` · ${s.externalId}` : ""}
                    </div>
                  </li>
                ))
              : (teachers?.items ?? []).map((row, i) => (
                  <li
                    key={row.id}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={cursor === i}
                    onMouseEnter={() => setCursor(i)}
                    className="px-3 py-2 text-sm"
                    style={{ background: cursor === i ? "var(--surface2)" : "transparent", color: "var(--ink)" }}
                  >
                    <div className="truncate">{highlight(displayFullName(row.firstName, row.lastName, locale))}</div>
                    <div className="truncate font-mono text-[11px]" style={{ color: "var(--ink-2)" }}>
                      {highlight(row.email)}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-2)" }}>
                      {row.assignments.length === 0
                        ? t.admin.stu.noAssignments
                        : `${t.admin.stu.teaches}: ${row.assignments
                            .map((a) => `${subjectName(a)} ${a.className}`)
                            .join(" · ")}`}
                    </div>
                  </li>
                ))}
          </ul>
          {page && page.total > rows.length && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                {interpolate(t.admin.stu.moreResults, { shown: rows.length, total: page.total })}
              </p>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-50"
                style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}
              >
                {t.admin.stu.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
