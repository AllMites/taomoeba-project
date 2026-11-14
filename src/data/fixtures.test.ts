import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { datasetSchemas, type DatasetName } from "../contracts/index.ts";
import { loadDataset } from "./load.ts";

const dir = new URL("../../public/data/fixtures/", import.meta.url);
const readFixture = (name: string) => JSON.parse(readFileSync(new URL(`${name}.fixture.json`, dir), "utf-8"));

describe("fixtures match contracts", () => {
  for (const name of Object.keys(datasetSchemas) as DatasetName[]) {
    it(name, () => {
      const doc = readFixture(name);
      expect(doc.fixture).toBe(true);
      expect(z.array(datasetSchemas[name]).parse(doc.items).length).toBeGreaterThan(0);
    });
  }
});

describe("loader fallback", () => {
  const respond = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  it("falls back to the fixture when the real file 404s", async () => {
    const fetcher = (url: string) =>
      url.includes("/fixtures/") ? respond(200, readFixture("sources")) : respond(404, {});
    const r = await loadDataset("sources", fetcher);
    expect(r.isFixture).toBe(true);
    expect(r.data.length).toBeGreaterThan(0);
  });

  it("uses the real file when present", async () => {
    const real = readFixture("sources").items.slice(0, 1);
    const r = await loadDataset("sources", () => respond(200, real));
    expect(r.isFixture).toBe(false);
    expect(r.data).toHaveLength(1);
  });

  it("throws when real file and fixture are both missing", async () => {
    await expect(loadDataset("sources", () => respond(404, {}))).rejects.toThrow();
  });
});
