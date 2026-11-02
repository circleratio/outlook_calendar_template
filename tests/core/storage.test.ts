import { byteSize, deserialize, exceedsLimit, MAX_BYTES, serialize, storedByteSize } from "../../src/core/storage";
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

  it("loads templates saved before sensitivity was added", () => {
    const { sensitivity: _omitted, ...legacy } = sample;
    const raw = JSON.stringify({ version: 1, templates: [legacy] });
    expect(deserialize(raw)).toEqual({ templates: [{ ...legacy, sensitivity: "unchanged" }] });
  });

  it("keeps a stored sensitivity", () => {
    const stored = { ...sample, sensitivity: "private" as const };
    expect(deserialize(serialize([stored]))).toEqual({ templates: [stored] });
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
    ["unknown sensitivity", JSON.stringify({ version: 1, templates: [{ ...sample, sensitivity: "secret" }] })],
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

describe("storedByteSize", () => {
  it("includes the second encoding of quotes and newlines", () => {
    expect(storedByteSize("abc")).toBe(5);
    expect(storedByteSize('"')).toBe(4);
    expect(storedByteSize("\n")).toBe(4);
    expect(storedByteSize("あ")).toBe(5);
  });
});

describe("exceedsLimit", () => {
  // storedByteSize adds 2 bytes for the surrounding quotes.
  const ofSize = (n: number) => "a".repeat(n - 2);

  it("allows data up to the limit and rejects data above it", () => {
    expect(exceedsLimit(ofSize(MAX_BYTES), "")).toBe(false);
    expect(exceedsLimit(ofSize(MAX_BYTES + 1), "")).toBe(true);
  });

  it("measures the size after the second encoding", () => {
    const quotes = '"'.repeat(MAX_BYTES / 2);
    expect(byteSize(quotes)).toBeLessThanOrEqual(MAX_BYTES);
    expect(exceedsLimit(quotes, "")).toBe(true);
  });

  it("allows only shrinking saves when the current data is over the limit", () => {
    const current = ofSize(MAX_BYTES + 100);
    expect(exceedsLimit(ofSize(MAX_BYTES + 50), current)).toBe(false);
    expect(exceedsLimit(current, current)).toBe(true);
    expect(exceedsLimit(ofSize(MAX_BYTES + 200), current)).toBe(true);
  });
});
