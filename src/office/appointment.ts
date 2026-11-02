import { LocalDateTime } from "../core/placeholder";

export interface AppointmentGateway {
  getStart(): Promise<Date>;
  getEnd(): Promise<Date>;
  setEnd(d: Date): Promise<void>;
  setSubject(s: string): Promise<void>;
  prependBodyHtml(html: string): Promise<void>;
  setLocation(s: string): Promise<void>;
  getRequiredAttendees(): Promise<string[]>;
  addRequiredAttendees(emails: string[]): Promise<void>;
  getOptionalAttendees(): Promise<string[]>;
  addOptionalAttendees(emails: string[]): Promise<void>;
  /** Convert to wall-clock time in the mailbox time zone. */
  toLocal(d: Date): LocalDateTime;
}

/** Wrap an Office `*Async` call into a Promise that rejects with the Office error message. */
export function promisify<T>(call: (callback: (result: Office.AsyncResult<T>) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    call((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(result.error?.message ?? "Unknown error"));
      }
    });
  });
}

export function createOfficeAppointmentGateway(): AppointmentGateway {
  const mailbox = Office.context.mailbox;
  const item = mailbox.item as Office.AppointmentCompose;

  const getEmails = async (recipients: Office.Recipients): Promise<string[]> => {
    const list = await promisify<Office.EmailAddressDetails[]>((cb) => recipients.getAsync(cb));
    return list.map((r) => r.emailAddress);
  };

  return {
    getStart: () => promisify<Date>((cb) => item.start.getAsync(cb)),
    getEnd: () => promisify<Date>((cb) => item.end.getAsync(cb)),
    setEnd: (d) => promisify<void>((cb) => item.end.setAsync(d, cb)),
    setSubject: (s) => promisify<void>((cb) => item.subject.setAsync(s, cb)),
    prependBodyHtml: (html) =>
      promisify<void>((cb) => item.body.prependAsync(html, { coercionType: Office.CoercionType.Html }, cb)),
    setLocation: (s) => promisify<void>((cb) => item.location.setAsync(s, cb)),
    getRequiredAttendees: () => getEmails(item.requiredAttendees),
    addRequiredAttendees: (emails) => promisify<void>((cb) => item.requiredAttendees.addAsync(emails, cb)),
    getOptionalAttendees: () => getEmails(item.optionalAttendees),
    addOptionalAttendees: (emails) => promisify<void>((cb) => item.optionalAttendees.addAsync(emails, cb)),
    toLocal: (d) => {
      const t = mailbox.convertToLocalClientTime(d);
      // LocalClientTime.month is 0-based.
      return { year: t.year, month: t.month + 1, day: t.date, hours: t.hours, minutes: t.minutes };
    },
  };
}
