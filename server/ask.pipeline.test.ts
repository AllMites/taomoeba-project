import { describe, expect, it } from "vitest";
import factsJson from "../public/data/facts.json";
import { createApp, fixtureIndex, restrictedChunks, savedFrom, sourceInfoFrom } from "./app.ts";
import { DATA_ONLY, extractive, NO_COVER } from "./ask.ts";
import { buildIndex } from "./bm25.ts";
import { addsFacts, coverage, expandQuery, inScope, quotesTooMuch } from "./checks.ts";
import type { DataFact } from "./facts.ts";

const index = fixtureIndex();
const facts = factsJson as DataFact[];
const SENT = "Median particle diameter was larger than typical ground-based smoke detector test aerosols.";

/** Fake Anthropic API: answers the re-ranker, the claim writer and the support checker by their system prompt. */
function fakeApi(r: { rerank?: string; claims?: string; support?: string; answer?: string }) {
  const calls: string[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const sys: string = body.system;
    const kind = sys.startsWith("You rank passages") ? "rerank" : sys.startsWith("You check whether") ? "support" : sys.startsWith("You are SI") ? "answer" : "claims";
    calls.push(kind);
    expect(body.thinking).toEqual({ type: "disabled" });
    const text = r[kind] ?? (kind === "rerank" ? '{"ranking": [1], "none_relevant": false}' : '{"results": [{"n": 1, "supported": true, "reason": "same"}]}');
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }));
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const claimsReply = (claims: object[], note = "") => JSON.stringify({ claims, note });
const ask = async (question: string, api: ReturnType<typeof fakeApi>, opts: Parameters<typeof createApp>[0] = { index }, habitat?: string) => {
  const r = await createApp(opts).request(
    "/ask",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, habitat }) },
    { ANTHROPIC_API_KEY: "k", fetchImpl: api.fetchImpl },
  );
  return r.json();
};

describe("deterministic claim checks", () => {
  it("catches added numbers, negations, absolutes and flipped directions; passes faithful rewording", () => {
    const q = "Droplets extinguished at a diameter that depended on oxygen concentration.";
    expect(addsFacts("Droplets went out at a size that depended on the oxygen level.", q)).toBeNull();
    expect(addsFacts("Droplets went out at 2 mm.", q)).toMatch(/number/);
    expect(addsFacts("Droplet size did not depend on oxygen.", q)).toMatch(/negation/);
    expect(addsFacts("Droplets always went out at one size.", q)).toMatch(/absolute/);
    expect(addsFacts("Smoke particles were smaller.", SENT)).toMatch(/smaller/);
    expect(addsFacts("Ignition took 12 to 13 percent oxygen.", "about 12% to 13% oxygen")).toBeNull();
  });
  it("copyrighted text may not be copied for more than 15 words", () => {
    const src = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen";
    expect(quotesTooMuch("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen", src)).toBe(true);
    expect(quotesTooMuch("one two three four five six seven eight nine ten", src)).toBe(false);
  });
  it("scope: fire-science questions are in scope, others are not", () => {
    expect(inScope("Why do droplets go out?")).toBe(true);
    expect(inScope("What is the population of Malaga?")).toBe(false);
  });
  it("scope: experiment names match whole words only, incidents count", () => {
    expect(inScope("How do I bake bread?")).toBe(false); // "bre" (Burning Rate Emulator) is not a prefix match
    expect(inScope("What does the BRE emulate?")).toBe(true);
    expect(inScope("What happened on Apollo 13?")).toBe(true);
    expect(inScope("What happened during the Mir fire?")).toBe(true);
  });
  it("Apollo 1 is searched as Apollo 204 (the review board's name for it); Apollo 13 is not", () => {
    expect(expandQuery("What caused the Apollo 1 fire?")).toContain("apollo 204");
    expect(expandQuery("Why did Apollo 13 fail?")).not.toContain("204");
  });
  it("bare numbers are no evidence of coverage", () => {
    expect(coverage("Who won the 2022 World Cup?", ["ICES-2022 conference, 10-14 July 2022"], { "2022": 1 })).toBe(0);
  });
});

