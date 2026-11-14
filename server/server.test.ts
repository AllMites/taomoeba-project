import { describe, expect, it } from "vitest";
import { ALPHA, buildItems, computeScore, loadInputs, rationale } from "../scripts/rank/build.ts";
import { extractive, parseLive } from "./ask.ts";
import { buildIndex, score } from "./bm25.ts";
import { createApp, fixtureIndex, MAX_QUESTION } from "./app.ts";
import { norm, verify } from "./verify.ts";

const index = fixtureIndex();
const post = (app: ReturnType<typeof createApp>, path: string, body: unknown, env: object = {}) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, env);

describe("bm25", () => {
  it("ranks the obvious match first", () => {
    const hits = score(index, "smoke particle size detectors");
    expect(hits[0].chunk.sourceId).toBe("SRC-05");
  });
  it("returns nothing for an off-topic query", () => {
    expect(score(buildIndex(index.chunks), "pizza recipe")).toEqual([]);
  });
});

describe("POST /ask", () => {
  it("mock mode with no keys", async () => {
    const r = await post(createApp({ index }), "/ask", { question: "How fast does flame spread?" });
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.mode).toBe("mock");
    expect(j.claims.length).toBeGreaterThan(0);
  });
  it("extractive mode quotes the records and cites sources", async () => {
    const r = await post(createApp({ index }), "/ask", { question: "What size are smoke particles?", habitat: "iss" }, { SPEND_MODE: "extractive" });
    const j = await r.json();
    expect(j.mode).toBe("extractive");
    expect(j.answer).toContain("quoting the PSI records");
    expect(j.answer).toContain("[SRC-05]");
    expect(j.investigationIds).toContain("PSI-05");
  });
  it("extractive says so when nothing is retrieved", () => {
    expect(extractive(index, "pizza recipe").answer).toBe("The PSI records I have do not cover that.");
  });
  it("live mode parses cited sentences and drops unknown ids", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: "Smoke particles were larger than test aerosols. [SRC-05] Made up. [SRC-99]" }], stop_reason: "end_turn" }))) as typeof fetch;
    const app = createApp({ index });
    const r = await app.request("/ask", { method: "POST", body: JSON.stringify({ question: "smoke particle size" }) }, { ANTHROPIC_API_KEY: "k", fetchImpl });
    const j = await r.json();
    expect(j.mode).toBe("live");
    expect(j.claims).toHaveLength(1);
    expect(j.claims[0].sourceIds).toEqual(["SRC-05"]);
  });
  it("live failure degrades to extractive without leaking the error", async () => {
    const fetchImpl = (async () => new Response("boom sk-secret", { status: 500 })) as typeof fetch;
    const r = await createApp({ index }).request("/ask", { method: "POST", body: JSON.stringify({ question: "smoke particle size" }) }, { ANTHROPIC_API_KEY: "k", fetchImpl });
    const t = await r.text();
    expect(JSON.parse(t).mode).toBe("extractive");
    expect(t).not.toContain("sk-secret");
  });
  it("parseLive handles the no-cover sentence", () => {
    expect(parseLive("The PSI records I have do not cover that.", index.chunks)?.claims).toEqual([]);
  });
});

describe("guards", () => {
  it("rejects a too-long question with 400", async () => {
    const r = await post(createApp({ index }), "/ask", { question: "x".repeat(MAX_QUESTION + 1) });
    expect(r.status).toBe(400);
  });
  it("rejects a bad habitat with 400", async () => {
    expect((await post(createApp({ index }), "/ask", { question: "hi", habitat: "venus" })).status).toBe(400);
  });
  it("rate limits per IP with 429", async () => {
    const app = createApp({ index });
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await post(app, "/ask", { question: `q${i}` })).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[11]).toBe(429);
  });
  it("caches identical questions", async () => {
    const app = createApp({ index });
    const a = await (await post(app, "/ask", { question: "Flame spread?" })).json();
    const b = await (await post(app, "/ask", { question: "  flame   SPREAD? " })).json();
    expect(b).toEqual(a);
  });
});

describe("POST /verify", () => {
  const sourceText = "Spread was sustained at lower oxygen\nlevels in micro­gravity than in normal gravity.";
  it("verbatim match is lenient on whitespace, soft hyphens and ligatures", async () => {
    expect(norm("ﬁre   spread")).toBe("fire spread");
    const r = await verify({ text: "x", excerpt: "lower oxygen levels in microgravity", sourceText });
    expect(r.verbatim).toBe(true);
    expect((await verify({ text: "x", excerpt: "higher oxygen", sourceText })).verbatim).toBe(false);
  });
  it("endpoint without a TypeSafe key flags as unchecked", async () => {
    const r = await post(createApp({ index }), "/verify", { text: "t", excerpt: "e", sourceText: "an e here" });
    expect(await r.json()).toEqual({ verbatim: true, flagged: true });
  });
  it("low confidence flags, high confidence supports passes", async () => {
    const mk = (confidence: number) =>
      (async () => new Response(JSON.stringify({ answers: { relation: { choice: "supports", confidence } }, usage: { input_tokens: 1, output_tokens: 1 } }))) as typeof fetch;
    const base = { text: "t", excerpt: "e", sourceText: "e" };
    expect((await verify(base, { TYPESAFE_API_KEY: "k", fetchImpl: mk(0.6) })).flagged).toBe(true);
    const ok = await verify(base, { TYPESAFE_API_KEY: "k", fetchImpl: mk(0.95) });
    expect(ok).toMatchObject({ verdict: "supports", flagged: false });
  });
});

describe("rank", () => {
  it("score arithmetic, including null overlap", () => {
    expect(ALPHA).toBe(0.5);
    expect(computeScore(0.8, 0.4)).toBeCloseTo(0.6);
    expect(computeScore(0.7, null)).toBe(0.7);
  });
  it("rationale reads from the numbers", () => {
    const inv = { o2Range: [21, 34], pressureRange: null } as never;
    const hab = { o2Percent: 30, pressureKPa: 70.3 } as never;
    expect(rationale(inv, hab, 1)).toBe("Tested at 21 to 34% oxygen, which covers this habitat's 30%.");
  });
  it("null overlap gives dimsUsed 0 and illustrative provenance", async () => {
    const inp = loadInputs();
    const items = await buildItems({ ...inp, overlaps: [] }, async () => 0.5);
    expect(items.length).toBe(inp.investigations.length * inp.habitats.length);
    expect(items.every((i) => i.dimsUsed === 0 && i.provenance === "illustrative" && i.score === 0.5)).toBe(true);
  });
});

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("live smoke", () => {
  it("answers via Haiku", async () => {
    const r = await post(createApp({ index }), "/ask", { question: "How big are smoke particles?" }, { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY });
    expect((await r.json()).mode).toMatch(/live|extractive/);
  });
});
