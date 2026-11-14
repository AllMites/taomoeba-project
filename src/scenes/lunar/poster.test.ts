import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { posterFor } from "./poster.ts";

describe("fallback poster", () => {
  it("uses the phone-framed poster in a narrow box, so the readouts sit over sky, not over the habitat", () => {
    expect(posterFor("moon", 343)).toBe("/img/scenes/lunar-moon-narrow.webp");
    expect(posterFor("rover", 343)).toBe("/img/scenes/lunar-rover-narrow.webp");
    expect(posterFor("moon", 1408)).toBe("/img/scenes/lunar-moon.webp");
    expect(posterFor("iss", 343)).toBe("/img/scenes/lunar-iss.webp");
  });

  it("ships every poster it can ask for", () => {
    for (const shot of ["moon", "rover", "iss"] as const)
      for (const w of [343, 1408]) expect(existsSync(`public${posterFor(shot, w)}`), posterFor(shot, w)).toBe(true);
  });
});
