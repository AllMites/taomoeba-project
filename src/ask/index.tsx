import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import { askForHabitat, MAX_QUESTION, MODE_LABEL, readable, type AskOutcome, type AskResult } from "./respond.ts";
import "./ask.css";

// Chosen against public/data/index.json: the records answer each of these directly.
const EXAMPLES = [
  "Why does smoke detection matter on a spacecraft?",
  "How does oxygen level change burning in microgravity?",
  "What is a cool flame?",
];
const SHOW_COUNT_FROM = MAX_QUESTION - 50;

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; outcome: AskOutcome };

export default function Ask() {
  const setHighlightIds = useStore((s) => s.setHighlightIds);
  const setSelected = useStore((s) => s.setSelectedInvestigationId);
  const sources = useDataset("sources");
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const busy = state.phase === "loading";

  async function submit(q: string) {
    const text = q.trim();
    // One question at a time: a second Enter or click while waiting does nothing.
    if (!text || abort.current) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setState({ phase: "loading" });
    setHighlightIds([]);
    const outcome = await askForHabitat(text, () => useStore.getState().habitat, undefined, ctl.signal);
    if (ctl.signal.aborted) return;
    abort.current = null;
    setState({ phase: "done", outcome });
    setHighlightIds(outcome.kind === "answer" ? outcome.result.investigationIds : []);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(question);
  }

  function clear() {
    abort.current?.abort();
    abort.current = null;
    setState({ phase: "idle" });
    setHighlightIds([]);
    input.current?.focus(); // the Clear button goes away, so focus would otherwise drop to the page
  }

  const outcome = state.phase === "done" ? state.outcome : null;
  const titleOf = (id: string) => (sources.status === "ready" ? sources.data.find((s) => s.id === id)?.title : undefined) ?? id;

  return (
    <section className="ask" aria-labelledby="ask-h">
      <h2 id="ask-h">Ask the records</h2>
      <Controls
        question={question}
        busy={busy}
        inputRef={input}
        onChange={setQuestion}
        onSubmit={onSubmit}
        onPick={(ex) => {
          setQuestion(ex);
          void submit(ex);
        }}
      />

      <p role="status" className="ask-wait">
        {busy ? "Looking through the records" : ""}
      </p>

      {outcome?.kind === "error" && <p role="alert" className="ask-error">{outcome.message}</p>}
      {outcome?.kind === "nocover" && (
        <p role="alert" className="ask-error">
          The records do not cover that one. Try an example question above.
        </p>
      )}
      {outcome?.kind === "answer" && (
        <Answer result={outcome.result} titleOf={titleOf} onOpen={setSelected} />
      )}
      {outcome && (
        <button type="button" className="ask-btn ask-clear" onClick={clear}>
          Clear
        </button>
      )}
    </section>
  );
}

/**
 * The form and example chips. While waiting they are aria-disabled, not disabled: a disabled button
 * drops keyboard focus to the page, and the chip or Ask button the user just pressed would lose it.
 */
export function Controls(p: {
  question: string;
  busy: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (q: string) => void;
  onSubmit: (e: FormEvent) => void;
  onPick: (q: string) => void;
}) {
  return (
    <>
      <form className="ask-form" onSubmit={p.onSubmit}>
        <label htmlFor="ask-q">Your question</label>
        <div className="ask-row">
          <input
            id="ask-q"
            ref={p.inputRef}
            type="text"
            value={p.question}
            maxLength={MAX_QUESTION}
            autoComplete="off"
            aria-describedby="ask-count"
            onChange={(e) => p.onChange(e.target.value)}
          />
          <button type="submit" className="ask-btn ask-go" aria-disabled={p.busy || !p.question.trim()}>
            Ask
          </button>
        </div>
        <p id="ask-count" className="muted ask-count">
          {p.question.length >= SHOW_COUNT_FROM ? `${p.question.length} of ${MAX_QUESTION} characters` : ""}
        </p>
      </form>

      <ul className="ask-examples" aria-label="Example questions">
        {EXAMPLES.map((ex) => (
          <li key={ex}>
            <button type="button" className="ask-btn ask-chip" aria-disabled={p.busy} onClick={() => !p.busy && p.onPick(ex)}>
              {ex}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Answer({ result, titleOf, onOpen }: { result: AskResult; titleOf: (id: string) => string; onOpen: (id: string) => void }) {
  const n = result.investigationIds.length;
  return (
    <div className="ask-answer">
      <p className="ask-mode">{MODE_LABEL[result.mode]}</p>
      <p className="ask-text">{readable(result.answer)}</p>
      {n > 0 && (
        <p className="ask-lit">
          <a href="#ranking-h">
            {n} {n === 1 ? "experiment lights" : "experiments light"} up below
          </a>
        </p>
      )}
      {result.claims.length > 0 && (
        <ul className="ask-sources">
          {result.claims.map((c) => (
            <li key={c.id} className="ask-source">
              <details>
                <summary>Source: {titleOf(c.sourceIds[0] ?? "")}</summary>
                <p className="ask-excerpt">{c.excerpt}</p>
              </details>
              {c.investigationId && (
                <button type="button" className="ask-btn" onClick={() => onOpen(c.investigationId)}>
                  See experiment
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
