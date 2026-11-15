import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Claim, Investigation, RankItem, Source } from "../contracts/index.ts";
import { rankedFor } from "../data/select.ts";
import TopForBase, { BriefLine } from "./index.tsx";
import { leadTakeaway, topThree } from "./logic.ts";

// Real files in public/data, as in the ranking render test. Effects do not run here, so no fetch.
const load = <T,>(n: string): T[] => {
  const j = JSON.parse(readFileSync(`${process.cwd()}/public/data/${n}.json`, "utf8"));
  return Array.isArray(j) ? j : j.items;
};
vi.mock("../data/useDataset.ts", () => ({
  useDataset: (name: string) => ({ status: "ready", data: load(name), isFixture: false }),
}));
// zustand serves its initial state to server rendering, so the store is swapped for a plain object.
const store = vi.hoisted(() => ({ state: { habitat: "moon", setSelectedInvestigationId: () => {} } as Record<string, unknown> }));
vi.mock("../app/store.ts", () => ({
  useStore: Object.assign((select: (s: unknown) => unknown) => select(store.state), { setState: () => {}, getState: () => store.state }),
}));
beforeEach(() => {
  store.state.habitat = "moon";
});

const rank = load<RankItem>("rank");
const inv = load<Investigation>("investigations");
const claims = load<Claim>("claims");
const sources = load<Source>("sources");
const rowIds = (h: string) => [...h.matchAll(/aria-label="Rank (\d+): ([^,]+),/g)].map((m) => `${m[1]} ${m[2]}`);

it("top three per habitat are the first three ranked fire experiments, in rank order", () => {
  for (const habitat of ["iss", "moon", "rover"] as const) {
    const rows = topThree(rank, inv, claims, habitat);
    const fire = rankedFor(rank, habitat).filter((r) => inv.find((i) => i.id === r.investigationId)?.pds !== "Other");
    expect(rows.map((r) => r.inv.id), habitat).toEqual(fire.slice(0, 3).map((r) => r.investigationId));
    expect(rows.every((r) => r.item.habitat === habitat)).toBe(true);
  }
  expect(topThree(rank, inv, claims, "moon").map((r) => r.inv.id)).toEqual(["PSI-69", "PSI-68", "PSI-159"]);
});

it("renders three rows with See all, and the list follows a new pick", () => {
  const moon = renderToStaticMarkup(<TopForBase />);
  expect(moon).toContain("Top for Moon Base");
  expect(rowIds(moon)).toHaveLength(3);
  expect(moon).toContain("See all");
  expect(moon.match(/aria-label="Ask about /g)).toHaveLength(3);
  expect(moon.match(/draggable="true"/g)).toHaveLength(3);

  store.state.habitat = "iss";
  const iss = renderToStaticMarkup(<TopForBase />);
  expect(iss).not.toContain("Top for Moon Base");
  const want = topThree(rank, inv, claims, "iss");
  expect(rowIds(iss)).toEqual(want.map((r) => `${r.position} ${r.inv.title}`));
  // The score shown is this habitat's own, not Moon Base's.
  expect(iss).toContain(`score ${Math.round(want[0]!.item.score * 100)} out of 100`);
});

it("brief line is the first Interpret card for the habitat, with its source and a way to more", () => {
  const lead = leadTakeaway(claims, sources, "moon")!;
  expect(lead.claim.id).toBe("clm:brief:moon:gravity-limit");
  const h = renderToStaticMarkup(<BriefLine />);
  expect(h).toContain(lead.claim.text.slice(0, 40));
  expect(h).toContain(`href="${lead.cited[0]!.url.replaceAll("&", "&amp;")}"`);
  expect(h.replaceAll("<!-- -->", "")).toContain(`and ${lead.cited.length - 1} more`);
  expect(h).toContain(">More<");
  expect(leadTakeaway(claims, sources, "suit-ref")).toBeNull();
});
