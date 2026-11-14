import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { AppState } from "../app/store.ts";
import Ranking from "./index.tsx";

// Render the section against the real files in public/data. Effects do not run here, so no scroll or fetch.
const mode = vi.hoisted(() => ({ value: "ready" as "ready" | "error" }));
vi.mock("../data/useDataset.ts", () => {
  const read = (n: string) => {
    const j = JSON.parse(readFileSync(`${process.cwd()}/public/data/${n}.json`, "utf8"));
    return Array.isArray(j) ? j : j.items;
  };
  const data: Record<string, unknown[]> = Object.fromEntries(
    ["rank", "investigations", "claims", "habitats"].map((n) => [n, read(n)]),
  );
  return {
    useDataset: (name: string) =>
      mode.value === "error" && name === "rank"
        ? { status: "error", error: 'No data for "rank": neither /data/rank.json nor its fixture could be loaded' }
        : { status: "ready", data: data[name], isFixture: false },
  };
});

// zustand serves its initial state to server rendering, so the store is swapped for a plain object here.
const store = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock("../app/store.ts", () => ({ useStore: (select: (s: unknown) => unknown) => select(store.state) }));
const setState = (patch: Partial<AppState>) => Object.assign(store.state, patch);
const noop = () => {};
beforeEach(() => {
  mode.value = "ready";
  store.state = {
    habitat: "moon",
    pds: "all",
    search: "",
    selectedInvestigationId: null,
    highlightIds: [],
    setHabitat: noop,
    setPds: noop,
    setSearch: noop,
    setSelectedInvestigationId: noop,
    setHighlightIds: noop,
  } satisfies AppState;
});
const useStore = { setState };

const html = () => renderToStaticMarkup(<Ranking />);
const cardIds = (h: string) => [...h.matchAll(/class="rk-card" data-id="([^"]+)"/g)].map((m) => m[1]);
/** Markup of each card button up to its first closing tag: a nested button would end it early. */
const cardBodies = (h: string) => h.split('class="rk-card"').slice(1).map((s) => s.slice(0, s.indexOf("</button>")));

it("lists Moon Base best first, top 8, with Show all", () => {
  const h = html();
  expect(cardIds(h)).toEqual(["PSI-69", "PSI-68", "PSI-159", "PSI-10", "PSI-20", "PSI-100", "PSI-26", "PSI-47"]);
  expect(h).toContain("Show all 26 experiments");
  expect(h).toContain("26 of 26 experiments");
});

it("never prints null, undefined or NaN, and never a bare score", () => {
  useStore.setState({ highlightIds: ["PSI-60"] }); // opens all 26
  const h = html();
  expect(h).not.toMatch(/\b(null|undefined|NaN)\b/); // text and attributes, aria-labels included
  // Moon Base scores of the first two cards, as stored and as a percentage.
  for (const s of ["0.961", "0.96", "96%", "0.912", "91%"]) expect(h.replace(/<[^>]+>/g, " ")).not.toContain(s);
});

it("keeps every card a single control with nothing focusable inside", () => {
  useStore.setState({ highlightIds: ["PSI-60"] });
  const bodies = cardBodies(html());
  expect(bodies).toHaveLength(26);
  for (const b of bodies) expect(b).not.toMatch(/<(button|a|input|select|textarea|details|summary)\b|tabindex=/);
});

it("shows unknown dots and no bar when oxygen is not on record", () => {
  const body = cardBodies(html())[5]; // PSI-100, no oxygen or pressure on record
  expect(body).toContain("Oxygen: not on record");
  expect(body).not.toContain("rk-o2-track");
  expect(body.match(/rk-dot-unknown/g)).toHaveLength(2);
  expect(body).toContain('aria-label="Oxygen match: Oxygen level is not on record."');
});

it("opens the list for a lit card behind Show all and marks it in words", () => {
  useStore.setState({ highlightIds: ["PSI-60"] });
  const h = html();
  expect(cardIds(h)).toHaveLength(26);
  expect(h).not.toContain("Show all");
  const lit = cardBodies(h).find((b) => b.includes('data-id="PSI-60"'))!;
  expect(lit).toContain('data-lit="true"');
  expect(lit).toContain("In the answer");
});

it("names a card by rank and title only, the rest as its description", () => {
  const body = cardBodies(html())[0];
  const ids = (attr: string) => body.match(new RegExp(`${attr}="([^"]+)"`))![1].split(" ");
  const textOf = (id: string) => body.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1];
  const named = ids("aria-labelledby");
  expect(named).toHaveLength(2);
  expect(body).toContain(`id="${named[0]}" aria-label="Rank 1"`);
  expect(textOf(named[1])).toBe("FLEX");
  for (const id of ids("aria-describedby")) expect(body).toContain(`id="${id}"`);
});

it("shows a plain error, not the loader's technical message", () => {
  mode.value = "error";
  const h = html();
  expect(h).toContain('role="alert"');
  expect(h).toContain("Could not load the experiments.");
  expect(h).not.toMatch(/\/data\/|fixture|No data for/);
});
