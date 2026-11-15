import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allStatements, BEHAVIOUR, FOR_BASE, overviewFor, resolveRef, SIDE_BY_SIDE, type OverviewDb } from "./overview.ts";

const read = (name: string): unknown => JSON.parse(readFileSync(`public/data/${name}.json`, "utf8"));
const items = <T,>(name: string): T[] => {
  const j = read(name) as T[] | { items: T[] };
  return Array.isArray(j) ? j : j.items;
};
const db: OverviewDb = {
  claims: items("claims"),
  sources: items("sources"),
  facts: items("facts"),
  solids: read("solids") as OverviewDb["solids"],
  earth: items("earth"),
  investigations: items("investigations"),
  habitats: items("habitats"),
};

const all = allStatements();

describe("Interpret overview grounding", () => {
  it("covers every block", () => {
    expect(BEHAVIOUR.length).toBeGreaterThanOrEqual(3);
    expect(BEHAVIOUR.length).toBeLessThanOrEqual(5);
    expect(SIDE_BY_SIDE.length).toBeGreaterThan(0);
    for (const o of Object.values(FOR_BASE)) {
      expect(o.air.length).toBeGreaterThan(0);
      expect(o.limits.length).toBeGreaterThan(0);
    }
  });

  it("every statement lists at least one supporting record", () => {
    for (const s of all) expect(s.refs.length, s.where).toBeGreaterThan(0);
  });

  it("every ref names a record that exists in the data files", () => {
    const missing = all.flatMap((s) => s.refs.filter((r) => resolveRef(r, db) === null).map((r) => `${s.where} -> ${r}`));
    expect(missing).toEqual([]);
  });

  it("every supporting record shows at least one source", () => {
    for (const s of all) for (const r of s.refs) expect(resolveRef(r, db)!.cited.length, r).toBeGreaterThan(0);
  });

  it("every number in a statement appears in one of its records", () => {
    const bad: string[] = [];
    for (const s of all) {
      const hay = s.refs.map((r) => resolveRef(r, db)).map((c) => `${c?.summary ?? ""} ${c?.quote ?? ""}`).join(" ");
      const nums = new Set(hay.match(/\d+(?:\.\d+)?/g) ?? []);
      for (const n of s.text.match(/\d+(?:\.\d+)?/g) ?? []) if (!nums.has(n)) bad.push(`${s.where}: ${n}`);
    }
    expect(bad).toEqual([]);
  });

  it("has no em dashes", () => {
    for (const s of all) expect(s.text, s.where).not.toMatch(/—/);
  });

  it("catches a ref to a record that does not exist", () => {
    expect(resolveRef("claim:clm:brief:moon:nope", db)).toBeNull();
    expect(resolveRef("fact:nope", db)).toBeNull();
    expect(resolveRef("solids:sample:9-9", db)).toBeNull();
    expect(resolveRef("solids:finding:99", db)).toBeNull();
    expect(resolveRef("earth:nope", db)).toBeNull();
    expect(resolveRef("inv:PSI-0", db)).toBeNull();
    expect(resolveRef("habitat:mars", db)).toBeNull();
    expect(resolveRef("guess:anything", db)).toBeNull();
  });
});

describe("overviewFor", () => {
  it("follows the picked base, each citing its own takeaways", () => {
    expect(overviewFor("moon")!.heading).toBe("In Moon Base air");
    expect(overviewFor("iss")!.heading).toBe("In ISS air");
    expect(overviewFor("rover")!.lead.refs.every((r) => !r.includes(":moon:"))).toBe(true);
    expect(overviewFor("moon")!.lead.refs.every((r) => !r.includes(":rover:"))).toBe(true);
    expect(overviewFor("suit-ref")).toBeNull();
  });
});
