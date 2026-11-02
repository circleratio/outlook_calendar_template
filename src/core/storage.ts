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

const LOAD_WARNING = "保存済みテンプレートを読み込めませんでした。データを保護するため、テンプレートの保存はできません";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

function isTemplate(v: unknown): v is EventTemplate {
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
    (t.durationMinutes === null || typeof t.durationMinutes === "number")
  );
}

/** Parse the raw roamingSettings value. `undefined` (never saved) yields an empty list without warning. */
export function deserialize(raw: unknown): { templates: EventTemplate[]; warning?: string } {
  if (raw === undefined || raw === null) {
    return { templates: [] };
  }
  try {
    const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<StoredData>;
    if (data.version !== SCHEMA_VERSION || !Array.isArray(data.templates) || !data.templates.every(isTemplate)) {
      return { templates: [], warning: LOAD_WARNING };
    }
    return { templates: data.templates };
  } catch {
    return { templates: [], warning: LOAD_WARNING };
  }
}
