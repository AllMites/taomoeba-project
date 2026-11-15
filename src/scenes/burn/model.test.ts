import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diameterAt, parseDoc, type WhatIfDoc } from "../../whatif/logic.ts";
import { burnCase, dropletAt, startPick } from "./model.ts";

const doc = parseDoc(JSON.parse(readFileSync("public/data/whatif.json", "utf8"))) as WhatIfDoc;
const ISS = { o2Percent: 21, pressureKPa: 101.3 };
const MOON = { o2Percent: 30, pressureKPa: 70.3 };

describe("model burn in the base's air", () => {
  it("station air has a prediction; the seeker time maps to the d-squared diameter", () => {
    const c = burnCase(doc, ISS, startPick(doc));
    expect(c.kind).toBe("plan");
    if (c.kind !== "plan") return;
    const { plan } = c;
    expect(dropletAt(c, 0, 0).d).toBeCloseTo(plan.d0, 6);
    const mid = plan.tEnd / 2;
    expect(dropletAt(c, mid, 0).d).toBeCloseTo(Math.sqrt(plan.d0 ** 2 - plan.k * mid), 6);
    expect(dropletAt(c, mid, 0).d).toBe(diameterAt(plan, mid));
    expect(dropletAt(c, mid, 0).lit).toBe(true);
    const end = dropletAt(c, plan.tEnd, 0);
    expect(end.lit).toBe(false);
    expect(end.d).toBeCloseTo(plan.dEnd, 6);
    // Past the end the droplet stays at its last size.
    expect(dropletAt(c, plan.tEnd * 2, 0).d).toBeCloseTo(plan.dEnd, 6);
  });

  it("Moon Base air has no prediction: the flame stays lit and steady, with no model numbers", () => {
    const c = burnCase(doc, MOON, startPick(doc));
    expect(c).toMatchObject({ kind: "none", reason: "moon-like" });
    const now = dropletAt(c, 50, 2);
    expect(now).toEqual({ d: 2, lit: true, phase: "Burning (no model timing)" });
  });

  it("on Earth the microgravity model does not apply: a steady flame, no numbers", () => {
    expect(burnCase(doc, ISS, startPick(doc), true)).toMatchObject({ kind: "none", reason: "earth" });
  });

  it("air outside the grid (a suit at very high oxygen) has no prediction either", () => {
    expect(burnCase(doc, { o2Percent: 95, pressureKPa: 30 }, startPick(doc))).toMatchObject({ kind: "none", reason: "outside" });
  });
});
