import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Answer, Composer, Launcher, Panel, Steps, TurnView } from "./chat.tsx";
import { askRecords, NO_STEPS, type AskOutcome, type AskResult } from "./respond.ts";
import { composerKey, filledSteps, FOLLOW_UPS, historyFrom, IDLE_STEPS, launcherHidden, modelLabel, startOver, summaryLine, WORKING_STEPS, writerLine, type TurnState } from "./thread.ts";

const noop = () => {};
const claim = { id: "ask-1", investigationId: "PSI-20", kind: "finding" as const, text: "Silicone burned.", sourceIds: ["psi:PSI-20"], excerpt: "e" };
const live = { searched: 37, matched: 4, facts: 0, reranked: 20, kept: 3, dropped: 0, checked: 3 };
const result = (over: Partial<AskResult> = {}): AskResult => ({
  answer: "Silicone burned. [psi:PSI-20]",
  claims: [claim],
  investigationIds: ["PSI-20"],
  mode: "live",
  model: "claude-haiku-5-5",
  steps: live,
  ...over,
});
const answered = (id: number, q: string, r = result()): TurnState => ({ id, question: q, outcome: { kind: "answer", result: r } });
const text = (steps: ReturnType<typeof filledSteps>) => steps.map((s) => [s.text, s.small].filter(Boolean).join(" | "));
const panel = (turns: TurnState[], open = true, over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <Panel open={open} wide turns={turns} busy={false} draft="" habitatLabel="Moon Base" live="" lastResult={null} titleOf={(s) => s} onDraft={noop} onSend={noop} onPick={noop} onClose={noop} onReset={noop} onOpenExperiment={noop} onShow={noop} {...over} />,
  );

