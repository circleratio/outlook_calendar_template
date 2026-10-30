import { createEmptyTemplate, EventTemplate, validateTemplate } from "../../src/core/template";

const make = (overrides: Partial<EventTemplate> = {}): EventTemplate => ({
  ...createEmptyTemplate(),
  name: "定例会議",
  ...overrides,
});

const fields = (t: EventTemplate, others: EventTemplate[] = []) => validateTemplate(t, others).map((e) => e.field);

describe("createEmptyTemplate", () => {
  it("creates distinct ids", () => {
    expect(createEmptyTemplate().id).not.toBe(createEmptyTemplate().id);
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
