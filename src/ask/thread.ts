import { MAX_ANSWER, MAX_HISTORY, MAX_QUESTION, modeLabel, readable, type AskOutcome, type AskResult, type HistoryTurn } from "./respond.ts";

/** One question in the conversation: waiting for its reply, or answered (or failed). */
export type TurnState = { id: number; question: string; outcome: AskOutcome | null };

/** Follow-ups that make sense after any answer. */
export const FOLLOW_UPS = ["What does that mean for my habitat?", "Which experiment showed this?"];

/** The paper part of an answer is empty when the data finding alone answers (a ranking). */
export const isRankingOnly = (r: AskResult) => r.answer.trim() === "" && (r.facts?.length ?? 0) > 0;

/**
 * What the server gets as earlier turns: the last 4 questions that were answered, each with its answer as plain
 * reading text (data findings first, source ids removed). Failed and unanswered questions add nothing.
 */
export function historyFrom(turns: TurnState[]): HistoryTurn[] {
  return turns
    .flatMap((t): HistoryTurn[] => {
      const o = t.outcome;
      if (o?.kind !== "answer") return [];
      const text = [...(o.result.facts ?? []).map((f) => f.statement), readable(o.result.answer)].filter(Boolean).join(" ");
      return [{ question: t.question.slice(0, MAX_QUESTION), answer: text.slice(0, MAX_ANSWER) }];
    })
    .slice(-MAX_HISTORY);
}

export type StepState = "idle" | "active" | "done";
export type StepView = {
  n: 1 | 2 | 3 | 4;
  state: StepState;
  text: string;
  /** Small second line: the model's name, the dropped-sentence note, and so on. */
  small?: string;
  /** Plain word for the state, so it is never carried by colour alone. */
  word: string;
};

/** Before any question: how an answer is made, in plain words. These describe the live writer; each answer then shows what really ran. */
export const IDLE_STEPS: StepView[] = [
  { n: 1, state: "idle", word: "", text: "Search", small: "SI looks through the NASA fire experiment records and the team's data tables." },
  { n: 2, state: "idle", word: "", text: "Pick", small: "The passages that answer your question most directly are kept." },
  { n: 3, state: "idle", word: "", text: "Write", small: "When the SI writer is on, it writes short sentences. Each one copies a line from a source." },
  { n: 4, state: "idle", word: "", text: "Check", small: "Code checks each sentence against its line. A second SI read compares them. Failures are dropped." },
];

