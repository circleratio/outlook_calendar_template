const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split user input by comma, semicolon or newline into trimmed, non-empty entries. */
export function parseEmailList(input: string): string[] {
  return input
    .split(/[,;\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isValidEmail(s: string): boolean {
  return EMAIL_PATTERN.test(s);
}

/** Return the entries of `toAdd` not already present in `existing` (case-insensitive, also deduped within `toAdd`). */
export function mergeAttendees(existing: string[], toAdd: string[]): string[] {
  const seen = new Set(existing.map((e) => e.toLowerCase()));
  const result: string[] = [];
  for (const email of toAdd) {
    const key = email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(email);
    }
  }
  return result;
}
