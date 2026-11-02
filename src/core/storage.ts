import { EventTemplate } from "./template";

export const SETTINGS_KEY = "eventTemplates";
/** Margin below the ~32KB roamingSettings limit. */
export const MAX_BYTES = 30000;
const SCHEMA_VERSION = 1;

interface StoredData {
  version: number;
  templates: EventTemplate[];
}

export function serialize(templates: EventTemplate[]): string {
  const data: StoredData = { version: SCHEMA_VERSION, templates };
  return JSON.stringify(data);
}

export function byteSize(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Size of `json` after roamingSettings encodes the string value again on save. */
export function storedByteSize(json: string): number {
  return byteSize(JSON.stringify(json));
}

/** True when `json` is over the limit; shrinking saves stay allowed so data already over it can be reduced. */
export function exceedsLimit(json: string, currentJson: string): boolean {
  const size = storedByteSize(json);
  return size > MAX_BYTES && size >= storedByteSize(currentJson);
}

const LOAD_WARNING = "保存済みテンプレートを読み込めませんでした。データを保護するため、テンプレートの保存はできません";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

/** Templates saved before `sensitivity` was added do not have the field. */
type StoredTemplate = Omit<EventTemplate, "sensitivity"> & Partial<Pick<EventTemplate, "sensitivity">>;

function isTemplate(v: unknown): v is StoredTemplate {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.subject === "string" &&
    typeof t.body === "string" &&
    typeof t.location === "string" &&
    isStringArray(t.requiredAttendees) &&
    isStringArray(t.optionalAttendees) &&
    (t.durationMinutes === null || typeof t.durationMinutes === "number") &&
    (t.sensitivity === undefined || t.sensitivity === "unchanged" || t.sensitivity === "normal" || t.sensitivity === "private")
  );
}

/** Parse the raw roamingSettings value. `undefined` (never saved) yields an empty list without warning. */
export function deserialize(raw: unknown): { templates: EventTemplate[]; warning?: string } {
  if (raw === undefined || raw === null) {
    return { templates: [] };
  }
  try {
    const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as { version?: unknown; templates?: unknown };
    if (data.version !== SCHEMA_VERSION || !Array.isArray(data.templates) || !data.templates.every(isTemplate)) {
      return { templates: [], warning: LOAD_WARNING };
    }
    const templates: StoredTemplate[] = data.templates;
    return { templates: templates.map((t) => ({ ...t, sensitivity: t.sensitivity ?? "unchanged" })) };
  } catch {
    return { templates: [], warning: LOAD_WARNING };
  }
}
