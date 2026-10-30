import {
  buildPlaceholderValues,
  expandPlaceholders,
  formatDate,
  formatTime,
  LocalDateTime,
  plainTextToHtml,
} from "../../src/core/placeholder";

const dt = (year: number, month: number, day: number, hours = 0, minutes = 0): LocalDateTime => ({
  year,
  month,
  day,
  hours,
  minutes,
});

describe("formatDate", () => {
  it.each([
    [dt(2026, 11, 5), "2026/11/05(木)"],
    [dt(2026, 1, 31), "2026/01/31(土)"],
    [dt(2026, 12, 31), "2026/12/31(木)"],
    [dt(2027, 1, 1), "2027/01/01(金)"],
    [dt(2028, 2, 29), "2028/02/29(火)"],
    [dt(2026, 11, 1), "2026/11/01(日)"],
  ])("%o -> %s", (d, expected) => {
    expect(formatDate(d)).toBe(expected);
  });
});

describe("formatTime", () => {
  it("pads hours and minutes", () => {
    expect(formatTime(dt(2026, 1, 1, 9, 5))).toBe("09:05");
    expect(formatTime(dt(2026, 1, 1, 0, 0))).toBe("00:00");
    expect(formatTime(dt(2026, 1, 1, 23, 59))).toBe("23:59");
  });
});

describe("expandPlaceholders", () => {
  const v = buildPlaceholderValues(dt(2026, 11, 5, 10, 0), dt(2026, 11, 5, 11, 0));

  it("replaces all placeholders", () => {
    expect(expandPlaceholders("{日付} {開始時刻}〜{終了時刻} 定例会議", v)).toBe(
      "2026/11/05(木) 10:00〜11:00 定例会議",
    );
  });

  it("replaces every occurrence", () => {
    expect(expandPlaceholders("{日付}/{日付}", v)).toBe("2026/11/05(木)/2026/11/05(木)");
  });

  it("keeps unknown placeholders", () => {
    expect(expandPlaceholders("{場所} {日付}", v)).toBe("{場所} 2026/11/05(木)");
  });

  it("returns text without placeholders unchanged", () => {
    expect(expandPlaceholders("定例会議", v)).toBe("定例会議");
  });
});

describe("plainTextToHtml", () => {
  it("escapes HTML special characters", () => {
    expect(plainTextToHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });

  it("converts LF and CRLF to <br>", () => {
    expect(plainTextToHtml("a\nb\r\nc")).toBe("a<br>b<br>c");
  });
});
