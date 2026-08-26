// A generated file's copy has to match whatever `locale` the request asks
// for, independent of the caller's own UI language — this backend has no
// access to the frontend's dictionary (and shouldn't import across that
// boundary), so the handful of labels an export file actually needs are
// duplicated here, matching the frontend's existing wording where the same
// concept already has one (`t.scr.gb.student`/`avgShort`, `t.exp.cls`/
// `subj`/`term`).
type Locale = "hy" | "en" | "ru";

export const EXPORT_LABELS: Record<Locale, { student: string; average: string; institution: string; class: string; subject: string; term: string; generatedAt: string }> = {
  hy: { student: "Աշակերտ", average: "Միջ.", institution: "Հաստատություն", class: "Դասարան", subject: "Առարկա", term: "Կիսամյակ", generatedAt: "Ստեղծված է" },
  en: { student: "Student", average: "Avg.", institution: "Institution", class: "Class", subject: "Subject", term: "Term", generatedAt: "Generated" },
  ru: { student: "Ученик", average: "Средн.", institution: "Учреждение", class: "Класс", subject: "Предмет", term: "Семестр", generatedAt: "Создано" },
};
