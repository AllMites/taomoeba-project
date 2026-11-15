import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Investigation, Source } from "../contracts/index.ts";
import Library from "./index.tsx";
import { filterExperiments, filterSources, sourceKind, SOURCES_SHOWN } from "./logic.ts";

const load = <T,>(n: string): T[] => {
  const j = JSON.parse(readFileSync(`${process.cwd()}/public/data/${n}.json`, "utf8"));
  return Array.isArray(j) ? j : j.items;
};
vi.mock("../data/useDataset.ts", () => ({
  useDataset: (name: string) => ({ status: "ready", data: load(name), isFixture: false }),
}));

const inv = load<Investigation>("investigations");
const sources = load<Source>("sources");

it("filters experiments by kind and by every search word", () => {
  expect(filterExperiments(inv, "all", "")).toHaveLength(inv.length);
  const det = filterExperiments(inv, "Detection", "");
  expect(det.length).toBeGreaterThan(0);
  expect(det.every((i) => i.pds === "Detection")).toBe(true);
  expect(filterExperiments(inv, "all", "psi-69").map((i) => i.id)).toEqual(["PSI-69"]);
  // Every word must match, in any order and any case.
  expect(filterExperiments(inv, "all", "BRE acme").map((i) => i.id)).toEqual(["PSI-20"]);
  expect(filterExperiments(inv, "Detection", "psi-69")).toEqual([]);
  expect(filterExperiments(inv, "all", "no-such-thing")).toEqual([]);
});

it("a kind limits sources to the ones its experiments cite; search narrows by title or id", () => {
  expect(filterSources(sources, inv, "all", "")).toHaveLength(sources.length);
  const sup = filterSources(sources, inv, "Suppression", "");
  const cited = new Set(inv.filter((i) => i.pds === "Suppression").flatMap((i) => i.sourceIds));
  expect(sup.map((s) => s.id).sort()).toEqual([...cited].filter((id) => sources.some((s) => s.id === id)).sort());
  expect(sup.length).toBeLessThan(sources.length);
  expect(filterSources(sources, inv, "all", "ntrs:20170007283").map((s) => s.id)).toEqual(["ntrs:20170007283"]);
  expect(sourceKind("psi:PSI-10")).toBe("PSI record");
  expect(sourceKind("ntrs:1")).toBe("NASA report");
});

it("renders every experiment as a draggable row with Ask about this, a cut source list, and the four steps", () => {
  const h = renderToStaticMarkup(<Library />);
  expect(h.match(/class="lib-open"/g)).toHaveLength(inv.length);
  expect(h.match(/draggable="true"/g)).toHaveLength(inv.length);
  expect(h.match(/aria-label="Ask about /g)).toHaveLength(inv.length);
  expect(h.match(/class="lib-row lib-source"/g)).toHaveLength(SOURCES_SHOWN);
  expect(h).toContain(`Show all ${sources.length} sources`);
  expect(h.match(/class="lib-step"/g)).toHaveLength(4);
  for (const tool of ["BM25", "Rerank", "Claude", "TypeSafe"]) expect(h).toContain(tool);
});
