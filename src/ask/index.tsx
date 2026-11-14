import { useEffect, useRef, useState, type FormEvent } from "react";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import { askRecords, MAX_QUESTION, MODE_LABEL, readable, type AskOutcome, type AskResult } from "./respond.ts";
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
  const habitat = useStore((s) => s.habitat);
  const setHighlightIds = useStore((s) => s.setHighlightIds);
  const setSelected = useStore((s) => s.setSelectedInvestigationId);
  const sources = useDataset("sources");
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function submit(q: string) {
    const text = q.trim();
    if (!text) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setState({ phase: "loading" });
    setHighlightIds([]);
    const outcome = await askRecords(text, habitat, undefined, ctl.signal);
    if (ctl.signal.aborted) return;
    setState({ phase: "done", outcome });
    setHighlightIds(outcome.kind === "answer" ? outcome.result.investigationIds : []);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(question);
  }

  function clear() {
    abort.current?.abort();
    setState({ phase: "idle" });
    setHighlightIds([]);
  }

  const outcome = state.phase === "done" ? state.outcome : null;
  const titleOf = (id: string) => (sources.status === "ready" ? sources.data.find((s) => s.id === id)?.title : undefined) ?? id;

  return (
    <section className="ask" aria-labelledby="ask-h">
      <h2 id="ask-h">Ask the records</h2>
      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor="ask-q">Your question</label>
        <div className="ask-row">
          <input
            id="ask-q"
            type="text"
            value={question}
            maxLength={MAX_QUESTION}
            autoComplete="off"
            aria-describedby="ask-count"
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" className="ask-btn ask-go" disabled={state.phase === "loading" || !question.trim()}>
            Ask
          </button>
        </div>
        <p id="ask-count" className="muted ask-count">
          {question.length >= SHOW_COUNT_FROM ? `${question.length} of ${MAX_QUESTION} characters` : ""}
        </p>
      </form>

      <ul className="ask-examples" aria-label="Example questions">
        {EXAMPLES.map((ex) => (
          <li key={ex}>
            <button
              type="button"
              className="ask-btn ask-chip"
              disabled={state.phase === "loading"}
              onClick={() => {
                setQuestion(ex);
                void submit(ex);
              }}
            >
              {ex}
            </button>
          </li>
        ))}
      </ul>

      <p role="status" className="ask-wait">
        {state.phase === "loading" ? "Looking through the records" : ""}
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
