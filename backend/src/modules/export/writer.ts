import ExcelJS from "exceljs";
import archiver from "archiver";
import type { Response } from "express";
import * as repo from "./repo.js";
import { buildSheet, renderCsv, type SheetInput } from "./sheet.js";
import { EXPORT_LABELS } from "./labels.js";
import { filenameSegment } from "../../lib/transliterate.js";
import { mapWithConcurrency } from "../../lib/concurrency.js";
import type { ExportPlan, ExportUnit } from "./service.js";

const EXPORT_CONCURRENCY = 8;

// institution-term and class-term routinely reuse the same class across
// several subject-units — without this, a class taught 8 subjects had its
// identical student roster fetched 8 separate times.
type StudentRow = Awaited<ReturnType<typeof repo.findStudentsForClass>>[number];
function cachedStudentsForClass(cache: Map<string, Promise<StudentRow[]>>, classId: string): Promise<StudentRow[]> {
  let promise = cache.get(classId);
  if (!promise) {
    promise = repo.findStudentsForClass(classId);
    cache.set(classId, promise);
  }
  return promise;
}

async function loadUnitSheetInput(
  unit: ExportUnit,
  termId: string,
  locale: "hy" | "en" | "ru",
  studentsCache: Map<string, Promise<StudentRow[]>>,
): Promise<{ input: SheetInput; markCount: number }> {
  const labels = EXPORT_LABELS[locale];
  const [students, assessments, marks] = await Promise.all([
    cachedStudentsForClass(studentsCache, unit.classId),
    repo.findPublishedAssessments(unit.classId, unit.subjectId, termId),
    repo.findPublishedMarks(unit.classId, unit.subjectId, termId),
  ]);

  const studentIndex = new Map(students.map((s, i) => [s.id, i]));
  const assessmentIndex = new Map(assessments.map((a, i) => [a.id, i]));
  const grid = new Map<string, number>();
  for (const m of marks) {
    const si = studentIndex.get(m.studentId);
    const ai = assessmentIndex.get(m.assessmentId);
    if (si === undefined || ai === undefined) continue;
    grid.set(`${si}:${ai}`, m.value);
  }

  const input: SheetInput = {
    headerLines: [
      `${labels.class}: ${unit.classLabel}`,
      `${labels.subject}: ${unit.subjectName}`,
      `${labels.generatedAt}: ${new Date().toISOString().slice(0, 10)}`,
    ],
    studentColumnLabel: labels.student,
    averageColumnLabel: labels.average,
    assessmentColumnLabels: assessments.map((a) => a.title ?? a.heldOn),
    studentNames: students.map((s) => `${s.last_name} ${s.first_name}`),
    value: (si, ai) => grid.get(`${si}:${ai}`) ?? null,
  };

  return { input, markCount: marks.length };
}

function sheetName(unit: ExportUnit, index: number): string {
  const raw = filenameSegment(`${unit.classLabel}-${unit.subjectName}`).slice(0, 28);
  return raw.length > 0 ? `${raw}-${index}`.slice(0, 31) : `Sheet-${index}`;
}

// Every unit's data is fetched concurrently (bounded) — a school-size
// export otherwise did tens of fully sequential round trips to a remote
// database and took the better part of a minute instead of seconds. The
// writer itself (building rows, appending zip entries) stays sequential:
// that part is CPU-bound, not network-bound, so there's nothing to gain
// from parallelizing it and exceljs's streaming writer expects one
// worksheet at a time regardless.
async function loadAllUnits(plan: ExportPlan): Promise<{ input: SheetInput; markCount: number }[]> {
  const studentsCache = new Map<string, Promise<StudentRow[]>>();
  return mapWithConcurrency(plan.units, EXPORT_CONCURRENCY, (unit) => loadUnitSheetInput(unit, plan.termId, plan.locale, studentsCache));
}

async function writeXlsx(plan: ExportPlan, res: Response): Promise<number> {
  const loaded = await loadAllUnits(plan);
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: false });
  let totalMarks = 0;

  for (const [index, unit] of plan.units.entries()) {
    const { input, markCount } = loaded[index];
    totalMarks += markCount;
    const sheetPlan = buildSheet(input);
    const worksheet = workbook.addWorksheet(sheetName(unit, index));
    for (const row of [...sheetPlan.headerRows, sheetPlan.columnHeaderRow, ...sheetPlan.bodyRows, sheetPlan.summaryRow]) {
      worksheet.addRow(row).commit();
    }
    worksheet.commit();
  }

  await workbook.commit();
  return totalMarks;
}

async function writeCsv(plan: ExportPlan, res: Response): Promise<number> {
  const loaded = await loadAllUnits(plan);

  if (plan.units.length === 1) {
    res.end(renderCsv(buildSheet(loaded[0].input)));
    return loaded[0].markCount;
  }

  const archive = archiver("zip");
  archive.pipe(res);
  let totalMarks = 0;
  for (const [index, unit] of plan.units.entries()) {
    const { input, markCount } = loaded[index];
    totalMarks += markCount;
    const csv = renderCsv(buildSheet(input));
    archive.append(Buffer.from(csv, "utf8"), { name: `${filenameSegment(`${unit.classLabel}-${unit.subjectName}`)}.csv` });
  }
  await archive.finalize();
  return totalMarks;
}

export async function writeExport(plan: ExportPlan, res: Response): Promise<{ markCount: number }> {
  const extension = plan.format === "xlsx" ? "xlsx" : plan.units.length > 1 ? "zip" : "csv";
  const contentType =
    plan.format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : plan.units.length > 1
        ? "application/zip"
        : "text/csv; charset=utf-8";

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${plan.filenameAscii}.${extension}"; filename*=UTF-8''${encodeURIComponent(plan.filenameUtf8)}.${extension}`,
  );

  const markCount = plan.format === "xlsx" ? await writeXlsx(plan, res) : await writeCsv(plan, res);
  return { markCount };
}