describe("live answers: re-rank, exact-sentence claims, checks, support check", () => {
  it("keeps a faithful claim tied to one exact sentence, with reasoning off on every call", async () => {
    const api = fakeApi({ claims: claimsReply([{ text: "Smoke particles were larger than the test aerosols used for detectors.", source: "SRC-05", excerpt: SENT }]) });
    const j = await ask("How big are smoke particles?", api);
    expect(j.mode).toBe("live");
    expect(j.claims).toHaveLength(1);
    expect(j.claims[0].excerpt).toBe(SENT);
    expect(j.claims[0].flagged).toBeUndefined();
    expect(j.answer).toBe("Smoke particles were larger than the test aerosols used for detectors. [SRC-05]");
    expect(api.calls).toEqual(["rerank", "claims", "support", "answer"]);
  });
  it("drops a claim that adds a number, an excerpt not in the source, and an invented source; all dropped -> quotes", async () => {
    const api = fakeApi({
      claims: claimsReply([
        { text: "Smoke particles were 5 times larger than test aerosols.", source: "SRC-05", excerpt: SENT },
        { text: "Particles were large.", source: "SRC-05", excerpt: "Particles were huge in every test." },
        { text: "Something else.", source: "SRC-99", excerpt: SENT },
      ]),
    });
    expect((await ask("How big are smoke particles?", api)).mode).toBe("extractive");
  });
  it("support check: 'not supported' drops the claim; an unusable checker reply keeps it but flagged", async () => {
    const claim = claimsReply([{ text: "Smoke particles were larger than detector test aerosols.", source: "SRC-05", excerpt: SENT }]);
    const no = await ask("smoke particle size", fakeApi({ claims: claim, support: '{"results": [{"n": 1, "supported": false, "reason": "adds a cause"}]}' }));
    expect(no.mode).toBe("extractive");
    const garbled = await ask("smoke particle size?", fakeApi({ claims: claim, support: "I cannot decide" }));
    expect(garbled.mode).toBe("live");
    expect(garbled.claims[0].flagged).toBe(true);
  });
  it("a reason with a stray quotation mark still counts", async () => {
    const claim = claimsReply([{ text: "Smoke particles were larger than detector test aerosols.", source: "SRC-05", excerpt: SENT }]);
    const j = await ask("smoke particle size", fakeApi({ claims: claim, support: '{"results": [{"n": 1, "supported": true, "reason": "quote says "larger""}]}' }));
    expect(j.mode).toBe("live");
    expect(j.claims[0].flagged).toBeUndefined();
  });
  it("re-ranker saying no passage answers -> not covered, without writing an answer", async () => {
    const api = fakeApi({ rerank: '{"ranking": [], "none_relevant": true}' });
    const j = await ask("How fast does flame spread over fabric?", api);
    expect(j.answer).toBe(NO_COVER);
    expect(api.calls).toEqual(["rerank"]);
  });
  it("off-topic question -> not covered, with no model call at all", async () => {
    const api = fakeApi({});
    expect((await ask("What is the population of Malaga?", api)).answer).toBe(NO_COVER);
    expect(api.calls).toEqual([]);
  });
});

describe("data questions: computed fact first, papers labelled by how they relate", () => {
  const opts = { index, facts };
  it("shows the data fact and labels a paper claim that explains it", async () => {
    const api = fakeApi({
      claims: claimsReply([{ text: "Droplets went out at a size that depended on the oxygen level.", source: "SRC-02", excerpt: "Droplets extinguished at a diameter that depended on oxygen concentration.", relation: "explains" }]),
    });
    const j = await ask("Do bigger droplets go out at a bigger diameter?", api, opts);
    expect(j.facts[0].id).toMatch(/^flex-dext-d0/);
    expect(j.facts[0].statement).toContain("rank correlation");
    expect(j.mode).toBe("live");
    expect(j.relations).toEqual({ "ask-1": "explains" });
    expect(j.claims[0].verdict).toBe("supports");
  });
  it("no paper relates -> the data fact alone, said plainly", async () => {
    const j = await ask("Why did so many high-oxygen FLEX runs end in disruption?", fakeApi({ rerank: '{"ranking": [], "none_relevant": true}' }), opts);
    expect(j.answer).toBe(DATA_ONLY);
    expect(j.facts[0].id).toBe("flex-end-o2");
    expect(j.claims).toEqual([]);
  });
  it("quote-only mode (no key) shows the data fact too", () => {
    const r = extractive(index, "Do inverse flames self-extinguish less often than normal flames?", undefined, { facts });
    expect(r.facts?.[0].id).toMatch(/^cfig-se/);
  });
  it("a paper-topic question gets no data fact", async () => {
    const j = await ask("What is the Burning Rate Emulator?", fakeApi({}), opts);
    expect(j.facts).toBeUndefined();
  });
});

describe("live answers quote only the sources' own text", () => {
  it("a sentence we wrote ourselves (a claim filed under a source) cannot be quoted as that source", async () => {
    const own = "Smoke particles are larger than the aerosols used to certify ground detectors."; // claims fixture text
    const api = fakeApi({ claims: claimsReply([{ text: "Smoke particles are larger than detector test aerosols.", source: "SRC-05", excerpt: own }]) });
    expect((await ask("How big are smoke particles?", api)).mode).toBe("extractive");
  });
});

