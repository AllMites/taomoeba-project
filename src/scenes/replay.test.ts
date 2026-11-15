import { describe, expect, it } from "vitest";
import { BASE_ORDER } from "../app/console.ts";
import { replayFor } from "./replay.ts";

describe("what the center replay shows", () => {
  it("burn and spread play in the base's cabin with its own habitat; Earth and the station share the station's air", () => {
    for (const m of ["burn", "spread"] as const)
      expect(BASE_ORDER.map((b) => [b, replayFor(b, m).scene, replayFor(b, m).habitat])).toEqual([
        ["iss", "lunar", "iss"],
        ["moon", "lunar", "moon"],
        ["rover", "lunar", "rover"],
        ["earth", "lunar", "iss"],
      ]);
  });

  it("the Saffire flight test is the same for every base, and keeps the base's habitat for its notes", () => {
    for (const b of BASE_ORDER) expect(replayFor(b, "saffire").scene).toBe("saffire");
    expect(replayFor("rover", "saffire").habitat).toBe("rover");
    expect(replayFor("moon", "saffire").poster).toBe("/img/scenes/saffire.webp");
  });

  it("the caption names the scene and the base, says illustration where it is drawn, and stays one short line", () => {
    expect(replayFor("moon", "burn", "Moon Base").caption).toBe("A fuel droplet burning in the Moon Base cabin. Illustration, not a simulation.");
    expect(replayFor("earth", "spread").caption).toMatch(/^What if a fire starts in a cabin on Earth, at 1 g\? Illustration/);
    expect(replayFor("iss", "saffire").caption).not.toMatch(/Illustration/);
    for (const b of BASE_ORDER) for (const m of ["burn", "spread", "saffire"] as const) expect(replayFor(b, m, "Pressurized rover").caption.length).toBeLessThan(100);
  });

  it("the longer note sits behind the chip", () => {
    expect(replayFor("moon", "burn").notes[0]).toBe("No fire experiment on record ran in Moon gravity.");
    expect(replayFor("earth", "burn").notes.join(" ")).toMatch(/teardrop/);
    expect(replayFor("iss", "saffire").notes).toEqual([]);
  });
});
