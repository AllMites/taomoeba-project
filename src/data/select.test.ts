import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { Claim, RankItem } from "../contracts/index.ts";
import { briefFor, rankedFor, runUrls } from "./select.ts";

const items = <T>(f: string) => (JSON.parse(readFileSync(`public/data/${f}`, "utf8")) as { items: T[] }).items;

it("orders one habitat best first and keeps every investigation once", () => {
  const moon = rankedFor(items<RankItem>("rank.json"), "moon");
  expect(moon.length).toBe(26);
  expect(new Set(moon.map((r) => r.investigationId)).size).toBe(26);
  expect(moon[0].investigationId).toBe("PSI-69"); // FLEX
  for (let i = 1; i < moon.length; i++) expect(moon[i - 1].score).toBeGreaterThanOrEqual(moon[i].score - 0.0005);
});

it("finds a brief for each picker habitat and maps a run path to its csv", () => {
  const claims = items<Claim>("claims.json");
  for (const h of ["iss", "moon", "rover"] as const) expect(briefFor(claims, h).length).toBeGreaterThanOrEqual(3);
  expect(runUrls("runs/PSI-69.json")).toEqual({ json: "/data/runs/PSI-69.json", csv: "/data/runs/PSI-69.csv" });
});
