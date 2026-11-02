import { mergeAttendees } from "../core/attendees";
import { buildPlaceholderValues, expandPlaceholders, isAllDayRange, plainTextToHtml } from "../core/placeholder";
import type { EventTemplate } from "../core/template";
import type { AppointmentGateway } from "../office/appointment";

export interface ApplyFailure {
  field: string;
  message: string;
}

export interface ApplyResult {
  failures: ApplyFailure[];
}

/** Thrown when the start/end time of the item cannot be read; nothing has been changed. */
export class DateTimeUnavailableError extends Error {}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Apply `t` to the compose item. Each field is applied independently: a failure is recorded
 * and the remaining fields are still applied (no rollback).
 */
export async function applyTemplate(t: EventTemplate, appt: AppointmentGateway): Promise<ApplyResult> {
  let start: Date;
  let end: Date;
  try {
    [start, end] = await Promise.all([appt.getStart(), appt.getEnd()]);
  } catch (e) {
    throw new DateTimeUnavailableError(messageOf(e));
  }

  const failures: ApplyFailure[] = [];
  const attempt = async (field: string, action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (e) {
      failures.push({ field, message: messageOf(e) });
    }
  };

  if (t.durationMinutes !== null && !isAllDayRange(appt.toLocal(start), appt.toLocal(end))) {
    const newEnd = new Date(start.getTime() + t.durationMinutes * 60_000);
    await attempt("終了日時", async () => {
      await appt.setEnd(newEnd);
      end = newEnd;
    });
  }

  const values = buildPlaceholderValues(appt.toLocal(start), appt.toLocal(end));

  if (t.subject !== "") {
    await attempt("件名", () => appt.setSubject(expandPlaceholders(t.subject, values)));
  }
  if (t.body !== "") {
    // The trailing <br> keeps the existing body on its own line.
    await attempt("本文", () => appt.prependBodyHtml(`${plainTextToHtml(expandPlaceholders(t.body, values))}<br>`));
  }
  if (t.location !== "") {
    await attempt("場所", () => appt.setLocation(t.location));
  }
  if (t.requiredAttendees.length > 0) {
    await attempt("必須出席者", async () => {
      const toAdd = mergeAttendees(await appt.getRequiredAttendees(), t.requiredAttendees);
      if (toAdd.length > 0) await appt.addRequiredAttendees(toAdd);
    });
  }
  if (t.optionalAttendees.length > 0) {
    await attempt("任意出席者", async () => {
      // Required attendees take precedence, so do not list them as optional too.
      const existing = [...(await appt.getOptionalAttendees()), ...(await appt.getRequiredAttendees())];
      const toAdd = mergeAttendees(existing, t.optionalAttendees);
      if (toAdd.length > 0) await appt.addOptionalAttendees(toAdd);
    });
  }

  return { failures };
}
