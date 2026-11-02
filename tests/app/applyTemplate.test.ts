import { applyTemplate, DateTimeUnavailableError } from "../../src/app/applyTemplate";
import { createEmptyTemplate, EventTemplate } from "../../src/core/template";
import type { AppointmentGateway } from "../../src/office/appointment";

// Mailbox time zone in tests is fixed to UTC+9 (JST).
const JST_OFFSET_MS = 9 * 60 * 60_000;

class FakeAppointment implements AppointmentGateway {
  start = new Date("2026-11-05T01:00:00Z"); // 10:00 JST
  end = new Date("2026-11-05T01:30:00Z"); // 10:30 JST
  subject = "";
  body = "";
  location = "";
  required: string[] = [];
  optional: string[] = [];
  failOn = new Set<string>();
  calls: string[] = [];

  private guard(name: string): void {
    this.calls.push(name);
    if (this.failOn.has(name)) throw new Error(`${name} failed`);
  }

  async getStart() {
    this.guard("getStart");
    return this.start;
  }
  async getEnd() {
    this.guard("getEnd");
    return this.end;
  }
  async setEnd(d: Date) {
    this.guard("setEnd");
    this.end = d;
  }
  async setSubject(s: string) {
    this.guard("setSubject");
    this.subject = s;
  }
  async prependBodyHtml(html: string) {
    this.guard("prependBodyHtml");
    this.body = html + this.body;
  }
  async setLocation(s: string) {
    this.guard("setLocation");
    this.location = s;
  }
  async getRequiredAttendees() {
    this.guard("getRequiredAttendees");
    return [...this.required];
  }
  async addRequiredAttendees(emails: string[]) {
    this.guard("addRequiredAttendees");
    this.required.push(...emails);
  }
  async getOptionalAttendees() {
    this.guard("getOptionalAttendees");
    return [...this.optional];
  }
  async addOptionalAttendees(emails: string[]) {
    this.guard("addOptionalAttendees");
    this.optional.push(...emails);
  }
  toLocal(d: Date) {
    const j = new Date(d.getTime() + JST_OFFSET_MS);
    return {
      year: j.getUTCFullYear(),
      month: j.getUTCMonth() + 1,
      day: j.getUTCDate(),
      hours: j.getUTCHours(),
      minutes: j.getUTCMinutes(),
    };
  }
}

const template = (overrides: Partial<EventTemplate> = {}): EventTemplate => ({
  ...createEmptyTemplate(),
  name: "定例会議",
  subject: "{日付} 定例会議",
  body: "{開始時刻}〜{終了時刻}\n<議題>",
  location: "会議室A",
  requiredAttendees: ["a@example.com"],
  optionalAttendees: ["b@example.com"],
  durationMinutes: 60,
  ...overrides,
});

