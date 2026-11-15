import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDoc, type WhatIfDoc } from "../whatif/logic.ts";
import { burnCase, startPick } from "./burn/model.ts";
import { advance, clock, phaseAt } from "./playback.ts";
import type { SaffireRecord } from "./saffire/timeline.ts";
import { burnTimeline, MODES, saffireTimeline, sceneFor, storyTimeline } from "./timelines.ts";
import { story } from "./spread/story.ts";

const doc = parseDoc(JSON.parse(readFileSync("public/data/whatif.json", "utf8"))) as WhatIfDoc;
const rec = JSON.parse(readFileSync("public/data/scenes/saffire.json", "utf8")) as SaffireRecord;

describe("scene picker", () => {
  it("three named scenes, fire in this base first; it and the lab view play in the cabin, Saffire in its own scene", () => {
    expect(MODES.map((m) => m.name)).toEqual(["Fire in this base", "Lab view: team model burn", "Real fire: Saffire flight test"]);
    expect(MODES.map((m) => sceneFor(m.id))).toEqual(["lunar", "lunar", "saffire"]);
  });
});

describe("one timeline", () => {
  it("the model burn runs to the predicted end, with the phase at each time", () => {
    const c = burnCase(doc, { o2Percent: 21, pressureKPa: 101.3 }, startPick(doc));
    if (c.kind !== "plan") throw new Error("expected a plan");
    const tl = burnTimeline(c, "k");
    expect(tl.end).toBeGreaterThan(c.plan.tEnd);
    expect(phaseAt(tl, 0)).toBe("Ignition");
    expect(phaseAt(tl, c.plan.tEnd / 2)).toMatch(/d² law/);
    expect(phaseAt(tl, c.plan.tEnd)).toMatch(/Flame out|Burned away/);
  });

  it("with no prediction the bar still plays a steady flame", () => {
    const c = burnCase(doc, { o2Percent: 30, pressureKPa: 70.3 }, startPick(doc));
    expect(burnTimeline(c, "k")).toMatchObject({ start: 0, end: 10, phases: [{ name: "Burning (no model timing)" }] });
  });

  it("Saffire starts with the igniter and plays at the stated 10x", () => {
    const tl = saffireTimeline(rec);
    expect(tl.start).toBeLessThan(0);
    expect(tl.rate).toBe(10);
    expect(phaseAt(tl, tl.start)).toBe("Igniter on");
    expect(phaseAt(tl, 1)).toMatch(/spreading/);
  });

  it("playback advances at the timeline's rate and stops at the end; the clock reads in seconds or minutes", () => {
    const tl = { key: "k", start: 0, end: 30, rate: 10, phases: [] };
    expect(advance(tl, 0, 1)).toEqual({ t: 10, ended: false });
    expect(advance(tl, 25, 1)).toEqual({ t: 30, ended: true });
    expect(clock(3.25)).toBe("3.3 s");
    expect(clock(65)).toBe("1:05");
  });
});

describe("fire in this base on the timeline", () => {
  it("five stage marks with their captions; the seeker's time gives the stage", () => {
    const st = story({ g: "micro", o2: 21, start: "cloth", response: "vent" });
    const tl = storyTimeline(st, "k", "a station module");
    expect(tl.phases.filter((p) => p.mark)).toHaveLength(5);
    expect(tl.end).toBe(st.end);
    expect(phaseAt(tl, 0)).toBe("Ignition");
    expect(phaseAt(tl, st.detect!)).toBe("Detection and response");
    expect(phaseAt(tl, tl.end)).toBe("Aftermath");
    for (const p of tl.phases) expect(p.caption).toBeTruthy();
  });
});
