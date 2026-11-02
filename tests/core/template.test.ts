import { createEmptyTemplate, EventTemplate, parseCategoryList, validateTemplate } from "../../src/core/template";

const make = (overrides: Partial<EventTemplate> = {}): EventTemplate => ({
  ...createEmptyTemplate(),
  name: "定例会議",
  subject: "定例会議",
  ...overrides,
});

const fields = (t: EventTemplate, others: EventTemplate[] = []) => validateTemplate(t, others).map((e) => e.field);

describe("createEmptyTemplate", () => {
  it("creates distinct ids", () => {
    expect(createEmptyTemplate().id).not.toBe(createEmptyTemplate().id);
  });
});

describe("parseCategoryList", () => {
  it("splits, trims and drops empty entries", () => {
    expect(parseCategoryList(" 団体, 社外;定例\r\n\n 重要 ")).toEqual(["団体", "社外", "定例", "重要"]);
    expect(parseCategoryList("")).toEqual([]);
  });

  it("removes duplicates case-insensitively", () => {
    expect(parseCategoryList("Team\nteam\n団体,団体")).toEqual(["Team", "団体"]);
  });

  it("keeps spaces inside a name", () => {
    expect(parseCategoryList("赤の 分類")).toEqual(["赤の 分類"]);
  });
});

describe("validateTemplate", () => {
  it("accepts a valid template", () => {
    expect(fields(make({ requiredAttendees: ["a@example.com"], durationMinutes: 60 }))).toEqual([]);
  });

  describe("name", () => {
    it("is required", () => {
      expect(fields(make({ name: "" }))).toEqual(["name"]);
      expect(fields(make({ name: "   " }))).toEqual(["name"]);
    });

    it("allows 50 chars and rejects 51", () => {
      expect(fields(make({ name: "あ".repeat(50) }))).toEqual([]);
      expect(fields(make({ name: "あ".repeat(51) }))).toEqual(["name"]);
    });

    it("rejects duplicates case-insensitively", () => {
      const other = make({ name: "Weekly" });
      expect(fields(make({ name: "weekly" }), [other])).toEqual(["name"]);
    });

    it("ignores itself when editing", () => {
      const self = make({ name: "Weekly" });
      expect(fields({ ...self }, [self])).toEqual([]);
    });
  });

  describe("content", () => {
    const blank = {
      subject: "",
      body: "",
      location: "",
      requiredAttendees: [],
      optionalAttendees: [],
      durationMinutes: null,
      sensitivity: "unchanged" as const,
      categories: [],
    };

    it("requires at least one field besides the name", () => {
      expect(fields(make(blank))).toEqual(["subject"]);
      expect(fields(make({ ...blank, subject: "  ", body: "\n", location: " " }))).toEqual(["subject"]);
    });

    it.each<[string, Partial<EventTemplate>]>([
      ["subject", { subject: "件名" }],
      ["body", { body: "本文" }],
      ["location", { location: "会議室A" }],
      ["requiredAttendees", { requiredAttendees: ["a@example.com"] }],
      ["optionalAttendees", { optionalAttendees: ["a@example.com"] }],
      ["durationMinutes", { durationMinutes: 60 }],
      ["sensitivity normal", { sensitivity: "normal" }],
      ["sensitivity private", { sensitivity: "private" }],
      ["categories", { categories: ["団体"] }],
    ])("accepts only %s", (_name, overrides) => {
      expect(fields(make({ ...blank, ...overrides }))).toEqual([]);
    });
  });

  it("rejects invalid attendees", () => {
    const errors = validateTemplate(make({ requiredAttendees: ["a@example.com", "bad"], optionalAttendees: ["x"] }), []);
    expect(errors.map((e) => e.field)).toEqual(["requiredAttendees", "optionalAttendees"]);
    expect(errors[0].message).toContain("bad");
  });

  describe("durationMinutes", () => {
    it.each([null, 1, 1440])("accepts %p", (d) => {
      expect(fields(make({ durationMinutes: d }))).toEqual([]);
    });

    it.each([0, 1441, 1.5, -1, NaN])("rejects %p", (d) => {
      expect(fields(make({ durationMinutes: d }))).toEqual(["durationMinutes"]);
    });
  });
});
