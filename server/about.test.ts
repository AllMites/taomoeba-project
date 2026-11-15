import { describe, expect, it } from "vitest";
import { aboutAnswer, isAboutQuestion } from "./about.ts";
import { ask } from "./ask.ts";
import { buildIndex } from "./bm25.ts";

const index = buildIndex([
  { id: "a#0", sourceId: "psi:PSI-A", investigationId: "PSI-A", text: "Silicone burned in microgravity." },
  { id: "b#0", sourceId: "psi:PSI-B", investigationId: "PSI-B", text: "Smoke particles were larger in microgravity." },
]);
const boom = (async () => {
  throw new Error("no network in this test");
}) as unknown as typeof fetch;
const env = { ANTHROPIC_API_KEY: "k", TYPESAFE_API_KEY: "k", fetchImpl: boom };

describe("isAboutQuestion", () => {
  it.each(["What is the entire project about?", "what is this site", "Who built this?", "What is Firebreak?", "what does SI stand for"])("matches %s", (q) =>
    expect(isAboutQuestion(q)).toBe(true),
  );
  it.each(["What did the FLEX project find about flames?", "Does CO2 put out a droplet flame?", "what does this project say about fire spread"])("does not match %s", (q) =>
    expect(isAboutQuestion(q)).toBe(false),
  );
});

describe("ask: about", () => {
  it("answers with the fixed text, no model call, counts from the loaded data", async () => {
    const r = await ask(index, "What is the entire project about?", "iss", env);
    expect(r.mode).toBe("about");
    expect(r.claims).toEqual([]);
    expect(r.facts).toBeUndefined();
    expect(r.model).toBeNull();
    expect(r.answer).toBe(aboutAnswer({ experiments: 2, sources: 2 }).join("\n\n"));
    expect(r.answer).toContain("2 NASA experiment records and the 2 sources Ask SI searches");
  });
  it("a follow-up with history is not routed to about", async () => {
    const r = await ask(index, "What is the entire project about?", "iss", env, {}, [{ question: "q", answer: "a" }]);
    expect(r.mode).not.toBe("about");
  });
});
