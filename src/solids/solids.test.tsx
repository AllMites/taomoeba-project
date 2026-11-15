import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SOLIDS_ASK, SolidsView } from "./index.tsx";
import { habitatGap, parseSolids, saffireSummary, testsCsv, xPx, yRange } from "./logic.ts";

const read = (p: string) => JSON.parse(readFileSync(`${process.cwd()}/${p}`, "utf8"));
const doc = parseSolids(read("public/data/solids.json"))!;
const moon = { label: "Moon Base", o2Percent: 30 };
const iss = { label: "ISS", o2Percent: 21 };

describe("solid materials in microgravity", () => {
  it("the file parses and matches the BASS-II table counts", () => {
    expect(doc).not.toBeNull();
    const f = doc.flammability;
    expect(f.tests).toHaveLength(23); // 19 BASS-II + 4 BASS, reused samples left out
    expect(f.excluded).toHaveLength(8);
    expect(f.counts).toEqual({ burned: 11, quenched: 6, blowoff: 1, "no-blowoff": 2, "no-ignition": 3 });
    expect(f.maxO2).toBe(21);
    // the report: quenching flows between 1 and 5 cm/s
    for (const t of f.tests.filter((t) => t.outcome === "quenched")) expect(t.flowTo).toBeGreaterThanOrEqual(1), expect(t.flowTo).toBeLessThanOrEqual(5);
  });
  it("Moon Base air is above every fabric test; ISS air is inside", () => {
    expect(habitatGap(doc, 30)).toBe(9);
    expect(habitatGap(doc, 21)).toBeNull();
    expect(yRange(doc, 30).max).toBeGreaterThanOrEqual(31);
    expect(yRange(doc, 100).offChart).toBe(true);
    expect(xPx(10)).toBeGreaterThan(xPx(2));
  });
  it("SAFFIRE-II: more burned on Earth in 4 of 6 comparable samples, never more in orbit", () => {
    expect(saffireSummary(doc)).toEqual({ total: 6, earthWorse: 4, same: 2, spaceWorse: 0 });
    expect(doc.saffire.skipped).toEqual(["2-6", "2-9"]);
  });
  it("renders the map, the gap band for Moon Base, the table and both sources", () => {
    const html = renderToStaticMarkup(<SolidsView doc={doc} habitat={moon} onOpen={() => {}} onAsk={() => {}} />);
    expect(html).toContain("Solid materials in microgravity");
    expect(html).toContain("No fabric test between 21% and 30% oxygen");
    expect(html).toContain("9 points above the highest fabric test");
    expect(html).toContain("GMT45-T4");
    expect(html).toContain('href="https://ntrs.nasa.gov/citations/20210011385"');
    expect(html).toContain("Same material, space vs Earth");
    expect(html).toContain("In 4 of 6 comparable samples");
    expect(html).toContain("Open SAFFIRE-II");
    const isshtml = renderToStaticMarkup(<SolidsView doc={doc} habitat={iss} />);
    expect(isshtml).not.toContain("No fabric test between");
    expect(isshtml).toContain("inside the tested range");
  });
  it("CSV has every test with its source line", () => {
    const csv = testsCsv(doc).trim().split("\n");
    expect(csv[0]).toContain("20210011385");
    expect(csv).toHaveLength(2 + 23);
  });
  it("every Ask button question is in the demo save list", () => {
    const save = readFileSync(`${process.cwd()}/scripts/rag/save_answers.mjs`, "utf8");
    for (const q of SOLIDS_ASK) expect(save, q).toContain(JSON.stringify(q));
  });
  it("a broken file shows a plain message", () => {
    expect(parseSolids({})).toBeNull();
    expect(renderToStaticMarkup(<SolidsView doc="error" />)).toContain("could not be loaded");
  });
});
