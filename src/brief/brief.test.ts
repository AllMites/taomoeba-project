import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { Claim } from "../contracts/index.ts";
import { briefFor } from "../data/select.ts";
import { orderBrief, parseCount, safeHref, singleExperiment, topicOf } from "./brief.ts";

const claims = (JSON.parse(readFileSync("public/data/claims.json", "utf8")) as { items: Claim[] }).items;
const stub = (id: string): Claim => ({ id, investigationId: "PSI-1", kind: "takeaway", text: "t", sourceIds: [], excerpt: "e" });

it("puts the limits first for each habitat", () => {
  const moon = orderBrief(briefFor(claims, "moon")).map(topicOf);
  expect(moon.slice(0, 2)).toEqual(["gravity-limit", "fuel-gap"]);
  const iss = orderBrief(briefFor(claims, "iss")).map(topicOf);
  expect(iss[0]).toBe("o2-coverage"); // ISS has no gravity-limit row
  expect(iss).toHaveLength(briefFor(claims, "iss").length);
});

it("keeps unknown topics last, in file order", () => {
  const out = orderBrief([stub("clm:brief:x:zzz"), stub("clm:brief:x:fuel-gap"), stub("clm:brief:x:aaa")]).map(topicOf);
  expect(out).toEqual(["fuel-gap", "zzz", "aaa"]);
});

it("reads N of M", () => {
  expect(parseCount("Only 6 of 24 experiments record a tested pressure; 5 of those include 70.3 kPa")).toEqual({ n: 6, of: 24, label: "6 of 24 experiments" });
  expect(parseCount("8 of 24 experiments covered 21% oxygen; 3 of 4 burned")).toEqual({ n: 8, of: 24, label: "8 of 24 experiments" });
});

it("draws nothing when there is no count", () => {
  expect(parseCount("None of the 6 experiments that cover 30% oxygen burned solid materials.")).toBeNull();
  expect(parseCount("19 flew in microgravity, 5 were ground studies.")).toBeNull();
  expect(parseCount("9 of 0 is nonsense")).toBeNull();
});

it("finds the single experiment behind a takeaway", () => {
  const moon = briefFor(claims, "moon");
  expect(singleExperiment(moon.find((c) => topicOf(c) === "bre-airflow")!)).toBe("PSI-20");
  expect(singleExperiment(moon.find((c) => topicOf(c) === "o2-coverage")!)).toBeNull();
});

it("names the count in the sentence's own words, never calling samples experiments", () => {
  const saffire = briefFor(claims, "iss").find((c) => topicOf(c) === "saffire-gravity")!;
  expect(parseCount(saffire.text)).toEqual({ n: 3, of: 4, label: "3 of 4 burned" });
  expect(parseCount("3 of 4")).toEqual({ n: 3, of: 4, label: "3 of 4" });
});

it("reads only whole-number counts", () => {
  expect(parseCount("2.5 of 10 runs")).toBeNull();
  expect(parseCount("4 of 10.5 kPa")).toBeNull();
  expect(parseCount("1,000 of 2,000 runs")).toBeNull();
});

it("every real takeaway gives a count or none, never N over M", () => {
  for (const c of claims.filter((x) => x.kind === "takeaway")) {
    const r = parseCount(c.text);
    if (r) expect(r.n).toBeLessThanOrEqual(r.of);
  }
});

it("links sources only over http(s)", () => {
  expect(safeHref("https://ntrs.nasa.gov/citations/1")).toBe("https://ntrs.nasa.gov/citations/1");
  expect(safeHref("javascript:alert(1)")).toBeNull();
  expect(safeHref(" data:text/html,x")).toBeNull();
  const sources = (JSON.parse(readFileSync("public/data/sources.json", "utf8")) as { items: { url: string }[] }).items;
  for (const s of sources) expect(safeHref(s.url)).not.toBeNull();
});
