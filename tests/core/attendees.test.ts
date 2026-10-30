import { isValidEmail, mergeAttendees, parseEmailList } from "../../src/core/attendees";

describe("parseEmailList", () => {
  it("splits by comma, semicolon and newline", () => {
    expect(parseEmailList("a@example.com, b@example.com;c@example.com\nd@example.com\r\ne@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
      "d@example.com",
      "e@example.com",
    ]);
  });

  it("trims and drops empty entries", () => {
    expect(parseEmailList("  a@example.com ,, ;\n\n  ")).toEqual(["a@example.com"]);
    expect(parseEmailList("")).toEqual([]);
  });
});

describe("isValidEmail", () => {
  it.each(["a@example.com", "first.last+tag@sub.example.co.jp"])("accepts %s", (s) => {
    expect(isValidEmail(s)).toBe(true);
  });

  it.each(["", "a", "a@", "@example.com", "a@example", "a b@example.com", "a@@example.com"])("rejects %s", (s) => {
    expect(isValidEmail(s)).toBe(false);
  });
});

describe("mergeAttendees", () => {
  it("returns only addresses not in existing, case-insensitively", () => {
    expect(mergeAttendees(["A@Example.com"], ["a@example.com", "b@example.com"])).toEqual(["b@example.com"]);
  });

  it("dedupes within toAdd", () => {
    expect(mergeAttendees([], ["b@example.com", "B@example.com"])).toEqual(["b@example.com"]);
  });

  it("returns empty when nothing new", () => {
    expect(mergeAttendees(["a@example.com"], ["a@example.com"])).toEqual([]);
    expect(mergeAttendees(["a@example.com"], [])).toEqual([]);
  });
});
