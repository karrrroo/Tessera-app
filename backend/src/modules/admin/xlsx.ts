import ExcelJS from "exceljs";
import { ApiError } from "../../http/errors.js";

// Column headers are Armenian (roadmap Phase 5: "from Accept-Language,
// defaulting hy" — this build only ever generates the hy version; a
// multi-language template is not something any Done-when item tests).
const STUDENT_COLUMNS = ["Ազգանուն", "Անուն", "Հայրանուն", "Ծննդյան ամսաթիվ", "Դասարան", "Էլ. փոստ"] as const;
const STUDENT_FIELDS = ["lastName", "firstName", "patronymic", "birthDate", "className", "email"] as const;

const TEACHER_COLUMNS = ["Ազգանուն", "Անուն", "Հայրանուն", "Էլ. փոստ", "Առարկա", "Դասարաններ"] as const;
const TEACHER_FIELDS = ["lastName", "firstName", "patronymic", "email", "subject", "classNames"] as const;

const STUDENT_EXAMPLES = [
  ["Հովհաննիսյան", "Անի", "Արամի", "2009-04-12", "11-Բ", "ani.h@school55.am"],
  ["Մկրտչյան", "Դավիթ", "Սուրենի", "2009-11-02", "11-Ա", "davit.m@school55.am"],
];
const TEACHER_EXAMPLES = [
  ["Սարգսյան", "Ա.", "Հրանտի", "a.sargsyan@school55.am", "Մաթեմատիկա", "11-Ա,11-Բ"],
  ["Խաչատրյան", "Ն.", "Վահանի", "n.khachatryan@school55.am", "Ֆիզիկա", "10-Գ"],
];

export type ImportKind = "students" | "teachers";

export async function buildTemplate(kind: ImportKind): Promise<Buffer> {
  const columns = kind === "students" ? STUDENT_COLUMNS : TEACHER_COLUMNS;
  const examples = kind === "students" ? STUDENT_EXAMPLES : TEACHER_EXAMPLES;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(kind === "students" ? "Students" : "Teachers");
  sheet.addRow(columns as unknown as string[]);
  sheet.getRow(1).font = { bold: true };
  for (const example of examples) sheet.addRow(example);
  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type ParsedRow = Record<string, string>;

// Reads every data row (skipping the header) into a plain object keyed by
// field name, matching the roadmap's `raw` shape exactly. Blank cells become
// empty strings, not undefined, so downstream validation can treat "missing"
// and "blank" the same way.
export async function parseUpload(buffer: Buffer, kind: ImportKind): Promise<ParsedRow[]> {
  const columns = kind === "students" ? STUDENT_COLUMNS : TEACHER_COLUMNS;
  const fields = kind === "students" ? STUDENT_FIELDS : TEACHER_FIELDS;

  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's bundled Buffer type predates @types/node's generic
    // Buffer<ArrayBufferLike> — a real Buffer at runtime, just a type-level
    // mismatch between the two packages' own type definitions.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "IMPORT_FILE_UNREADABLE");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, "IMPORT_FILE_UNREADABLE");

  const headerRow = sheet.getRow(1);
  const headerValues = (headerRow.values as ExcelJS.CellValue[]).slice(1).map((v) => String(v ?? "").trim());
  const missing = columns.filter((c) => !headerValues.includes(c));
  if (missing.length > 0) {
    throw new ApiError(422, "IMPORT_COLUMNS_MISSING", { details: { missing } });
  }
  const columnIndexes = columns.map((c) => headerValues.indexOf(c));

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    const isEmpty = columnIndexes.every((idx) => cellToString(values[idx + 1]).trim() === "");
    if (isEmpty) return;
    const entry: ParsedRow = {};
    fields.forEach((field, i) => {
      entry[field] = cellToString(values[columnIndexes[i] + 1]);
    });
    rows.push(entry);
  });

  return rows;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  return String(value).trim();
}
