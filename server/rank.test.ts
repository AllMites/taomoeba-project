import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HabitatPreset } from "../src/contracts/habitat.ts";
import type { Investigation } from "../src/contracts/investigation.ts";
import { compareRank } from "../scripts/rank/compare.ts";
import { RankItem } from "../src/contracts/rank.ts";
import {
  buildItems, computeScore, FACTOR_WEIGHTS, dimScore, FACTOR_ORDER, FLOOR, goalBand, goalExcerpt, HOW_RANKING_WORKS, loadInputs, rationale, typesafeGoal, type Inputs,
} from "../scripts/rank/build.ts";

const moon: HabitatPreset = { id: "moon", label: "Moon Base", o2Percent: 30, pressureKPa: 70.3, note: "" };
const inv = (o: Partial<Investigation>): Investigation => ({
  id: "PSI-T", title: "T", hardware: "h", hardwareGroup: "g", pds: "Prevention", pdsBasis: "Finds the limit.", sensors: [], objectives: "Find the oxygen limit. Second sentence.",
  fuelKind: "solid", fuel: "f", sampleShape: "s", o2Range: null, pressureRange: null, airflowRange: null, measurements: [], variables: [], sourceIds: ["psi:PSI-T"], ...o,
});
const inputs = (investigations: Investigation[], overlaps: Inputs["overlaps"] = []): Inputs => ({ investigations, overlaps, habitats: [moon], claims: [], fixtures: false });
const goal = (v: number | null) => async () => v;
const words = (s: string) => s.trim().split(/\s+/).length;

describe("score is the weighted mean (o2 2, pressure 2, others 1), null counts as half", () => {
  it("matches four hand-computed rows", async () => {
    const rows = await buildItems(
      inputs([
        inv({ id: "A", o2Range: [21, 34], pressureRange: [60, 80], pdsBasis: "Direct.", evidence: "flight" }), // (2+2+1+1+0.8)/7
        inv({ id: "B", o2Range: [21, 21], pdsBasis: "indirect: shows a thing", evidence: "ground" }), // (0+1+0.5+0.5+0.6)/7: measured miss 0, unknown pressure 0.5x2
        inv({ id: "C", pds: "Other" }), // (1+1+0+0.5+0.5)/7: Other keeps directness 0
        inv({ id: "D", o2Range: [25, 40], pressureRange: [101.3, 101.3], pdsBasis: "Direct." }), // (2+0+1+0.5+0.2)/7
      ]),
      async (i) => ({ A: 0.8, B: 0.6, C: null, D: 0.2 })[i.id as "A"] ?? null,
    );
    expect(rows.map((r) => r.score)).toEqual([0.971, 0.371, 0.429, 0.529]);
    expect(rows[2].factors!.map((f) => f.value)).toEqual([null, null, 0, null, null]); // values stay null in the data
    expect(computeScore(rows[1].factors!)).toBe(rows[1].score);
  });
  it("an unknown condition scores above a measured mismatch and below a match", async () => {
    const [miss, gap, hit] = await buildItems(inputs([inv({ id: "X", o2Range: [21, 21] }), inv({ id: "Y" }), inv({ id: "Z", o2Range: [21, 34] })]), goal(0.5));
    expect(miss.score).toBeLessThan(gap.score);
    expect(gap.score).toBeLessThan(hit.score);
  });
});