describe("applyTemplate", () => {
  it("(1) applies all fields", async () => {
    const appt = new FakeAppointment();
    const result = await applyTemplate(template(), appt);

    expect(result.failures).toEqual([]);
    expect(appt.end.toISOString()).toBe("2026-11-05T02:00:00.000Z");
    expect(appt.subject).toBe("2026/11/05(木) 定例会議");
    expect(appt.body).toBe("10:00〜11:00<br>&lt;議題&gt;<br>");
    expect(appt.location).toBe("会議室A");
    expect(appt.required).toEqual(["a@example.com"]);
    expect(appt.optional).toEqual(["b@example.com"]);
  });

  it("(2) does not set empty fields", async () => {
    const appt = new FakeAppointment();
    appt.subject = "既存の件名";
    await applyTemplate(
      template({ subject: "", body: "", location: "", requiredAttendees: [], optionalAttendees: [] }),
      appt,
    );

    expect(appt.subject).toBe("既存の件名");
    expect(appt.calls.filter((c) => c.startsWith("set") || c.startsWith("add") || c.includes("Attendees"))).toEqual([
      "setEnd",
    ]);
  });

  it("(3) keeps the end time when durationMinutes is null", async () => {
    const appt = new FakeAppointment();
    await applyTemplate(template({ durationMinutes: null }), appt);

    expect(appt.calls).not.toContain("setEnd");
    expect(appt.end.toISOString()).toBe("2026-11-05T01:30:00.000Z");
    expect(appt.body).toBe("10:00〜10:30<br>&lt;議題&gt;<br>");
  });

  it("(4) uses the applied end time for {終了時刻}", async () => {
    const appt = new FakeAppointment();
    await applyTemplate(template({ durationMinutes: 90, subject: "{終了時刻}" }), appt);
    expect(appt.subject).toBe("11:30");
  });

  it("(5) does not add duplicate attendees", async () => {
    const appt = new FakeAppointment();
    appt.required = ["A@example.com"];
    await applyTemplate(template({ requiredAttendees: ["a@example.com", "c@example.com"] }), appt);
    expect(appt.required).toEqual(["A@example.com", "c@example.com"]);

    const appt2 = new FakeAppointment();
    appt2.required = ["a@example.com"];
    await applyTemplate(template({ requiredAttendees: ["a@example.com"] }), appt2);
    expect(appt2.calls).not.toContain("addRequiredAttendees");
  });

  it("(6) collects failures and continues with remaining fields", async () => {
    const appt = new FakeAppointment();
    appt.failOn = new Set(["setEnd", "setSubject", "addOptionalAttendees"]);
    const result = await applyTemplate(template(), appt);

    expect(result.failures).toEqual([
      { field: "終了日時", message: "setEnd failed" },
      { field: "件名", message: "setSubject failed" },
      { field: "任意出席者", message: "addOptionalAttendees failed" },
    ]);
    // End time unchanged, so {終了時刻} falls back to the original end.
    expect(appt.body).toBe("10:00〜10:30<br>&lt;議題&gt;<br>");
    expect(appt.location).toBe("会議室A");
    expect(appt.required).toEqual(["a@example.com"]);
  });

  it("(7) aborts without changes when the date/time cannot be read", async () => {
    const appt = new FakeAppointment();
    appt.failOn = new Set(["getStart"]);

    await expect(applyTemplate(template(), appt)).rejects.toBeInstanceOf(DateTimeUnavailableError);
    expect(appt.calls.filter((c) => c.startsWith("set") || c.startsWith("add"))).toEqual([]);
  });

  it("(8) prepends the body and keeps the existing body", async () => {
    const appt = new FakeAppointment();
    appt.body = "<p>署名</p>";
    await applyTemplate(template({ body: "本文" }), appt);
    expect(appt.body).toBe("本文<br><p>署名</p>");

    await applyTemplate(template({ body: "二回目" }), appt);
    expect(appt.body).toBe("二回目<br>本文<br><p>署名</p>");
  });

  it("(9) keeps the end time of an all-day event", async () => {
    const appt = new FakeAppointment();
    appt.start = new Date("2026-11-04T15:00:00Z"); // 11/05 00:00 JST
    appt.end = new Date("2026-11-05T15:00:00Z"); // 11/06 00:00 JST
    const result = await applyTemplate(template({ subject: "{開始時刻}-{終了時刻}" }), appt);

    expect(result.failures).toEqual([]);
    expect(appt.calls).not.toContain("setEnd");
    expect(appt.end.toISOString()).toBe("2026-11-05T15:00:00.000Z");
    expect(appt.subject).toBe("00:00-00:00");
  });

  it("(10) keeps attendees added by a previously applied template", async () => {
    const appt = new FakeAppointment();
    await applyTemplate(template({ requiredAttendees: ["a@example.com"] }), appt);
    await applyTemplate(template({ requiredAttendees: ["c@example.com"] }), appt);
    expect(appt.required).toEqual(["a@example.com", "c@example.com"]);
  });

  it("(11) does not add required attendees as optional", async () => {
    const appt = new FakeAppointment();
    appt.required = ["Existing@example.com"];
    await applyTemplate(
      template({
        requiredAttendees: ["a@example.com"],
        optionalAttendees: ["A@example.com", "existing@example.com", "b@example.com"],
      }),
      appt,
    );

    expect(appt.required).toEqual(["Existing@example.com", "a@example.com"]);
    expect(appt.optional).toEqual(["b@example.com"]);
  });
});