// ---- history ----
it("sends the earlier turns with a follow-up, capped at the last 4, data findings first", async () => {
  const turns = Array.from({ length: 6 }, (_, i) => answered(i, `q${i}`, result({ answer: `a${i} [psi:PSI-20]` })));
  const history = historyFrom(turns);
  expect(history).toEqual([2, 3, 4, 5].map((i) => ({ question: `q${i}`, answer: `a${i}` })));
  const withFact = historyFrom([answered(1, "q", result({ facts: [{ id: "f", statement: "Rank correlation is 0.4.", dataset: "d", caveat: "", source: "s" }] }))]);
  expect(withFact[0].answer).toBe("Rank correlation is 0.4. Silicone burned.");
  let sent: { question: string; history?: unknown } = { question: "" };
  const f = (async (_u: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ answer: "A.", claims: [], investigationIds: [], mode: "mock" }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  await askRecords("follow up", "moon", f, undefined, history);
  expect(sent.history).toEqual(history);
  await askRecords("first", "moon", f);
  expect(sent.history).toBeUndefined();
});

it("leaves failed, unanswered and no-cover turns out of what is sent, and keeps answers within 1200 characters", () => {
  const err: AskOutcome = { kind: "error", reason: "offline", message: "x" };
  const turns: TurnState[] = [
    { id: 1, question: "a", outcome: err },
    { id: 2, question: "b", outcome: null },
    { id: 3, question: "c", outcome: { kind: "nocover", result: result({ answer: "The PSI records I have do not cover that." }) } },
    answered(4, "d", result({ answer: `${"w ".repeat(900)}[psi:PSI-20]` })),
  ];
  const h = historyFrom(turns);
  expect(h).toHaveLength(1);
  expect(h[0].answer.length).toBeLessThanOrEqual(1200);
});

it("drops the oldest turns so a follow-up in a wide script still fits the server's 8 KB limit", async () => {
  const wide = "火".repeat(300); // 3 bytes each in UTF-8
  const history = [1, 2, 3, 4].map((i) => ({ question: `${i}${wide.slice(1)}`, answer: "炎".repeat(1200) }));
  let raw = "";
  const f = (async (_u: unknown, init?: RequestInit) => {
    raw = String(init?.body);
    return new Response(JSON.stringify({ answer: "A.", claims: [], investigationIds: [], mode: "mock" }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  await askRecords(wide, "moon", f, undefined, history);
  expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(8 * 1024);
  const sent = JSON.parse(raw).history as { question: string }[];
  expect(sent.length).toBeGreaterThan(0);
  expect(sent[sent.length - 1].question.startsWith("4")).toBe(true); // the newest turn is kept
});

it("an older server reply with no steps still reads (all zeros, no model)", async () => {
  const f = (async () => new Response(JSON.stringify({ answer: "A.", claims: [], investigationIds: [], mode: "extractive" }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  const out = await askRecords("q", "moon", f);
  expect(out).toMatchObject({ kind: "answer", result: { steps: NO_STEPS, model: null } });
});

// ---- steps and the summary line, per mode ----
it("live: real numbers, the model named, the second check said exactly", () => {
  expect(text(filledSteps(result()))).toEqual([
    "Searched 37 sources, 4 were used | SI put the best passages first",
    "Written by SI from 4 sources | Claude Haiku, by Anthropic",
    "3 sentences kept, each quoting its source | 3 confirmed by a second SI read",
  ]);
  expect(modelLabel("claude-haiku-5-5")).toBe("Claude Haiku, by Anthropic");
  expect(summaryLine(result())).toBe("Searched 37 sources · 4 used · 3 sentences checked");
});

it("live: dropped, unchecked and un-reranked are each said, never hidden", () => {
  const r = result({ steps: { ...live, reranked: 0, kept: 2, dropped: 1, checked: 1 } });
  const t = text(filledSteps(r));
  expect(t[0]).toContain("Passages kept in keyword order");
  expect(t[2]).toBe("2 sentences kept, each quoting its source | 1 confirmed by a second SI read · 1 not double-checked · 1 dropped: failed a check");
  expect(summaryLine(r)).toBe("Searched 37 sources · 4 used · 2 sentences checked · 1 dropped");
});

it("data findings are counted in the search step", () => {
  const r = result({ steps: { ...live, facts: 2 }, facts: [] });
  expect(text(filledSteps(r))[0]).toContain("2 findings computed from the team's tables");
});

it("quoting mode: the SI writer is off, no model named, no second read claimed", () => {
  const r = result({ mode: "extractive", model: null, steps: { ...NO_STEPS, searched: 30, matched: 3, kept: 2 } });
  expect(text(filledSteps(r))).toEqual(["Searched 30 sources, 3 matched", "Quoted word for word, the SI writer is off", "2 sentences copied word for word from the records"]);
  expect(summaryLine(r)).toBe("Searched 30 sources · 3 matched · quoted word for word");
});

it("a fallback after a failed live call says the SI writer did not answer, or that its sentences failed the checks", () => {
  const base = { mode: "extractive" as const, model: null, degraded: true };
  const none = result({ ...base, steps: { ...NO_STEPS, searched: 30, matched: 2, kept: 1 } });
  expect(filledSteps(none)[1].text).toBe("The SI writer did not answer, so this is quoted word for word");
  expect(summaryLine(none)).toBe("SI writer did not answer · quoted word for word");
  const refused = result({ ...base, steps: { ...NO_STEPS, searched: 30, matched: 2, kept: 1, dropped: 2 } });
  expect(filledSteps(refused)[1].text).toBe("SI wrote 2 sentences, but none passed the checks, so this is quoted word for word");
  expect(summaryLine(refused)).toBe("SI's sentences failed the checks · quoted word for word");
});

it("mock: a sample, with no search, writer or check claimed", () => {
  const r = result({ mode: "mock", model: null, steps: NO_STEPS });
  expect(text(filledSteps(r))).toEqual(["No search ran, this is a sample record", "Sample text, no SI writer ran", "Not checked, this is a sample"]);
  expect(summaryLine(r)).toBe("Sample answer · nothing searched or checked");
});

it("a ranking answer says it came from the tables and that no paper or SI writer was used", () => {
  const r = result({ answer: "", claims: [], mode: "live", model: null, facts: [{ id: "d", statement: "PSI-69 ranks first.", dataset: "Dashboard", caveat: "", source: "team:x" }], steps: { ...NO_STEPS, facts: 1 } });
  expect(summaryLine(r)).toBe("Computed from the team's tables · no paper search");
  expect(filledSteps(r)[1].text).toContain("no SI writer");
});

it("nothing matched is said in one plain line", () => {
  const r = result({ answer: "The PSI records I have do not cover that.", claims: [], model: null, steps: { ...NO_STEPS, searched: 37 } });
  expect(summaryLine(r, true)).toBe("Searched 37 sources · nothing matched");
  expect(text(filledSteps(r, true))[2]).toBe("No sentence to check");
});

it("no step line says AI, according to NASA, or goes past 25 words", () => {
  const all = [
    ...IDLE_STEPS,
    ...WORKING_STEPS,
    ...filledSteps(result()),
    ...filledSteps(result({ mode: "extractive", model: null, degraded: true, steps: { ...NO_STEPS, dropped: 2, kept: 1 } })),
  ];
  for (const s of all) for (const t of [s.text, s.small ?? ""]) {
    expect(t).not.toMatch(/\bAI\b|according to NASA|investigation/i);
    expect(t.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25);
  }
});

it("the writer line under the title follows the last reply", () => {
  expect(writerLine(null)).toContain("answers only from NASA records");
  expect(writerLine(result())).toBe("Claude Haiku, by Anthropic · answers only from NASA records");
  expect(writerLine(result({ mode: "extractive", model: null }))).toContain("Quoting mode, the SI writer is off");
  expect(writerLine(result({ mode: "extractive", model: null, degraded: true }))).toContain("The SI writer did not answer");
  expect(writerLine(result({ mode: "mock", model: null }))).toContain("Sample answers");
});

it("the writer line after a fallback whose sentences failed the checks does not say the writer did not answer", () => {
  const refused = writerLine(result({ mode: "extractive", model: null, degraded: true, steps: { ...NO_STEPS, searched: 30, matched: 2, kept: 1, dropped: 2 } }));
  expect(refused).not.toContain("did not answer");
  expect(refused).toContain("failed the checks");
});

// ---- the panel ----
it("the empty panel explains the steps and offers the examples; the composer is labelled", () => {
  const html = panel([]);
  expect(html).toContain("How an answer is made");
  for (const s of IDLE_STEPS) expect(html).toContain(s.small!.replace(/'/g, "&#x27;"));
  expect(html).toContain("Which experiments tested 30% oxygen?");
  expect(html).toContain('<label for="ask-compose" class="ask-compose-label">Your question</label>');
  expect(html).toContain("Answering for: Moon Base");
  expect(html).toContain('aria-labelledby="ask-panel-h"');
});

it("after the first answer the label reads Ask a follow-up, follow-up chips show above it, and New chat appears", () => {
  const html = panel([answered(1, "What is silicone?")]);
  expect(html).toContain(">Ask a follow-up</label>");
  for (const f of FOLLOW_UPS) expect(html).toContain(f);
  expect(html).not.toContain("30% oxygen");
  expect(html).toContain("New chat");
  expect(panel([]).includes("New chat")).toBe(false);
});

it("closing and reopening the panel keeps the conversation (the thread is passed in, open only changes the dialog)", () => {
  const turns = [answered(1, "first question"), answered(2, "second question")];
  for (const open of [true, false, true]) {
    const html = panel(turns, open);
    expect(html).toContain("first question");
    expect(html).toContain("second question");
  }
  const src = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
  expect(src).toMatch(/const \[turns, setTurns\] = useState/); // state sits above the panel
});

it("messages are a list: the person's question, then SI's answer with no bubble", () => {
  const html = panel([answered(1, "q one")]);
  expect(html).toContain('aria-label="Conversation"');
  expect(html).toMatch(/<li class="ask-turn"[^>]*>\s*<p class="ask-q">/);
});

it("a pending turn shows the live steps row with step 1 active, in place of an answer", () => {
  const html = renderToStaticMarkup(<ol><TurnView turn={{ id: 1, question: "q", outcome: null }} titleOf={(s) => s} onOpen={noop} onShow={noop} /></ol>);
  expect(html).toContain('data-state="active"');
  expect(html).toContain("Searching the records…");
  expect(html).not.toContain("ask-reply");
});

it("under an answer: one summary line that opens into the steps, then the sources, then the Show control", () => {
  const html = renderToStaticMarkup(<Answer result={result({ investigationIds: ["a", "b"] })} titleOf={(s) => s} onOpen={noop} onShow={noop} />);
  const a = html.indexOf("Searched 37 sources · 4 used · 3 sentences checked");
  expect(html).toContain('<details class="ask-howmade">');
  expect(a).toBeGreaterThan(0);
  const b = html.indexOf("Sources");
  const c = html.indexOf("Show the 2 experiments this answer used");
  expect(a).toBeLessThan(b);
  expect(b).toBeLessThan(c);
  expect(html).toContain("See experiment");
});

it("keeps every per-source piece of the answer: title, short-quote label, full-source link, relation, data finding", () => {
  const r = result({
    sources: { "psi:PSI-20": { title: "A NASA report", url: "https://ntrs.nasa.gov/citations/1", license: "NTRS: public use permitted (short quotes only)" } },
    relations: { "ask-1": "explains" },
    facts: [{ id: "f1", statement: "Rank correlation is 0.4.", dataset: "FLEX table", caveat: "small sample", source: "psi:PSI-69" }],
    claims: [{ ...claim, flagged: true }],
  });
  const html = renderToStaticMarkup(<Answer result={r} titleOf={(s) => s} onOpen={noop} onShow={noop} />);
  for (const t of ["A NASA report", "Short quote:", "Read the full source", 'href="https://ntrs.nasa.gov/citations/1"', "Explains the finding", "Rank correlation is 0.4.", "not double-checked", "What the data shows"]) expect(html).toContain(t);
});

it("an answer with no experiment ids has no Show control", () => {
  expect(renderToStaticMarkup(<Answer result={result({ investigationIds: [] })} titleOf={(s) => s} onOpen={noop} onShow={noop} />)).not.toContain("Show the");
});

it("steps render a tick and the word Done, so state is not carried by colour alone", () => {
  const html = renderToStaticMarkup(<Steps steps={filledSteps(result())} label="x" />);
  expect(html).toContain("✓");
  expect(html).toContain("Done: ");
});

// ---- launcher and composer ----
it("the launcher says Ask SI in words and is hidden while the panel or the detail drawer is open", () => {
  expect(renderToStaticMarkup(<Launcher hidden={false} onOpen={noop} />)).toMatch(/class="ask-launch"[^>]*>.*Ask SI/);
  expect(renderToStaticMarkup(<Launcher hidden onOpen={noop} />)).toContain("hidden");
  expect(launcherHidden(false, false)).toBe(false);
  expect(launcherHidden(false, true)).toBe(true);
  expect(launcherHidden(true, false)).toBe(true);
  const src = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
  expect(src).toContain("s.selectedInvestigationId !== null");
});

it("Enter sends, Shift+Enter is a new line, and Enter inside an IME composition is left alone", () => {
  expect(composerKey({ key: "Enter", shiftKey: false })).toBe("send");
  expect(composerKey({ key: "Enter", shiftKey: true })).toBe("newline");
  expect(composerKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe("newline");
  expect(composerKey({ key: "a", shiftKey: false })).toBe("newline");
});

it("the composer is a textarea with a visible label, a send button and a character limit", () => {
  const html = renderToStaticMarkup(<Composer value="" busy={false} label="Ask a follow-up" chips={FOLLOW_UPS} chipsLabel="Follow-up questions" habitatLabel="ISS" onChange={noop} onSend={noop} onPick={noop} />);
  expect(html).toContain("<textarea");
  expect(html).toContain('maxLength="300"');
  expect(html).toContain("Send");
  expect(html).toContain("Answering for: ISS");
});

it("Start over aborts, clears the thread, the highlights and the input", () => {
  const d = { abort: vi.fn(), clearTurns: vi.fn(), clearHighlights: vi.fn(), clearInput: vi.fn() };
  startOver(d);
  for (const f of Object.values(d)) expect(f).toHaveBeenCalledTimes(1);
});

it("the page under the phone sheet cannot scroll, and the lock is CSS so every close path releases it", () => {
  // Checked in headless Chrome at 375 px: without this rule a wheel over the sheet's header moved the page 600 px.
  const css = readFileSync(new URL("./ask.css", import.meta.url), "utf8");
  expect(css).toMatch(/html:has\(\.ask-panel:modal\)\s*\{\s*overflow:\s*hidden;?\s*\}/);
});

// ---- the page never moves uninvited ----
it("a reply never scrolls the page: the only page scroll is the Show control; the chat list scrolls itself", () => {
  const src = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
  const calls = src.match(/scrollIntoView|window\.scrollTo|scrollBy\(/g) ?? [];
  expect(calls).toEqual(["scrollIntoView"]);
  const show = src.slice(src.indexOf("function showExperiments"), src.indexOf("function openExperiment"));
  expect(show).toContain("scrollIntoView");
  expect(src).toMatch(/const LIGHT_ON_ANSWER = false/);
  expect(src).toContain("el.scrollTo("); // the panel's own list, not the page
});
