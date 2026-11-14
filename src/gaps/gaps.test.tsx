import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HabitatPreset, Investigation } from "../contracts/index.ts";
import { parseDoc } from "../whatif/logic.ts";
import { GapsView } from "./index.tsx";
import { coverage, flexNear, nextTests } from "./logic.ts";

const read = (p: string) => JSON.parse(readFileSync(`${process.cwd()}/${p}`, "utf8"));
const invs = ((x) => x.items ?? x)(read("public/data/investigations.json")) as Investigation[];
const habs = ((x) => x.items ?? x)(read("public/data/habitats.json")) as HabitatPreset[];
const doc = parseDoc(read("public/data/whatif.json"))!;
const hab = (id: string) => habs.find((h) => h.id === id)!;

describe("what to test next", () => {
  it("Moon Base air: droplet and gas tests cover it, no solid-material test does", () => {
    const c = coverage(hab("moon"), invs);
    expect(c.both.map((i) => i.id).sort()).toEqual(["PSI-10", "PSI-159", "PSI-68", "PSI-69"].sort());
    expect(c.solidsCovering).toHaveLength(0);
    expect(c.maxSolidO2).toBeLessThan(30);
    const next = nextTests(hab("moon"), c, flexNear(doc, hab("moon")));
    expect(next[0].title).toMatch(/^Burn solid materials/);
    expect(next.map((n) => n.title)).toContain("Repeat the key tests in lunar gravity");
  });
  it("ISS air: solid-material tests reach it, so no solids suggestion and no lunar-gravity suggestion", () => {
    const c = coverage(hab("iss"), invs);
    expect(c.solidsCovering.length).toBeGreaterThan(0);
    const titles = nextTests(hab("iss"), c, flexNear(doc, hab("iss"))).map((n) => n.title);
    expect(titles.some((t) => t.startsWith("Burn solid"))).toBe(false);
    expect(titles).not.toContain("Repeat the key tests in lunar gravity");
  });
  it("FLEX counts come from the grid; the suit's pure oxygen is outside the grid", () => {
    const near = flexNear(doc, hab("moon"))!;
    expect(near.map((x) => x.fuel)).toEqual(doc.axes.fuel);
    expect(flexNear(doc, hab("suit-ref"))).toBeNull();
    expect(flexNear(null, hab("moon"))).toBeNull();
  });
  it("renders the counts, the suggestions with NASA's planned experiments, and experiment buttons", () => {
    const html = renderToStaticMarkup(<GapsView habitat={hab("moon")} investigations={invs} doc={doc} onOpen={() => {}} />);
    expect(html).toContain("What to test next");
    expect(html).toContain("Flammability of Materials on the Moon (FM2)");
    expect(html).toContain("Lunar-g Combustion Investigation (LUCI)");
    expect(html).toContain(">FLEX<");
    expect(html).toContain("Suggestions by the team");
  });
});
