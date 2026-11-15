import { describe, expect, it } from "vitest";
import { OBJECTS, reach, spreadEnd } from "../spread/spread.ts";
import { placeSpreadChips, spreadChips } from "./Spread.tsx";

const lives = { lives: true, test: null, beyond: false };
const byId = (cs: ReturnType<typeof spreadChips>, id: string) => cs.find((c) => c.id === id)!;

describe("labels on the spreading fire", () => {
  it("at ignition: front and unburnt fuel, no burnt zone; at the end: burnt zone only, front gone", () => {
    const cs = spreadChips("micro", 10);
    placeSpreadChips(cs, "micro", 21, lives, 0.01);
    expect(byId(cs, "front").hide).toBe(false);
    expect(byId(cs, "burnt").hide).toBe(true);
    expect(byId(cs, "unburnt").hide).toBe(false);
    const end = spreadEnd(OBJECTS, "micro", 21, lives);
    placeSpreadChips(cs, "micro", 21, lives, end + 1);
    expect(byId(cs, "front").hide).toBe(true);
    expect(byId(cs, "burnt").hide).toBe(false);
    expect(byId(cs, "burnt").at[0]).toBeCloseTo(reach(OBJECTS, "micro") / 2);
    expect(byId(cs, "unburnt").hide).toBe(true);
  });

  it("the front label follows the front", () => {
    const cs = spreadChips("micro", 10);
    const end = spreadEnd(OBJECTS, "micro", 21, lives);
    placeSpreadChips(cs, "micro", 21, lives, end / 2);
    expect(byId(cs, "front").at[0]).toBeCloseTo(reach(OBJECTS, "micro") / 2, 2);
  });
});
