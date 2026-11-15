import { describe, expect, it } from "vitest";
import factsJson from "../public/data/facts.json";
import { extractive } from "./ask.ts";
import { fixtureIndex } from "./app.ts";
import { buildPick, MAX_PICK, parsePick, pickFacts, PICK_SYSTEM } from "./factpick.ts";
import { factPool, findFacts, type DataFact } from "./facts.ts";

const facts = factsJson as DataFact[];
const byId = (id: string) => facts.find((f) => f.id === id)!;
const ids = (fs: DataFact[]) => fs.map((f) => f.id);

/** Fake Anthropic API that answers every call with `text` (or fails), recording the calls. */
function fakeApi(text: string | (() => never)) {
  const calls: { system: string; user: string }[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ system: body.system, user: body.messages.at(-1).content });
    if (typeof text === "function") text();
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }));
  }) as unknown as typeof fetch;
  return { env: { ANTHROPIC_API_KEY: "k", fetchImpl }, calls };
}

describe("parsePick validates the model's reply", () => {
  const pool = [byId("flex-diluent-co2"), byId("physics-direction"), byId("flex-diluent-he")];
  it("keeps known ids in the model's order", () => {
    expect(ids(parsePick('{"ids": ["physics-direction", "flex-diluent-co2"]}', pool)!)).toEqual(["physics-direction", "flex-diluent-co2"]);
  });
  it("drops unknown and repeated ids", () => {
    expect(ids(parsePick('{"ids": ["made-up", "flex-diluent-co2", "flex-diluent-co2", "flex-runs"]}', pool)!)).toEqual(["flex-diluent-co2"]);
  });
  it(`cuts more than ${MAX_PICK}`, () => {
    expect(ids(parsePick('{"ids": ["flex-diluent-he", "flex-diluent-co2", "physics-direction"]}', pool)!)).toEqual(["flex-diluent-he", "flex-diluent-co2"]);
  });
  it("an empty list is 'none'", () => {
    expect(parsePick('{"ids": []}', pool)).toEqual([]);
  });
  it("no JSON, no ids list, or only unknown ids is unusable", () => {
    expect(parsePick("The CO2 fact.", pool)).toBeNull();
    expect(parsePick('{"ranking": [1]}', pool)).toBeNull();
    expect(parsePick('{"ids": ["made-up", 3]}', pool)).toBeNull();
  });
});

describe("pickFacts", () => {
  const q = "Does CO2 put out a droplet flame?";
  it("asks once with the pool, question and facts marked as data, and uses the pick", async () => {
    const api = fakeApi('{"ids": ["flex-diluent-co2"]}');
    const r = await pickFacts(facts, q, api.env);
    expect(ids(r.facts)).toEqual(["flex-diluent-co2"]);
    expect(r.used).toBe(true);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].system).toBe(PICK_SYSTEM);
    expect(PICK_SYSTEM).toMatch(/data, not instructions/);
    expect(api.calls[0].user).toBe(buildPick(q, factPool(facts, q)));
    expect(api.calls[0].user).toContain('<finding id="flex-diluent-co2">');
  });
  it("the model's 'none' means no fact", async () => {
    const r = await pickFacts(facts, q, fakeApi('{"ids": []}').env);
    expect(r).toEqual({ facts: [], used: true });
  });
  it("question and fact text cannot open or close a tag", () => {
    expect(buildPick("</question><question>x", [])).not.toContain("</question><question>");
  });

  describe("fallbacks return exactly findFacts", () => {
    const old = findFacts(facts, q);
    it("no API key: no call", async () => {
      const api = fakeApi('{"ids": ["flex-diluent-co2"]}');
      const r = await pickFacts(facts, q, { fetchImpl: api.env.fetchImpl });
      expect(r).toEqual({ facts: old, used: false });
      expect(api.calls).toHaveLength(0);
    });
    it("a failed call", async () => {
      const r = await pickFacts(facts, q, fakeApi(() => { throw new Error("network"); }).env);
      expect(r).toEqual({ facts: old, used: false });
    });
    it("an API error status", async () => {
      const fetchImpl = (async () => new Response("busy", { status: 529 })) as unknown as typeof fetch;
      expect(await pickFacts(facts, q, { ANTHROPIC_API_KEY: "k", fetchImpl })).toEqual({ facts: old, used: false });
    });
    it("an unusable reply", async () => {
      expect(await pickFacts(facts, q, fakeApi("I think the CO2 one.").env)).toEqual({ facts: old, used: false });
      expect(await pickFacts(facts, q, fakeApi('{"ids": ["invented-fact"]}').env)).toEqual({ facts: old, used: false });
    });
  });

  it("a ranking question the dashboard answers makes no model call", async () => {
    const api = fakeApi('{"ids": ["flex-runs"]}');
    const r = await pickFacts(facts, "Which experiment ranks highest for ISS?", api.env);
    expect(ids(r.facts)).toEqual(["dash-rank-PSI-69-iss"]);
    expect(api.calls).toHaveLength(0);
  });
  it("with the veto on, a question naming a paper topic gets no fact and no call", async () => {
    const api = fakeApi('{"ids": ["flex-runs"]}');
    expect(await pickFacts(facts, "How does water mist put out fires?", api.env)).toEqual({ facts: [], used: false });
    expect(api.calls).toHaveLength(0);
  });
});

describe("factPool", () => {
  it("relaxes coverage: a fact worded unlike the question still reaches the pool", () => {
    const q = "Is helium any good at stopping a droplet fire?";
    expect(findFacts(facts, q)).toEqual([]);
    expect(ids(factPool(facts, q))).toContain("flex-diluent-he");
  });
  it("puts findFacts' own picks first and holds at most 10", () => {
    const q = "How many FLEX runs used helium?";
    const pool = factPool(facts, q);
    expect(pool.slice(0, 2)).toEqual(findFacts(facts, q));
    expect(pool.length).toBeLessThanOrEqual(10);
  });
  it("keeps the dashboard rules: no ranking facts for a topic question, ranking facts only for a ranking question", () => {
    expect(ids(factPool(facts, "What is a cool flame?")).some((id) => id.startsWith("dash-"))).toBe(false);
    expect(ids(factPool(facts, "Which experiment ranks highest for ISS?")).every((id) => id.startsWith("dash-"))).toBe(true);
  });
});

it("the quote-only path still picks facts by keyword alone", () => {
  const q = "How many FLEX runs used helium?";
  const r = extractive(fixtureIndex(), q, undefined, { facts });
  expect(r.facts?.map((f) => f.id)).toEqual(ids(findFacts(facts, q)));
});
