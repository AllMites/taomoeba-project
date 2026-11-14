import { describe, expect, it } from "vitest";
import type { HabitatPreset } from "../../contracts/index.ts";
import { airSide, compareLine, LIMITS, NOT_ON_RECORD, sidesFor } from "./copy.ts";

const iss: HabitatPreset = { id: "iss", label: "ISS", o2Percent: 21, pressureKPa: 101.3, note: "" };
const moon: HabitatPreset = { id: "moon", label: "Moon Base", o2Percent: 30, pressureKPa: 70.3, note: "" };

describe("lunar copy", () => {
  it("keeps the limits line to two sentences under 25 words each, in page vocabulary", () => {
    expect(LIMITS).toHaveLength(2);
    for (const s of LIMITS) expect(s.split(/\s+/).length).toBeLessThan(25);
    const all = [...LIMITS, compareLine(false, false), compareLine(true, true), compareLine(true, false)].join(" ");
    expect(all).not.toMatch(/\bAI\b|investigation|according to NASA/i);
  });

  it("claims nothing the record does not show", () => {
    // Moon gravity is not known to fall between weightless and Earth-gravity results, and the two flames are drawn
    // at different sizes, so neither "bracket" nor "same flame size" may appear.
    const all = [...LIMITS, compareLine(false, false)].join(" ");
    expect(all).not.toMatch(/bracket|same flame size/i);
  });

  it("reads label and numbers from the habitat prop, with units", () => {
    const odd: HabitatPreset = { id: "rover", label: "Test rover", o2Percent: 27.5, pressureKPa: 64, note: "" };
    const { sides, same } = sidesFor(odd, iss);
    expect(same).toBe(false);
    expect(sides.map((s) => [s.name, s.oxygen, s.pressure])).toEqual([
      ["ISS air", "21% oxygen", "101.3 kPa"],
      ["Test rover air", "27.5% oxygen", "64 kPa"],
    ]);
    expect(sides[1].o2Percent).toBe(27.5);
  });

  it("shows one flame when the pick is the station", () => {
    const { sides, same } = sidesFor(iss, undefined);
    expect(same).toBe(true);
    expect(sides).toHaveLength(1);
    expect(sides[0].name).toBe("ISS air");
  });

  it("compares Moon Base against station air", () => {
    const { sides } = sidesFor(moon, iss);
    expect(sides.map((s) => s.oxygen)).toEqual(["21% oxygen", "30% oxygen"]);
  });

  it("says Not on record and draws no flame when a value is missing", () => {
    const side = airSide({ ...moon, o2Percent: Number.NaN }, "x");
    expect(side.oxygen).toBe(NOT_ON_RECORD);
    expect(side.o2Percent).toBeUndefined();
    expect(sidesFor(moon, undefined).sides[0].oxygen).toBe(NOT_ON_RECORD);
  });
});
