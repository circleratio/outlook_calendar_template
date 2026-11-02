import { LocalDateTime } from "../core/placeholder";

export interface AppointmentGateway {
  getStart(): Promise<Date>;
  getEnd(): Promise<Date>;
  setEnd(d: Date): Promise<void>;
  setSubject(s: string): Promise<void>;
  prependBodyHtml(html: string): Promise<void>;
  setLocation(s: string): Promise<void>;
  setSensitivity(s: "normal" | "private"): Promise<void>;
  getCategories(): Promise<string[]>;
  addCategories(names: string[]): Promise<void>;
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

  // Checked at runtime so the manifest can keep its lower minimum requirement set.
  const requireCategories = (): void => {
    if (!Office.context.requirements.isSetSupported("Mailbox", "1.8")) {
      throw new Error("このバージョンの Outlook では設定できません");
    }
  };

  return {
    getStart: () => promisify<Date>((cb) => item.start.getAsync(cb)),
    getEnd: () => promisify<Date>((cb) => item.end.getAsync(cb)),
    setEnd: (d) => promisify<void>((cb) => item.end.setAsync(d, cb)),
    setSubject: (s) => promisify<void>((cb) => item.subject.setAsync(s, cb)),
    prependBodyHtml: (html) =>
      promisify<void>((cb) => item.body.prependAsync(html, { coercionType: Office.CoercionType.Html }, cb)),
    setLocation: (s) => promisify<void>((cb) => item.location.setAsync(s, cb)),
    setSensitivity: async (s) => {
      // Checked at runtime so the manifest can keep its lower minimum requirement set.
      if (!Office.context.requirements.isSetSupported("Mailbox", "1.14")) {
        throw new Error("このバージョンの Outlook では設定できません");
      }
      const value =
        s === "private"
          ? Office.MailboxEnums.AppointmentSensitivityType.Private
          : Office.MailboxEnums.AppointmentSensitivityType.Normal;
      await promisify<void>((cb) => item.sensitivity.setAsync(value, cb));
    },
    getCategories: async () => {
      requireCategories();
      const list = await promisify<Office.CategoryDetails[] | null>((cb) => item.categories.getAsync(cb));
      // Empty categories are returned as null or [] depending on the Outlook version.
      return (list ?? []).map((c) => c.displayName);
    },
    addCategories: async (names) => {
      requireCategories();
      await promisify<void>((cb) => item.categories.addAsync(names, cb));
    },
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
