import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HabitatPreset } from "../src/contracts/habitat.ts";
import type { Investigation } from "../src/contracts/investigation.ts";
import { RankItem } from "../src/contracts/rank.ts";
import {
  buildItems, computeScore, dimScore, FACTOR_ORDER, goalBand, goalExcerpt, HOW_RANKING_WORKS, loadInputs, rationale, typesafeGoal, type Inputs,
} from "../scripts/rank/build.ts";

const moon: HabitatPreset = { id: "moon", label: "Moon Base", o2Percent: 30, pressureKPa: 70.3, note: "" };
const inv = (o: Partial<Investigation>): Investigation => ({
  id: "PSI-T", title: "T", hardware: "h", hardwareGroup: "g", pds: "Prevention", pdsBasis: "Finds the limit.", sensors: [], objectives: "Find the oxygen limit. Second sentence.",
  fuelKind: "solid", fuel: "f", sampleShape: "s", o2Range: null, pressureRange: null, airflowRange: null, measurements: [], variables: [], sourceIds: ["psi:PSI-T"], ...o,
});
const inputs = (investigations: Investigation[], overlaps: Inputs["overlaps"] = []): Inputs => ({ investigations, overlaps, habitats: [moon], claims: [], fixtures: false });
const goal = (v: number | null) => async () => v;
const words = (s: string) => s.trim().split(/\s+/).length;

describe("score is the plain mean, null as 0", () => {
  it("matches three hand-computed rows", async () => {
    const [a, b, c] = await buildItems(
      inputs([
        inv({ id: "A", o2Range: [21, 34], pressureRange: [60, 80], pdsBasis: "Direct.", evidence: "flight" }), // 1,1,1,1,0.8 -> 4.8/5
        inv({ id: "B", o2Range: [21, 21], pdsBasis: "indirect: shows a thing", evidence: "ground" }), // 0,null,0.5,0.5,0.6 -> 1.6/5
        inv({ id: "C", pds: "Other" }), // null,null,0,null,null -> 0
      ]),
      async (i) => (i.id === "A" ? 0.8 : i.id === "B" ? 0.6 : null),
    ).then((x) => [x[0], x[1], x[2]]);
    expect(a.score).toBeCloseTo(0.96, 3);
    expect(b.score).toBeCloseTo(0.32, 3);
    expect(c.score).toBe(0);
    expect(computeScore(b.factors!)).toBe(b.score);
  });
});