/** A question is on its way: only step 1 is really running, and nothing about the later steps is claimed yet. */
export const WORKING_STEPS: StepView[] = [
  { n: 1, state: "active", word: "Working", text: "Searching the records" },
  { n: 2, state: "idle", word: "Waiting", text: "Then the answer is written" },
  { n: 3, state: "idle", word: "Waiting", text: "Then each sentence is checked" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "claude-haiku-5-5" -> "Claude Haiku, by Anthropic". Any other id is shown as it is. */
export function modelLabel(id: string): string {
  const m = /^claude-([a-z]+)/.exec(id);
  return m ? `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)}, by Anthropic` : id;
}

const done = (n: StepView["n"], text: string, small?: string): StepView => ({ n, state: "done", word: "Done", text, small: small || undefined });

/** The steps filled with what the server really counted for this answer. */
export function filledSteps(result: AskResult, noCover = false): StepView[] {
  const { searched, matched, facts, reranked, kept, dropped, checked } = result.steps;
  // A sample answer: nothing was searched, written or checked, so no step claims it was.
  if (result.mode === "mock")
    return [done(1, "No search ran, this is a sample record"), done(2, "Sample text, no SI writer ran"), done(3, "Not checked, this is a sample")];
  // A saved answer: written and checked earlier by the same pipeline, replayed now with no new call.
  if (result.mode === "saved")
    return [done(1, "No new search: this question has a saved answer"), done(2, modeLabel(result)), done(3, `${plural(result.claims.length, "sentence")} kept when it was made, each with its source`)];
  // A ranking question: the answer is the dashboard's own ranking, computed by code.
  if (isRankingOnly(result))
    return [done(1, `${plural(facts, "finding")} computed from the team's tables`), done(2, "No paper search, no SI writer: the ranking is the answer"), done(3, "The numbers come from code, not from SI")];

  const live = result.mode === "live";
  const one = done(
    1,
    `Searched ${plural(searched, "source")}, ${matched === 0 ? "none matched" : live ? `${matched} ${matched === 1 ? "was" : "were"} used` : `${matched} matched`}`,
    [facts > 0 ? `${plural(facts, "finding")} computed from the team's tables` : "", live && matched > 0 ? (reranked > 0 ? "SI put the best passages first" : "Passages kept in keyword order") : ""].filter(Boolean).join(" · "),
  );
  let two: StepView;
  if (live) {
    if (kept > 0) two = done(2, `Written by SI from ${plural(matched, "source")}`, result.model ? modelLabel(result.model) : undefined);
    else if (matched === 0) two = done(2, "Nothing to write from");
    else two = done(2, dropped > 0 ? "SI wrote sentences, but none passed the checks" : "SI found nothing in them to cite");
  } else if (noCover) two = done(2, "Nothing to quote");
  else if (result.degraded) two = done(2, dropped > 0 ? `SI wrote ${plural(dropped, "sentence")}, but none passed the checks, so this is quoted word for word` : "The SI writer did not answer, so this is quoted word for word");
  else two = done(2, "Quoted word for word, the SI writer is off");
  let three: StepView;
  if (noCover || kept === 0) three = done(3, "No sentence to check", dropped > 0 ? `${dropped} dropped: failed a check` : undefined);
  else if (!live) three = done(3, `${plural(kept, "sentence")} copied word for word from the records`);
  else
    three = done(
      3,
      `${plural(kept, "sentence")} kept, each quoting its source`,
      [checked > 0 ? `${checked} confirmed by a second SI read` : "", kept - checked > 0 ? `${kept - checked} not double-checked` : "", dropped > 0 ? `${dropped} dropped: failed a check` : ""].filter(Boolean).join(" · "),
    );
  return [one, two, three];
}

/** One compact line under an answer, built from the same counts as the steps. */
export function summaryLine(result: AskResult, noCover = false): string {
  const { searched, matched, kept, dropped } = result.steps;
  if (result.mode === "mock") return "Sample answer · nothing searched or checked";
  if (result.mode === "saved") return `${modeLabel(result)} · no new search`;
  if (isRankingOnly(result)) return "Computed from the team's tables · no paper search";
  if (noCover) return searched > 0 ? `Searched ${plural(searched, "source")} · nothing matched` : "Nothing matched";
  if (result.mode === "extractive") {
    if (result.degraded) return dropped > 0 ? "SI's sentences failed the checks · quoted word for word" : "SI writer did not answer · quoted word for word";
    return `Searched ${plural(searched, "source")} · ${matched} matched · quoted word for word`;
  }
  const tail = kept > 0 ? `${plural(kept, "sentence")} checked` : "no sentence kept";
  return [`Searched ${plural(searched, "source")}`, `${matched} used`, tail, dropped > 0 ? `${dropped} dropped` : ""].filter(Boolean).join(" · ");
}

/** The honest line under the panel title, from the last reply: who writes, and from what. */
export function writerLine(last: AskResult | null): string {
  const from = "answers only from the sources shown";
  if (!last) return `Every answer shows its sources · ${from}`;
  if (last.mode === "mock") return `Sample answers, the live service is off · ${from}`;
  // A fallback whose sentences the checks refused: the writer did answer, so the line must not say it did not.
  if (last.degraded) return last.steps.dropped > 0 ? `SI's sentences failed the checks, so this is quoting · ${from}` : `The SI writer did not answer, so this is quoting · ${from}`;
  if (last.mode === "saved") return `${modeLabel(last)} · ${from}`;
  if (last.mode === "extractive") return `Quoting mode, the SI writer is off · ${from}`;
  return last.model ? `${modelLabel(last.model)} · ${from}` : `Every answer shows its sources · ${from}`;
}

/** Start over: stop what is running, forget the thread, and unlight the experiments. */
export function startOver(d: { abort: () => void; clearTurns: () => void; clearHighlights: () => void; clearInput: () => void }) {
  d.abort();
  d.clearTurns();
  d.clearHighlights();
  d.clearInput();
}

/** What a key press in the composer does: Enter sends, Shift+Enter is a new line, and Enter while composing text (IME) is left alone. */
export function composerKey(e: { key: string; shiftKey: boolean; isComposing?: boolean }): "send" | "newline" {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing ? "send" : "newline";
}

/** The launcher is hidden while the panel is open (it has its own close) and while the detail drawer is open. */
export const launcherHidden = (panelOpen: boolean, drawerOpen: boolean) => panelOpen || drawerOpen;
