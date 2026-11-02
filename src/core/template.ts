import { isValidEmail } from "./attendees";

/** Event privacy applied by a template; "unchanged" keeps the value of the form. */
export type TemplateSensitivity = "unchanged" | "normal" | "private";

export interface EventTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  location: string;
  requiredAttendees: string[];
  optionalAttendees: string[];
  /** Meeting length in minutes; null keeps the end time of the form. */
  durationMinutes: number | null;
  sensitivity: TemplateSensitivity;
  /** Names from the master category list of the mailbox. */
  categories: string[];
}

export type ValidationError = { field: keyof EventTemplate; message: string };

export const MAX_NAME_LENGTH = 50;
export const MAX_DURATION_MINUTES = 1440;

export function createEmptyTemplate(): EventTemplate {
  return {
    id: crypto.randomUUID(),
    name: "",
    subject: "",
    body: "",
    location: "",
    requiredAttendees: [],
    optionalAttendees: [],
    durationMinutes: null,
    sensitivity: "unchanged",
    categories: [],
  };
}

/** Split user input by comma, semicolon or newline into trimmed, unique names (case-insensitive). */
export function parseCategoryList(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of input.split(/[,;\r\n]+/).map((s) => s.trim())) {
    const key = name.toLowerCase();
    if (name.length > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  }
  return result;
}

/** Validate `t` against the rules in spec.md; `others` may include `t` itself (matched by id). */
export function validateTemplate(t: EventTemplate, others: EventTemplate[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const name = t.name.trim();
  if (name.length === 0) {
    errors.push({ field: "name", message: "テンプレート名を入力してください" });
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push({ field: "name", message: `テンプレート名は${MAX_NAME_LENGTH}文字以内で入力してください` });
  } else if (others.some((o) => o.id !== t.id && o.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.push({ field: "name", message: "同じ名前のテンプレートがあります" });
  }

  const hasContent =
    [t.subject, t.body, t.location].some((s) => s.trim().length > 0) ||
    t.requiredAttendees.length > 0 ||
    t.optionalAttendees.length > 0 ||
    t.durationMinutes !== null ||
    t.sensitivity !== "unchanged" ||
    t.categories.length > 0;
  if (!hasContent) {
    errors.push({
      field: "subject",
      message: "件名・本文・場所・出席者・会議時間・公開範囲・カテゴリのいずれかを設定してください",
    });
  }

  for (const field of ["requiredAttendees", "optionalAttendees"] as const) {
    const invalid = t[field].filter((e) => !isValidEmail(e));
    if (invalid.length > 0) {
      errors.push({ field, message: `メールアドレスの形式が正しくありません: ${invalid.join(", ")}` });
    }
  }

  const d = t.durationMinutes;
  if (d !== null && !(Number.isInteger(d) && d >= 1 && d <= MAX_DURATION_MINUTES)) {
    errors.push({
      field: "durationMinutes",
      message: `会議時間は1〜${MAX_DURATION_MINUTES}の整数で入力してください`,
    });
  }

  return errors;
}
