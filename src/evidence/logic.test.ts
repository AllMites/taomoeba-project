import { describe, expect, it } from "vitest";
import { conditionRows, formatRange, scoreText, strengthWord, textOrNotOnRecord, visibleBlocks } from "./logic.ts";

describe("formatRange", () => {
  it("handles null, single value, span", () => {
    expect(formatRange(null, "%")).toBeNull();
    expect(formatRange([21, 21], "%")).toBe("21 %");
    expect(formatRange([70.2, 309.3], "kPa")).toBe("70.2 to 309.3 kPa");
    expect(formatRange([0, 5], "cm/s")).toBe("0 to 5 cm/s");
  });
});

describe("textOrNotOnRecord", () => {
  it("maps Not stated and blanks", () => {
    expect(textOrNotOnRecord("Not stated")).toBeNull();
    expect(textOrNotOnRecord(" not stated ")).toBeNull();
    expect(textOrNotOnRecord("")).toBeNull();
    expect(textOrNotOnRecord("Heptane")).toBe("Heptane");
  });
});

describe("conditionRows", () => {
  it("always returns six rows and flags table basis only when a value exists", () => {
    const rows = conditionRows({
      o2Range: [12, 34], pressureRange: null, airflowRange: null,
      fuel: "Not stated", sampleShape: "droplet", hardware: "Not stated",
      conditionBasis: { o2: "table", pressure: "table" },
    });
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ value: "12 to 34 %", fromTable: true });
    expect(rows[1]).toMatchObject({ value: null, fromTable: false });
    expect(rows[3].value).toBeNull();
    expect(rows[4].value).toBe("droplet");
  });
});

describe("visibleBlocks", () => {
  const none = { summary: 0, findings: 0, rationale: 0, factors: 0, sensors: 0, measurements: 0, changing: 0, related: 0 };
  it("skips empty blocks", () => {
    expect(visibleBlocks(none)).toEqual({ summarize: false, why: false, measured: false, changed: false, related: false });
  });
  it("shows blocks with content", () => {
    expect(visibleBlocks({ ...none, findings: 1, sensors: 2, related: 1 })).toMatchObject({ summarize: true, measured: true, related: true, why: false });
  });
});

describe("words", () => {
  it("strength and score", () => {
    expect(strengthWord(null)).toBe("Not on record");
    expect(strengthWord(1)).toBe("Strong");
    expect(strengthWord(0.5)).toBe("Partial");
    expect(strengthWord(0.1)).toBe("Weak");
    expect(scoreText(0.775)).toBe("Score 0.78 of 1");
  });
});
