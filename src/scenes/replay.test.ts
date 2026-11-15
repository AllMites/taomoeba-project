import { describe, expect, it } from "vitest";
import { BASE_ORDER } from "../app/console.ts";
import { replayFor } from "./replay.ts";

describe("what the center replay shows", () => {
  it("Now is the lunar scene with the base's own habitat; Earth and the station share the station's air", () => {
    expect(BASE_ORDER.map((b) => [b, replayFor(b, "now").scene, replayFor(b, "now").habitat])).toEqual([
      ["iss", "lunar", "iss"],
      ["moon", "lunar", "moon"],
      ["rover", "lunar", "rover"],
      ["earth", "lunar", "iss"],
    ]);
  });

  it("Past is the Saffire fire for every base, and keeps the base's habitat for its notes", () => {
    for (const b of BASE_ORDER) expect(replayFor(b, "past").scene).toBe("saffire");
    expect(replayFor("rover", "past").habitat).toBe("rover");
    expect(replayFor("moon", "past").poster).toBe("/img/scenes/saffire.webp");
  });

  it("each surface base has its own still picture and phone crop; the others use the flames-only still", () => {
    expect(replayFor("moon", "now")).toMatchObject({ poster: "/img/scenes/lunar-moon.webp", posterNarrow: "/img/scenes/lunar-moon-narrow.webp" });
    expect(replayFor("rover", "now").poster).toBe("/img/scenes/lunar-rover.webp");
    for (const b of ["iss", "earth"] as const) {
      expect(replayFor(b, "now").poster).toBe("/img/scenes/lunar-iss.webp");
      expect(replayFor(b, "now").posterNarrow).toBeUndefined();
    }
  });

  it("the caption names the picked base, says it is an illustration, and stays one short line", () => {
    expect(replayFor("moon", "now", "Moon Base").caption).toBe("Now: station air beside Moon Base air. Illustration, not a simulation.");
    expect(replayFor("earth", "now").caption).toMatch(/Earth.*1 g.*Illustration, not a simulation/);
    for (const b of BASE_ORDER) expect(replayFor(b, "now").caption).toContain("Illustration, not a simulation.");
    for (const b of BASE_ORDER) for (const w of ["past", "now"] as const) expect(replayFor(b, w, "Pressurized rover").caption.length).toBeLessThan(90);
  });

  it("the longer note sits behind the chip, and the stage clears room for as many flames as the scene draws", () => {
    expect(replayFor("moon", "now").notes[0]).toBe("No fire experiment on record ran in Moon gravity.");
    expect(replayFor("earth", "now").notes.join(" ")).toMatch(/teardrop/);
    expect(BASE_ORDER.map((b) => replayFor(b, "now").flames)).toEqual([1, 2, 2, 2]);
    expect(replayFor("iss", "past")).toMatchObject({ flames: 0, notes: [] });
  });

  it("the longer note sits behind the chip, and the stage clears room for as many flames as the scene draws", () => {
    expect(replayFor("moon", "now").notes[0]).toBe("No fire experiment on record ran in Moon gravity.");
    expect(replayFor("earth", "now").notes.join(" ")).toMatch(/teardrop/);
    expect(BASE_ORDER.map((b) => replayFor(b, "now").flames)).toEqual([1, 2, 2, 2]);
    expect(replayFor("iss", "past")).toMatchObject({ flames: 0, notes: [] });
  });
});
