/** Wall-clock date/time in the mailbox time zone. `month` is 1-12. */
export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
}

export interface PlaceholderValues {
  date: string;
  start: string;
  end: string;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatDate(d: LocalDateTime): string {
  // Use UTC so the weekday does not depend on the runtime time zone.
  const weekday = WEEKDAYS[new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()];
  return `${d.year}/${pad2(d.month)}/${pad2(d.day)}(${weekday})`;
}

export function formatTime(d: LocalDateTime): string {
  return `${pad2(d.hours)}:${pad2(d.minutes)}`;
}

export function buildPlaceholderValues(start: LocalDateTime, end: LocalDateTime): PlaceholderValues {
  return { date: formatDate(start), start: formatTime(start), end: formatTime(end) };
}

/** All-day events run from 00:00 to 00:00 on a later date; Office.js has no GA API to read the flag. */
export function isAllDayRange(start: LocalDateTime, end: LocalDateTime): boolean {
  const atMidnight = (d: LocalDateTime) => d.hours === 0 && d.minutes === 0;
  const sameDate = start.year === end.year && start.month === end.month && start.day === end.day;
  return atMidnight(start) && atMidnight(end) && !sameDate;
}

export function expandPlaceholders(text: string, v: PlaceholderValues): string {
  return text
    .replace(/\{日付\}/g, v.date)
    .replace(/\{開始時刻\}/g, v.start)
    .replace(/\{終了時刻\}/g, v.end);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function plainTextToHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]).replace(/\r?\n/g, "<br>");
}