describe("ranking questions", () => {
  it("the ranking is the whole answer: no paper search, no model call", async () => {
    const api = fakeApi({});
    const j = await ask("Which experiment ranks highest for ISS on the dashboard?", api, { index, facts });
    expect(j.answer).toBe("");
    expect(j.facts.map((f: { id: string }) => f.id)).toEqual(["dash-rank-PSI-69-iss"]);
    expect(api.calls).toEqual([]);
  });
});

describe("short-quotes-only papers (private library)", () => {
  const RSENT =
    "In these tests the methanol droplet flames went out at larger droplet diameters when the oxygen level in the chamber was lowered further.";
  const priv = restrictedChunks({
    chunks: [{ id: "ntrs:1#0", sourceId: "ntrs:1", investigationId: "PSI-69", text: `${RSENT} Other text about droplet tests follows here.` }],
  });
  const index2 = buildIndex([...index.chunks, ...priv]);
  const sources = { "ntrs:1": { title: "A FLEX paper", url: "https://ntrs.nasa.gov/citations/1", license: "NTRS: public use permitted (short quotes only)" } };
  const opts = { index: index2, licenses: { "ntrs:1": sources["ntrs:1"].license }, sources };

  it("KV text loads as restricted; junk loads as nothing", () => {
    expect(priv[0].restricted).toBe(true);
    expect(restrictedChunks(null)).toEqual([]);
    expect(restrictedChunks({ chunks: [{ id: 1 }] })).toEqual([]);
  });
  it("quote-only mode never quotes them", () => {
    const r = extractive(index2, "methanol droplet flames oxygen level larger droplet diameters", undefined, { licenses: opts.licenses });
    expect(r.claims.every((c) => c.sourceIds[0] !== "ntrs:1")).toBe(true);
  });
  it("live: a paraphrase is kept, its quote is cut to 15 words, and the paper's title and link come along", async () => {
    const api = fakeApi({ claims: claimsReply([{ text: "Methanol droplet flames went out at bigger sizes when oxygen was lowered.", source: "ntrs:1", excerpt: RSENT }]) });
    const j = await ask("Do methanol droplet flames go out at larger diameters with less oxygen?", api, opts);
    expect(j.mode).toBe("live");
    expect(j.claims[0].excerpt.split(" ").length).toBeLessThanOrEqual(16);
    expect(j.claims[0].excerpt.endsWith("…")).toBe(true);
    expect(j.sources["ntrs:1"].title).toBe("A FLEX paper");
  });
  it("live: a claim copying more than 15 words of it is dropped", async () => {
    const copied = RSENT.split(" ").slice(0, 18).join(" ") + ".";
    const api = fakeApi({ claims: claimsReply([{ text: copied, source: "ntrs:1", excerpt: RSENT }]) });
    const j = await ask("Do methanol droplet flames go out at larger diameters with less oxygen?", api, opts);
    expect(j.claims.every((c: { sourceIds: string[] }) => c.sourceIds[0] !== "ntrs:1")).toBe(true);
  });
  it("source titles and links come from public metadata only", () => {
    const info = sourceInfoFrom({ items: [{ id: "a", title: "T", url: "u", license: "CC0" }] }, [{ id: "b", title: "U" }]);
    expect(info).toEqual({ a: { title: "T", url: "u", license: "CC0" }, b: { title: "U", url: "", license: "" } });
  });
});

describe("saved answers for demo questions", () => {
  const savedResult = { answer: "Saved claim. [SRC-05]", claims: [], investigationIds: [], mode: "live" as const };
  const saved = savedFrom({ made: "2026-11-14", items: [{ question: "What is a cool flame?", result: savedResult }, { question: "Broken", result: { answer: 3 } }] });

  it("only well-formed answers load, keyed by the normalized question, with the day they were made", () => {
    expect(Object.keys(saved)).toEqual(["what is a cool flame"]);
    expect(saved["what is a cool flame"].savedAt).toBe("2026-11-14");
  });
  it("the same question (any case, spacing, final ?) is answered from the save, with no model call", async () => {
    const api = fakeApi({});
    const j = await ask("  what is a COOL flame  ", api, { index, saved });
    expect(j.mode).toBe("saved");
    expect(j.answer).toBe("Saved claim. [SRC-05]");
    expect(api.calls).toEqual([]);
  });
  it("fresh: true skips the save (how new saves are recorded)", async () => {
    const api = fakeApi({ rerank: '{"ranking": [], "none_relevant": true}' });
    const r = await createApp({ index, saved }).request(
      "/ask",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "What is a cool flame?", fresh: true }) },
      { ANTHROPIC_API_KEY: "k", fetchImpl: api.fetchImpl },
    );
    expect((await r.json()).mode).toBe("live");
  });
});
