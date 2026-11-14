import { describe, expect, it } from "vitest";
import { flameLook, leanFromAirflow, REF_O2_PERCENT, REF_PRESSURE_KPA } from "./look.ts";

describe("flameLook (illustrative air-to-look mapping)", () => {
  it("is exactly 1 / 1 at reference air", () => {
    expect(flameLook(REF_O2_PERCENT, REF_PRESSURE_KPA)).toEqual({ scale: 1, brightness: 1, lit: true });
    expect(flameLook(REF_O2_PERCENT)).toEqual({ scale: 1, brightness: 1, lit: true });
  });

  it("draws the Moon Base air (30 %, 70.3 kPa) tighter and brighter than station air", () => {
    const moon = flameLook(30, 70.3);
    expect(moon.scale).toBeLessThan(1);
    expect(moon.brightness).toBeGreaterThan(1);
  });

  it("more oxygen is brighter and smaller; lower pressure is larger and dimmer", () => {
    expect(flameLook(25).brightness).toBeGreaterThan(flameLook(21).brightness);
    expect(flameLook(25).scale).toBeLessThan(flameLook(21).scale);
    expect(flameLook(21, 50).scale).toBeGreaterThan(flameLook(21, 101.3).scale);
    expect(flameLook(21, 50).brightness).toBeLessThan(flameLook(21, 101.3).brightness);
  });

  it("clamps extreme air so the drawing stays on screen", () => {
    const suit = flameLook(100, 29.6);
    expect(suit.brightness).toBe(2.5);
    expect(suit.scale).toBeGreaterThanOrEqual(0.6);
    expect(flameLook(5, 300).brightness).toBe(0.25);
  });

  it("is unlit with no oxygen, no pressure or bad input", () => {
    for (const look of [flameLook(0), flameLook(21, 0), flameLook(Number.NaN), flameLook(-3)]) {
      expect(look).toEqual({ scale: 0, brightness: 0, lit: false });
    }
  });
});

describe("leanFromAirflow", () => {
  it("is round in still air and leans more with more flow, up to a cap", () => {
    expect(leanFromAirflow(undefined)).toBe(0);
    expect(leanFromAirflow(0)).toBe(0);
    expect(leanFromAirflow(20)).toBeCloseTo(0.6);
    expect(leanFromAirflow(30)).toBeGreaterThan(leanFromAirflow(20));
    expect(leanFromAirflow(500)).toBe(1.5);
  });
});
