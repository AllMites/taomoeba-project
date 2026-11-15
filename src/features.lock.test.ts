// Feature lock. A reskin may change any markup or CSS, but these features must survive it.
// If this fails, a locked feature was removed or unwired. Restore it; do not edit this list
// without both Daniel and Raenn agreeing (see docs/FEATURES.md).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const app = read("src/app/App.tsx");
const server = read("server/app.ts");

describe("locked features", () => {
  it("AI 1, CatBoost: the team model behind the what-if extinction estimate", () => {
    const models = JSON.parse(read("public/data/whatif.json")).models;
    expect(models.ext_diameter.name).toMatch(/CatBoost/);
    expect(app).toMatch(/<WhatIf\s*\/>/);
  });

  it("AI 2, TypeSafe: System One verifier behind POST /verify", () => {
    expect(read("server/verify.ts")).toContain("https://api.typesafe.ai/v1/systemone");
    expect(server).toMatch(/app\.post\("\/verify"/);
  });

  it("AI 3, Anthropic: Claude writes Ask answers behind POST /ask", () => {
    expect(read("server/llm.ts")).toContain("https://api.anthropic.com/v1/messages");
    expect(server).toMatch(/app\.post\("\/ask"/);
    expect(app).toMatch(/<Ask\s*\/>/);
  });

  it("AI 4, RAG: BM25 + rerank over the library, server-only papers from KV", () => {
    const ask = read("server/ask.ts");
    expect(ask).toContain('from "./bm25.ts"');
    expect(ask).toContain('from "./rerank.ts"');
    expect(server).toContain('LIBRARY?.get("restricted-index"');
    // The KV namespace lives on Daniel's deploy account. Changing it empties the RAG's server-only papers.
    expect(read("wrangler.toml")).toMatch(/binding = "LIBRARY"\s*\nid = "dc03ff57518e41a8b42c5f8c48120bf5"/);
  });

  it("3D lanes: Saffire and Lunar scenes, lazy-loaded on the Stage", () => {
    const registry = read("src/scenes/registry.ts");
    expect(registry).toContain('import("./saffire/index.tsx")');
    expect(registry).toContain('import("./lunar/index.tsx")');
    expect(app).toMatch(/<Stage\s*\/>/);
  });

  it("Dashboard: every section stays mounted on the page", () => {
    for (const s of ["Brief", "Ranking", "Compare", "WhatIf", "Gaps", "Earth", "Trust", "Evidence"]) {
      expect(app, s).toMatch(new RegExp(`<${s}\\s*/>`));
    }
  });
});
