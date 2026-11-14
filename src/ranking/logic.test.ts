import { expect, it } from "vitest";
import type { Investigation, RankItem } from "../contracts/index.ts";
import { buildRows, dotLevel, matchRows, rangeText, scalePct, TOP_COUNT, visibleRows } from "./logic.ts";

const inv = (id: string, pds: Investigation["pds"], extra: Partial<Investigation> = {}) =>
  ({ id, title: `Exp ${id}`, hardware: "Rack", hardwareGroup: "g", pds, fuel: "ethylene", ...extra }) as Investigation;
const item = (id: string) => ({ id: `r-${id}`, investigationId: id }) as RankItem;

const invs = [
  ...Array.from({ length: 10 }, (_, i) => inv(`P${i}`, i % 2 ? "Detection" : "Prevention")),
  inv("X1", "Other", { title: "Odd one", fuel: "paper" }),
  inv("S1", "Suppression", { title: "Mist test", hardware: "Combustion Box" }),
];
// S1 ranks 12th, X1 ranks 11th (Other must still stay out of the top).
const ranked = [...invs.slice(0, 10), invs[10], invs[11]].map((i) => item(i.id));
const rows = buildRows(ranked, invs, []);
const base = { pds: "all" as const, search: "", showAll: false, highlightIds: [] as string[] };

it("shows the top 8 before Show all, numbered by full position", () => {
  const v = visibleRows(rows, base);
  expect(v.length).toBe(TOP_COUNT);
  expect(v[7].position).toBe(8);
});

it("keeps Other out of the top and puts it in Show all", () => {
  const withOtherEarly = buildRows([item("X1"), ...ranked.filter((r) => r.investigationId !== "X1")], invs, []);
  expect(visibleRows(withOtherEarly, base).some((r) => r.inv.pds === "Other")).toBe(false);
  expect(visibleRows(withOtherEarly, { ...base, showAll: true }).length).toBe(12);
});

it("shows every match when a filter or search is active", () => {
  expect(visibleRows(rows, { ...base, pds: "Detection" }).length).toBe(5);
  expect(visibleRows(rows, { ...base, search: "combustion box" }).map((r) => r.inv.id)).toEqual(["S1"]);
});

it("matches name, id, fuel and hardware case-insensitively, all words", () => {
  expect(matchRows(rows, "all", "ODD").map((r) => r.inv.id)).toEqual(["X1"]);
  expect(matchRows(rows, "all", "paper").map((r) => r.inv.id)).toEqual(["X1"]);
  expect(matchRows(rows, "all", "p3").map((r) => r.inv.id)).toEqual(["P3"]);
  expect(matchRows(rows, "Prevention", "p3")).toEqual([]);
  expect(matchRows(rows, "Suppression", "mist rack")).toEqual([]);
});

it("opens the whole list when a lit card is hidden, not otherwise", () => {
  expect(visibleRows(rows, { ...base, highlightIds: ["S1"] }).length).toBe(12);
  expect(visibleRows(rows, { ...base, highlightIds: ["P1"] }).length).toBe(TOP_COUNT);
});

it("sets dot levels, null apart from low", () => {
  expect(dotLevel(null)).toBe("unknown");
  expect(dotLevel(0)).toBe("low");
  expect(dotLevel(0.33)).toBe("low");
  expect(dotLevel(0.34)).toBe("mid");
  expect(dotLevel(0.5)).toBe("mid");
  expect(dotLevel(2 / 3)).toBe("high");
  expect(dotLevel(1)).toBe("high");
});

it("places oxygen on a fixed 0 to 100 scale and words ranges", () => {
  expect(scalePct(21)).toBe(21);
  expect(scalePct(150)).toBe(100);
  expect(rangeText([19.8, 85])).toBe("19.8 to 85%");
  expect(rangeText([21, 21])).toBe("21%");
});
