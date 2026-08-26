"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/locale-provider";
import { ClassPills } from "@/components/gradebook/class-pills";
import { GradebookGrid } from "@/components/gradebook/gradebook-grid";
import { MobileStudentList } from "@/components/gradebook/mobile-student-list";
import { StudentMarksSheet } from "@/components/gradebook/student-marks-sheet";
import { PublishDialog } from "@/components/gradebook/publish-dialog";
import { PublishSweep } from "@/components/gradebook/publish-sweep";
import { SupersedeDialog } from "@/components/gradebook/supersede-dialog";
import { CellHistorySheet } from "@/components/gradebook/cell-history-sheet";
import {
  cellKey,
  clearDraft,
  draftGroupKey,
  getDraftValue,
  getGroupEntries,
  reconcileDraftGroup,
  restoreDraftGroup,
  setDraft,
} from "@/components/gradebook/draft-store";
import { gradebookApi, type GradebookMark, type GradebookResponse, type TeacherClass } from "@/lib/api/gradebook";

const FLUSH_DEBOUNCE_MS = 600;

export default function GradebookPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [gradebook, setGradebook] = useState<GradebookResponse | null>(null);
  const [version, setVersion] = useState(0);
  const [newColumnId, setNewColumnId] = useState<string | null>(null);
  const [historyMarkId, setHistoryMarkId] = useState<string | null>(null);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [supersedeTarget, setSupersedeTarget] = useState<{ markId: string; value: number } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [sweepKey, setSweepKey] = useState(0);

  const pendingFlush = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<TeacherClass | null>(null);

  const classParam = searchParams.get("class");
  const subjectParam = searchParams.get("subject");
  const termParam = searchParams.get("term");
  const active = classes?.find((c) => c.classId === classParam && c.subjectId === subjectParam) ?? null;
  const groupKey = active ? draftGroupKey(active.classId, active.subjectId, termParam ?? active.termId ?? "") : null;

  useEffect(() => {
    gradebookApi.getClasses().then((rows) => {
      setClasses(rows);
      if (!classParam && rows[0]) {
        router.replace(`/gradebook?class=${rows[0].classId}&subject=${rows[0].subjectId}&term=${rows[0].termId}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(async () => {
    const currentActive = activeRef.current;
    const currentGroupKey = currentActive
      ? draftGroupKey(currentActive.classId, currentActive.subjectId, termParam ?? currentActive.termId ?? "")
      : null;
    if (!currentActive || !currentGroupKey || pendingFlush.current.size === 0) return;
    const keys = [...pendingFlush.current];
    pendingFlush.current.clear();
    const items = keys.map((key) => {
      const [assessmentId, studentId] = key.split(":");
      const value = getDraftValue(currentGroupKey, key) ?? null;
      return { assessmentId, studentId, value };
    });
    try {
      const result = await gradebookApi.putMarks({
        classId: currentActive.classId,
        subjectId: currentActive.subjectId,
        termId: termParam ?? currentActive.termId ?? "",
        items,
      });
      // A published-conflict can't be resolved by this screen — drop the
      // local override so display falls back to the real current value.
      for (const r of result.rejected) clearDraft(currentGroupKey, cellKey(r.assessmentId, r.studentId));
      setVersion((v) => v + 1);
    } catch {
      // Left in pendingFlush would be lost on the next flush's `.clear()`
      // above, but the values themselves are still safe in the draft
      // store and IndexedDB — they'll go out on the next successful flush
      // triggered by any further edit, publish, or reload.
    }
  }, [termParam]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void flush(), FLUSH_DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    function onBeforeUnload() {
      void flush();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flush]);

  useEffect(() => {
    if (!active || !groupKey) return;
    let cancelled = false;
    (async () => {
      await restoreDraftGroup(groupKey);
      const g = await gradebookApi.getGradebook(active.classId, active.subjectId, termParam ?? active.termId ?? "");
      if (cancelled) return;
      reconcileDraftGroup(groupKey, g.marks);
      setGradebook(g);
      setVersion((v) => v + 1);
    })();
    return () => {
      cancelled = true;
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.classId, active?.subjectId, termParam]);

  const marksByCell = new Map<string, GradebookMark>();
  if (gradebook) for (const m of gradebook.marks) marksByCell.set(cellKey(m.assessmentId, m.studentId), m);

  const displayValue = useCallback(
    (studentId: string, assessmentId: string): number | null => {
      if (!groupKey) return null;
      const local = getDraftValue(groupKey, cellKey(assessmentId, studentId));
      if (local !== undefined) return local;
      return marksByCell.get(cellKey(assessmentId, studentId))?.value ?? null;
      // version is read for its re-render side effect only
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupKey, gradebook, version],
  );

  function onCommit(studentId: string, assessmentId: string, value: number | null) {
    if (!groupKey) return;
    const key = cellKey(assessmentId, studentId);
    const mark = marksByCell.get(key);
    if (mark?.state === "published") return; // no in-place edit of a published mark, by any path
    if (value === null) clearDraft(groupKey, key);
    else setDraft(groupKey, key, value, new Date().toISOString());
    pendingFlush.current.add(key);
    setVersion((v) => v + 1);
    scheduleFlush();
    if (newColumnId === assessmentId) setNewColumnId(null); // the column now has a real mark; it's safe from Escape-deletion
  }

  async function onAddColumn() {
    if (!active || !gradebook) return;
    const created = await gradebookApi.createAssessment({
      classId: active.classId,
      subjectId: active.subjectId,
      termId: termParam ?? active.termId ?? "",
      kind: "lesson",
    });
    setGradebook({ ...gradebook, assessments: [...gradebook.assessments, { ...created, publishedMarkCount: 0 }] });
    setNewColumnId(created.id);
  }

  async function onExitGrid() {
    // GB-10: Escape before any mark removes the column entirely.
    if (newColumnId && gradebook) {
      await gradebookApi.deleteAssessment(newColumnId);
      setGradebook({ ...gradebook, assessments: gradebook.assessments.filter((a) => a.id !== newColumnId) });
      setNewColumnId(null);
    }
  }

  async function onDiscardDrafts() {
    if (!groupKey) return;
    for (const [key] of getGroupEntries(groupKey)) clearDraft(groupKey, key);
    pendingFlush.current.clear();
    setVersion((v) => v + 1);
  }

  async function onPublish() {
    if (!active) return;
    await flush();
    const idempotencyKey = crypto.randomUUID();
    await gradebookApi.publish({ classId: active.classId, subjectId: active.subjectId, termId: termParam ?? active.termId ?? "" }, idempotencyKey);
    setPublishOpen(false);
    setSweepKey((k) => k + 1);
    const g = await gradebookApi.getGradebook(active.classId, active.subjectId, termParam ?? active.termId ?? "");
    if (groupKey) reconcileDraftGroup(groupKey, g.marks);
    setGradebook(g);
    setVersion((v) => v + 1);
    setClasses((prev) => prev?.map((c) => (c.classId === active.classId && c.subjectId === active.subjectId ? { ...c, draftCount: 0 } : c)) ?? null);
  }

  if (!classes) return <main className="flex-1 p-8" />;

  const draftCount = groupKey ? getGroupEntries(groupKey).length : 0;

  return (
    <main className="relative flex flex-1 flex-col gap-3 p-8">
      <PublishSweep playKey={sweepKey} />
      <div className="flex items-center gap-2.5">
        <ClassPills
          classes={classes}
          active={active}
          onSelect={(c) => router.push(`/gradebook?class=${c.classId}&subject=${c.subjectId}&term=${c.termId}`)}
        />
        <span title={t.scr.gb.exportBtn} className="flex-none rounded-full border px-3.5 py-2 text-xs" style={{ borderColor: "var(--hair)", color: "var(--ink-2)" }}>
          {t.scr.gb.exportBtn}
        </span>
      </div>
      <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
        {t.scr.gb.hint}
      </p>

      {gradebook && active && (
        <>
          {gradebook.assessments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {t.scr.gb.emptyTitle}
              </p>
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                {t.scr.gb.emptyBody}
              </p>
              <button type="button" onClick={onAddColumn} className="mt-2 rounded-full px-4 py-2 text-sm font-medium" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
                {t.scr.gb.addCol}
              </button>
            </div>
          ) : (
            <>
              <div className="hidden tablet:block">
                <GradebookGrid
                  students={gradebook.students}
                  assessments={gradebook.assessments}
                  marksByCell={marksByCell}
                  displayValue={displayValue}
                  onCommit={onCommit}
                  onOpenHistory={setHistoryMarkId}
                  onRequestCorrection={(markId, value) => setSupersedeTarget({ markId, value })}
                  onAddColumn={onAddColumn}
                  onExit={onExitGrid}
                  studentLabel={t.scr.gb.student}
                  addColumnLabel={t.scr.gb.addCol}
                  avgLabel={t.scr.gb.avgShort}
                />
              </div>
              <div className="tablet:hidden">
                <MobileStudentList
                  students={gradebook.students}
                  assessments={gradebook.assessments}
                  marksByCell={marksByCell}
                  displayValue={displayValue}
                  onOpenStudent={setOpenStudentId}
                  listHint={t.scr.gb.listHint}
                  avgLabel={t.scr.gb.avgShort}
                />
              </div>
            </>
          )}

          {draftCount > 0 && (
            <div className="flex items-center gap-2.5 rounded-[26px] p-3.5" style={{ background: "var(--glass-solid)", border: "1px solid var(--hair-bright)" }}>
              <span className="flex-1 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                {draftCount} {t.scr.gb.drafts}
              </span>
              <button type="button" onClick={onDiscardDrafts} className="rounded-full border px-3.5 py-2 text-xs" style={{ borderColor: "var(--hair)", color: "var(--danger)" }}>
                {t.scr.gb.discard}
              </button>
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="rounded-full px-4 py-2 text-xs font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                {t.scr.gb.send}
              </button>
            </div>
          )}
        </>
      )}

      {publishOpen && active && (
        <PublishDialog draftCount={draftCount} classLabel={active.classLabel} onConfirm={onPublish} onCancel={() => setPublishOpen(false)} />
      )}
      {supersedeTarget && (
        <SupersedeDialog
          currentValue={supersedeTarget.value}
          onCancel={() => setSupersedeTarget(null)}
          onSubmit={async (value, reason) => {
            await gradebookApi.supersede(supersedeTarget.markId, { value, reason });
            setSupersedeTarget(null);
            if (active) {
              const g = await gradebookApi.getGradebook(active.classId, active.subjectId, termParam ?? active.termId ?? "");
              if (groupKey) reconcileDraftGroup(groupKey, g.marks);
              setGradebook(g);
              setVersion((v) => v + 1);
            }
          }}
        />
      )}
      {historyMarkId && <CellHistorySheet markId={historyMarkId} onClose={() => setHistoryMarkId(null)} />}
      {openStudentId &&
        gradebook &&
        (() => {
          const student = gradebook.students.find((s) => s.id === openStudentId);
          if (!student) return null;
          return (
            <StudentMarksSheet
              student={student}
              assessments={gradebook.assessments}
              marksByCell={marksByCell}
              displayValue={displayValue}
              onCommit={onCommit}
              onOpenHistory={setHistoryMarkId}
              onRequestCorrection={(markId, value) => setSupersedeTarget({ markId, value })}
              onAddColumn={onAddColumn}
              onExit={onExitGrid}
              onClose={() => setOpenStudentId(null)}
              addColumnLabel={t.scr.gb.addCol}
              closeLabel={t.scr.gb.close}
            />
          );
        })()}
    </main>
  );
}