describe("compareRank", () => {
  const r = (investigationId: string, score: number, vals: (number | null)[]) => ({ investigationId, score, factors: vals.map((value) => ({ value })) });
  it("score, then coverage, then id", () => {
    const list = [r("PSI-9", 0.5, [1, null, null, null, 1]), r("PSI-2", 0.5, [1, 1, 1, null, null]), r("PSI-1", 0.5, [1, 1, 1, null, null]), r("PSI-5", 0.7, [null, null, null, null, 1])];
    expect(list.sort(compareRank).map((x) => x.investigationId)).toEqual(["PSI-5", "PSI-1", "PSI-2", "PSI-9"]);
    expect(compareRank(r("A", 0.5004, [1]), r("B", 0.5, [1, 1]))).toBeGreaterThan(0); // within 0.0005 = tie, more factors first
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

describe("goal fit asks once per atmosphere", () => {
  const rover: HabitatPreset = { ...moon, id: "rover", label: "Pressurized rover" };
  it("moon and rover share one call, and the question names conditions, not the habitat", async () => {
    let calls = 0;
    const bodies: string[] = [];
    const fetchImpl = (async (_u: unknown, init: RequestInit) => {
      calls++;
      bodies.push(String(init.body));
      return new Response(JSON.stringify({ model: "jev-test", answers: { goalFit: { score: 3 } }, usage: { input_tokens: 1, output_tokens: 1 } }));
    }) as unknown as typeof fetch;
    const g = typesafeGoal("test-key", fetchImpl, mkdtempSync(join(tmpdir(), "rank-")));
    const one = inv({ objectives: "Unique probe sentence 51ab for atmosphere reuse." });
    expect(await g(one, moon)).toBe(0.75);
    expect(await g(one, rover)).toBe(0.75);
    expect(calls).toBe(1);
    expect(bodies[0]).toContain("a crewed habitat at 30% oxygen and 70.3 kPa");
    expect(bodies[0]).not.toMatch(/Moon Base|rover/i);
  });
  it("committed rank.json has identical goalFit for moon and rover on every investigation", () => {
    const f = new URL("../public/data/rank.json", import.meta.url);
    if (!existsSync(f)) return;
    const items = (JSON.parse(readFileSync(f, "utf8")) as { items: { investigationId: string; habitat: string; factors: { key: string; value: number | null }[] }[] }).items;
    const g = (id: string, h: string) => items.find((i) => i.investigationId === id && i.habitat === h)?.factors.find((x) => x.key === "goalFit")?.value;
    for (const id of new Set(items.map((i) => i.investigationId))) expect(g(id, "moon")).toBe(g(id, "rover"));
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
  it("HOW_RANKING_WORKS is at most five plain sentences and states weights, the half rule and the tie-break", () => {
    expect(HOW_RANKING_WORKS.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(5);
    expect(HOW_RANKING_WORKS).toMatch(/count double/);
    expect(HOW_RANKING_WORKS).toContain("counts as half, because unknown is neither a match nor a miss");
    expect(HOW_RANKING_WORKS).toMatch(/Equal scores are ordered by how many checks/);
    expect(Object.values(FACTOR_WEIGHTS).reduce((x, y) => x + y, 0)).toBe(7);
  });
  it("a null factor is never called weak", async () => {
    const [p, q, o] = await buildItems(inputs([inv({ id: "P", o2Range: [21, 34] }), inv({ id: "Q" }), inv({ id: "R", pds: "Other" })]), goal(null));
    expect(p.rationale).toBe("Strong oxygen match; pressure is not on record.");
    expect(q.rationale).toBe("Strong link to fire safety; oxygen and pressure are not on record.");
    expect(o.rationale).not.toMatch(/weak (oxygen|pressure|goal|evidence)/);
  });
  it("HOW_RANKING_WORKS states the decay rule and its floors, so a judge can redo the condition checks", () => {
    expect(HOW_RANKING_WORKS).toMatch(/straight line to 0/);
    expect(HOW_RANKING_WORKS).toContain(`${FLOOR.o2} points of oxygen`);
    expect(HOW_RANKING_WORKS).toContain(`${FLOOR.pressure} kPa`);
  });
  it("weakest factor names a measured mismatch before a gap, and both missing conditions together", async () => {
    const [m, n] = await buildItems(inputs([inv({ id: "M", o2Range: [17, 21], pressureRange: [50.7, 506.6] }), inv({ id: "N" })]), goal(0.6));
    // moon: o2 0 (measured), pressure 1, evidence null; both add 0, the measured 0 is named
    expect(m.rationale).toBe("Strong pressure match; weak oxygen match.");
    expect(n.rationale).toBe("Strong link to fire safety; oxygen and pressure are not on record.");
  });
  it("a TypeSafe answer off the 0..4 level line gives null and is not cached", async () => {
    const bad = (score: unknown) => (async () => new Response(JSON.stringify({ answers: { goalFit: { score } }, usage: { input_tokens: 1, output_tokens: 1 } }))) as unknown as typeof fetch;
    const one = inv({ objectives: "Review-only probe sentence 7c1e, never cached." });
    for (const s of [7, -1, undefined, "x"]) expect(await typesafeGoal("test-key", bad(s))(one, moon)).toBeNull();
    expect(await typesafeGoal(undefined)(one, moon)).toBeNull();
  });
  it("committed rank.json is schema-valid, complete, and every score is the weighted mean of its factors", () => {
    const f = new URL("../public/data/rank.json", import.meta.url);
    if (!existsSync(f)) return;
    const real = loadInputs();
    const items = (JSON.parse(readFileSync(f, "utf8")) as { items: unknown[] }).items.map((x) => RankItem.parse(x));
    expect(items).toHaveLength(real.investigations.length * real.habitats.length);
    for (const it of items) {
      expect(it.factors!.map((x) => x.key)).toEqual(FACTOR_ORDER);
      expect(it.score).toBe(computeScore(it.factors!));
      expect(it.rationale).toBe(rationale(it.factors!));
    }
  });
  it("real data builds and is deterministic", async () => {
    if (!existsSync(new URL("../public/data/investigations.json", import.meta.url))) return;
    const a = await buildItems(loadInputs(), goal(0.5));
    const b = await buildItems(loadInputs(), goal(0.5));
    expect(a).toEqual(b);
    expect(readFileSync(new URL("../public/data/habitats.json", import.meta.url), "utf8")).toContain("moon");
  });
});
