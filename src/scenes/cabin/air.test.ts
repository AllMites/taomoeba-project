import { describe, expect, it } from "vitest";
import { airOf } from "./air.ts";

const iss = { id: "iss", label: "ISS", o2Percent: 21, pressureKPa: 101.3 } as never;
const moon = { id: "moon", label: "Moon Base", o2Percent: 30, pressureKPa: 70.3 } as never;

describe("cabin air", () => {
  it("names the base's air and its numbers", () => {
    expect(airOf("moon", moon)).toMatchObject({ name: "Moon Base air", readout: "30% oxygen · 70.3 kPa", gravity: "micro" });
    expect(airOf("iss", iss).name).toBe("station air");
  });
  it("Earth burns the station's air at 1 g", () => {
    expect(airOf("earth", iss)).toMatchObject({ name: "air on Earth", o2Percent: 21, gravity: "earth" });
  });
});
