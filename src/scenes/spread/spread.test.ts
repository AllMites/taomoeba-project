import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSolids, type SolidsDoc } from "../../solids/logic.ts";
import { evidenceFor, fabricVerdict, OBJECTS, reach, spreadAt, spreadEnd, spreadSpeed, SIBAL_MM_S } from "./spread.ts";

const solids = parseSolids(JSON.parse(readFileSync("public/data/solids.json", "utf8"))) as SolidsDoc;
const ids = new Set<string>((JSON.parse(readFileSync("public/data/investigations.json", "utf8")) as { items: { id: string }[] }).items.map((i) => i.id));
const byId = (id: string) => OBJECTS.find((o) => o.id === id)!;
const lives = { lives: true, test: null, beyond: false };

describe("which objects burn", () => {
  it("metal, glass and Nomex never burn; silicone burns only at 1 g, as in SAFFIRE-II", () => {
    for (const g of ["micro", "partial", "earth"] as const) {
      expect(byId("locker").burns(g)).toBe(false);
      expect(byId("window").burns(g)).toBe(false);
      expect(byId("bag").burns(g)).toBe(false);
      expect(byId("cloth").burns(g)).toBe(true);
    }
    expect(byId("cable").burns("micro")).toBe(false);
    expect(byId("cable").burns("earth")).toBe(true);
  });

  it("the fire runs over the touching fuel and stops at the locker", () => {
    expect(reach(OBJECTS, "micro")).toBe(byId("panel").x1);
    const end = spreadEnd(OBJECTS, "micro", 21, lives);
    const s = spreadAt(OBJECTS, "micro", 21, lives, end + 100);
    expect(s.front).toBe(byId("panel").x1);
    expect(s.alive).toBe(false);
    expect(s.burnt.locker).toBe(0);
    expect(s.burnt.bag).toBe(0);
    expect(s.burnt.cable).toBe(0);
    expect(s.burnt.cloth).toBeCloseTo(byId("cloth").x1, 6);
    expect(s.phase).toMatch(/locker/);
  });
});

describe("flame front over time", () => {
  it("moves at the SAFFIRE-II fabric rate at its oxygen, and the burnt zone trails it", () => {
    expect(spreadSpeed(22.1, "micro")).toBeCloseTo(SIBAL_MM_S / 1000, 9);
    const s = spreadAt(OBJECTS, "micro", 22.1, lives, 100);
    expect(s.front).toBeCloseTo(0.21, 6);
    expect(s.alive).toBe(true);
    expect(s.burnt.cloth).toBeCloseTo(0.21, 6);
    expect(s.burnt.checklist).toBe(0);
    expect(s.phase).toMatch(/cloth/);
  });

  it("scales with oxygen: more oxygen spreads faster", () => {
    expect(spreadSpeed(30, "partial")).toBeGreaterThan(spreadSpeed(21, "micro"));
    expect(spreadSpeed(21, "micro") / spreadSpeed(10.5, "micro")).toBeCloseTo(4, 6);
    expect(spreadSpeed(21, "earth")).toBeGreaterThan(spreadSpeed(21, "micro"));
  });

  it("a flame the airflow cannot keep alive goes out near the ignition point", () => {
    const out = { lives: false, test: null, beyond: false };
    const s = spreadAt(OBJECTS, "micro", 18, out, 60);
    expect(s.alive).toBe(false);
    expect(s.front).toBeLessThanOrEqual(0.02);
    expect(s.phase).toMatch(/went out/);
  });
});

describe("airflow decides, from the BASS-II fabric tests", () => {
  it("the nearest real test gives the verdict and is named", () => {
    const low = fabricVerdict(solids, 17.5, 2.2, "micro");
    expect(low.test?.test).toBeTruthy();
    expect(low.lives).toBe(false);
    expect(fabricVerdict(solids, 21, 10, "micro")).toMatchObject({ lives: true, beyond: false });
  });

  it("above every test's oxygen the data says nothing; at 1 g the fan does not decide", () => {
    expect(fabricVerdict(solids, 30, 1, "partial")).toEqual({ lives: true, test: null, beyond: true });
    expect(fabricVerdict(solids, 17, 1, "earth").lives).toBe(true);
  });
});

describe("object to experiment lookup", () => {
  it("every named experiment exists in the data, and objects without one name none", () => {
    for (const o of OBJECTS) for (const id of o.evidence) expect(ids.has(id)).toBe(true);
    expect(evidenceFor(byId("cloth"), solids, ids)).toMatchObject({ ids: ["PSI-25", "PSI-99"] });
    expect(evidenceFor(byId("cloth"), solids, ids).sample?.material).toMatch(/SIBAL/);
    expect(evidenceFor(byId("cable"), solids, ids).sample?.material).toBe("Silicone");
    expect(evidenceFor(byId("checklist"), solids, ids)).toEqual({ ids: [], sample: null, findings: [] });
    expect(evidenceFor(byId("locker"), solids, ids).ids).toEqual([]);
  });
});