describe("factors", () => {
  it("o2 and pressure follow Lane A's rule", () => {
    expect(dimScore(30, [21, 21], 5)).toBe(0); // d=9 >= floor 5
    expect(dimScore(30, [21, 34], 5)).toBe(1);
    expect(dimScore(30, [10, 20], 5)).toBe(0); // d=10, span 10
    expect(dimScore(25, [10, 20], 5)).toBeCloseTo(0.5);
    expect(dimScore(30, null, 5)).toBeNull();
  });
  it("agrees with overlap.json for single-dimension rows (real data)", async () => {
    const f = new URL("../public/data/overlap.json", import.meta.url);
    if (!existsSync(f)) return;
    const real = loadInputs();
    expect(real.fixtures).toBe(false);
    const items = await buildItems(real, goal(null));
    let checked = 0;
    for (const it of items) {
      const row = real.overlaps.find((o) => o.investigationId === it.investigationId && o.habitat === it.habitat)!;
      if (row.dimsUsed !== 1 || row.overlap === null) continue;
      const fac = it.factors!.find((x) => x.value !== null && (x.key === "o2" || x.key === "pressure"))!;
      expect(fac.value).toBeCloseTo(row.overlap, 3);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it("every item has five factors in order and short sentences; null factors carry no numbers", async () => {
    const items = await buildItems(
      inputs([
        inv({ id: "A", o2Range: [12, 34], conditionBasis: { o2: "record", pressure: null, excerpt: "At 12 to 34% O2." }, evidence: "flight" }),
        inv({ id: "B", pdsBasis: "indirect: " + "very long explanation ".repeat(10) }),
        inv({ id: "C", o2Range: [21.5, 21.7], pressureRange: [101.3, 101.3] }),
      ]),
      goal(null),
    );
    for (const it of items) {
      expect(() => RankItem.parse(it)).not.toThrow();
      expect(it.factors!.map((f) => f.key)).toEqual(FACTOR_ORDER);
      for (const f of it.factors!) {
        expect(f.reason).toMatch(/\.$/);
        expect(words(f.reason)).toBeLessThan(25);
        if (f.value === null) expect(f.reason).not.toMatch(/\d/);
      }
      expect(words(it.rationale)).toBeLessThan(25);
    }
    const o2 = items[0].factors![0];
    expect(o2.reason).toBe("Tested at 12 to 34% oxygen, which covers this habitat's 30% (stated in the record, not a data table).");
    expect(o2.excerpt).toBe("At 12 to 34% O2.");
    expect(items[2].factors![0].reason).toBe("Tested at 21.5 to 21.7% oxygen; this habitat is at 30%.");
    expect(items[0].factors![1].reason).toBe("Pressure is not on record.");
  });
  it("directness and evidence values", async () => {
    const [d, i, o, g] = await buildItems(
      inputs([inv({ id: "D", pdsBasis: "Maps limits.", pds: "Detection" }), inv({ id: "I", pdsBasis: "indirect: shows soot limits" }), inv({ id: "O", pds: "Other" }), inv({ id: "G", evidence: "ground" })]),
      goal(null),
    );
    expect(d.factors![2]).toMatchObject({ value: 1, reason: "Directly about detection." });
    expect(i.factors![2]).toMatchObject({ value: 0.5, reason: "Shows soot limits." });
    expect(o.factors![2]).toMatchObject({ value: 0, reason: "Not a combustion experiment." });
    expect(d.factors![3]).toMatchObject({ value: null, reason: "Not stated." });
    expect(g.factors![3].value).toBe(0.5);
  });
  it("goal fit shows its evidence, and is null without a rating", async () => {
    const [on, off] = await buildItems(inputs([inv({ id: "Y" }), inv({ id: "N" })]), async (i) => (i.id === "Y" ? 0.75 : null));
    expect(on.factors![4]).toMatchObject({ value: 0.75, reason: "SI read the stated goal and rated the fit high.", sourceId: "psi:Y", excerpt: "Find the oxygen limit. Second sentence." });
    expect(off.factors![4]).toMatchObject({ value: null, reason: "SI rating unavailable." });
    expect(off.factors![4].excerpt).toBeUndefined();
    expect([0.1, 0.5, 0.7].map(goalBand)).toEqual(["low", "medium", "high"]);
    expect(goalExcerpt(inv({ objectives: "A. ".repeat(300) })).length).toBeLessThanOrEqual(400);
  });
  it("no key and no cache gives null, never a made-up number", async () => {
    expect(await typesafeGoal(undefined)(inv({ objectives: "Never cached sentence 9f3a." }), moon)).toBeNull();
  });
});

describe("wording", () => {
  it("never says 'no conditions' unless both are null, and never 'rests on relevance'", async () => {
    const items = await buildItems(inputs([inv({ id: "P", o2Range: [21, 34] }), inv({ id: "Q" })]), goal(0.9));
    for (const it of items) {
      expect(it.rationale).not.toMatch(/No oxygen or pressure|rests on/);
      expect(it.rationale).toMatch(/\.$/);
    }
    expect(items[0].rationale).toBe("Strong oxygen match; pressure is not on record.");
  });
  it("provenance: measured with a table condition, illustrative without", async () => {
    const items = await buildItems(
      inputs([inv({ id: "T", o2Range: [21, 34] }), inv({ id: "R", o2Range: [21, 34], conditionBasis: { o2: "record", pressure: null } }), inv({ id: "N" })]),
      goal(null),
    );
    expect(items.map((i) => i.provenance)).toEqual(["measured", "illustrative", "illustrative"]);
  });
  it("rationale handles all-equal and empty cases", () => {
    expect(rationale([{ key: "o2", label: "", value: null, reason: "" }])).toBe("Nothing is known for any of the five checks.");
  });
  it("HOW_RANKING_WORKS is four sentences", () => {
    expect(HOW_RANKING_WORKS.split(/(?<=\.)\s+/)).toHaveLength(4);
  });
  it("real data builds and is deterministic", async () => {
    if (!existsSync(new URL("../public/data/investigations.json", import.meta.url))) return;
    const a = await buildItems(loadInputs(), goal(0.5));
    const b = await buildItems(loadInputs(), goal(0.5));
    expect(a).toEqual(b);
    expect(readFileSync(new URL("../public/data/habitats.json", import.meta.url), "utf8")).toContain("moon");
  });
});
