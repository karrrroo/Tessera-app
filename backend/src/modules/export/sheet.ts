// EXP-7 is explicitly open — the school's actual required column shape is
// unknown. Everything scope/format-specific in this module reads through
// this one function, so switching to a school-specific layout later is
// editing this file, not rewriting the module.

export type SheetInput = {
  headerLines: string[];
  studentColumnLabel: string;
  averageColumnLabel: string;
  assessmentColumnLabels: string[];
  studentNames: string[];
  // value(studentIndex, assessmentIndex) — null where no published mark exists.
  value: (studentIndex: number, assessmentIndex: number) => number | null;
};

export type SheetPlan = {
  headerRows: string[][];
  columnHeaderRow: string[];
  bodyRows: (string | number)[][];
  summaryRow: (string | number)[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function average(values: number[]): number | "" {
  if (values.length === 0) return "";
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

export function buildSheet(input: SheetInput): SheetPlan {
  const assessmentCount = input.assessmentColumnLabels.length;

  const bodyRows = input.studentNames.map((name, si) => {
    const values = Array.from({ length: assessmentCount }, (_, ai) => input.value(si, ai));
    const rowAvg = average(values.filter((v): v is number => v !== null));
    return [name, ...values.map((v) => v ?? ""), rowAvg];
  });

  const summaryRow: (string | number)[] = [
    "",
    ...Array.from({ length: assessmentCount }, (_, ai) => {
      const colValues = input.studentNames
        .map((_, si) => input.value(si, ai))
        .filter((v): v is number => v !== null);
      return average(colValues);
    }),
    "",
  ];

  return {
    headerRows: input.headerLines.map((line) => [line]),
    columnHeaderRow: [input.studentColumnLabel, ...input.assessmentColumnLabels, input.averageColumnLabel],
    bodyRows,
    summaryRow,
  };
}

export function sheetPlanToRows(plan: SheetPlan): (string | number)[][] {
  return [...plan.headerRows, plan.columnHeaderRow, ...plan.bodyRows, plan.summaryRow];
}

// L-8: UTF-8 with a leading BOM and \r\n line endings, or Excel on Windows
// renders Armenian as mojibake. Every field is quoted, `"` doubled inside —
// the plain RFC 4180 escaping rule, applied unconditionally rather than
// only when a field happens to contain a comma, since a comma inside an
// unquoted field would otherwise silently reshape the row.
export function renderCsv(plan: SheetPlan): string {
  const rows = sheetPlanToRows(plan);
  const lines = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
