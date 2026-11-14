import { describe, expect, it } from "vitest";
import {
  columnHeader, conditionRows, formatRange, isSwitch, rationaleFor, safeHref, scoreText, strengthWord, textOrNotOnRecord, visibleBlocks,
} from "./logic.ts";

describe("columnHeader", () => {
  it("drops the source unit so a converted column shows one unit", () => {
    expect(columnHeader({ original: "Ambient Pressure (atm)", unit: "kPa" })).toBe("Ambient Pressure (kPa)");
    expect(columnHeader({ original: "Ambient pressure; mmHg", unit: "kPa" })).toBe("Ambient pressure (kPa)");
    expect(columnHeader({ original: "Sample Width (cm)", unit: "cm" })).toBe("Sample Width (cm)");
    expect(columnHeader({ original: "Peak burner T (C )", unit: "C" })).toBe("Peak burner T (C)");
    expect(columnHeader({ original: "O initial ambient composition; mole fraction", unit: "%" })).toBe("O initial ambient composition (%)");
  });
  it("keeps notes and qualifiers that are not units", () => {
    expect(columnHeader({ original: "Percent O2 (Note 1)", unit: "%" })).toBe("Percent O2 (Note 1) (%)");
    expect(columnHeader({ original: "XO2 (init)", unit: "%" })).toBe("XO2 (init) (%)");
    expect(columnHeader({ original: "Material", unit: null })).toBe("Material");
  });
});

describe("safeHref", () => {
  it("links only http(s)", () => {
    expect(safeHref("https://psi.nasa.gov/x")).toBe("https://psi.nasa.gov/x");
    expect(safeHref("http://example.org")).toBe("http://example.org");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("isSwitch", () => {
  it("is true only when one open experiment replaces another", () => {
    expect(isSwitch("PSI-69", "PSI-68")).toBe(true);
    expect(isSwitch(null, "PSI-69")).toBe(false);
    expect(isSwitch("PSI-69", null)).toBe(false);
    expect(isSwitch("PSI-69", "PSI-69")).toBe(false);
  });
});

describe("rationaleFor", () => {
  const claims = [
    { kind: "rationale", investigationId: "PSI-99", habitat: "iss" },
    { kind: "rationale", investigationId: "PSI-99", habitat: "moon" },
    { kind: "summary", investigationId: "PSI-99" },
  ];
  it("returns the picked habitat's lines and none for a habitat with no lines", () => {
    expect(rationaleFor(claims, "PSI-99", "iss")).toHaveLength(1);
    expect(rationaleFor(claims, "PSI-99", "mars")).toHaveLength(0);
  });
});

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
    expect(strengthWord(0.8)).toBe("Strong");
    // matches the card rationale, which calls 0.725 a "partial goal fit"
    expect(strengthWord(0.77)).toBe("Partial");
    expect(strengthWord(0.5)).toBe("Partial");
    expect(strengthWord(0.1)).toBe("Weak");
    expect(scoreText(0.775)).toBe("Score 0.78 of 1");
  });
});
