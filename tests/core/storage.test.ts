import { byteSize, deserialize, serialize } from "../../src/core/storage";
import { createEmptyTemplate, EventTemplate } from "../../src/core/template";

const sample: EventTemplate = {
  ...createEmptyTemplate(),
  name: "定例会議",
  subject: "{日付} 定例会議",
  body: "議題\n- 進捗",
  location: "会議室A",
  requiredAttendees: ["a@example.com"],
  optionalAttendees: [],
  durationMinutes: 60,
};

describe("serialize / deserialize", () => {
  it("round-trips", () => {
    expect(deserialize(serialize([sample]))).toEqual({ templates: [sample] });
  });

  it("accepts an already-parsed object", () => {
    expect(deserialize(JSON.parse(serialize([sample])))).toEqual({ templates: [sample] });
  });

  it("treats never-saved settings as empty without warning", () => {
    expect(deserialize(undefined)).toEqual({ templates: [] });
    expect(deserialize(null)).toEqual({ templates: [] });
  });

  it.each([
    ["broken JSON", "{not json"],
    ["unknown version", JSON.stringify({ version: 2, templates: [] })],
    ["missing templates", JSON.stringify({ version: 1 })],
    ["invalid template", JSON.stringify({ version: 1, templates: [{ id: "x" }] })],
    ["non-object", 42],
  ])("warns on %s", (_label, raw) => {
    const result = deserialize(raw);
    expect(result.templates).toEqual([]);
    expect(result.warning).toBeDefined();
  });
});

describe("byteSize", () => {
  it("counts UTF-8 bytes", () => {
    expect(byteSize("abc")).toBe(3);
    expect(byteSize("あ")).toBe(3);
    expect(byteSize("")).toBe(0);
  });
});
