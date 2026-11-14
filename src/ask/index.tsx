import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import {
  askForHabitat,
  factKind,
  isDataOnly,
  isShortQuotesOnly,
  MAX_QUESTION,
  MODE_LABEL,
  readable,
  RELATION_LABEL,
  sourceKind,
  type AskOutcome,
  type AskResult,
} from "./respond.ts";
import "./ask.css";

// Chosen against public/data/index.json: the records answer each of these directly.
const EXAMPLES = [
  "Which experiments tested 30% oxygen?",
  "What happened to silicone in microgravity?",
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
      <div className="sec-label">
        <p className="sec-word t-readout">SI-powered</p>
        <h2 id="ask-h" className="sec-h">
          Ask the records
        </h2>
      </div>
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
        <button type="button" className="quiet ask-clear" onClick={clear}>
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
          <button type="submit" className="pill ask-go" aria-disabled={p.busy || !p.question.trim()}>
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
            <button type="button" className="ask-chip" aria-disabled={p.busy} onClick={() => !p.busy && p.onPick(ex)}>
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
  const facts = result.facts ?? [];
  const dataOnly = isDataOnly(result.answer);
  return (
    <div className="ask-answer">
      {facts.length > 0 && (
        <div className="ask-facts">
          <p className="ask-mode">What the data shows (computed from the tables, not written by SI)</p>
          <ul>
            {facts.map((f) => (
              <li key={f.id} className="ask-fact">
                <p className="ask-fact-text">{f.statement}</p>
                <p className="muted ask-fact-src">
                  {factKind(f)}: {f.dataset}
                  {f.caveat ? ` · ${f.caveat}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* A ranking answer has no paper part: the server sends an empty answer. */}
      {result.answer.trim() !== "" && (
        <>
          {facts.length > 0 && <p className="ask-mode">{dataOnly ? "What the papers say" : `What the papers say · ${MODE_LABEL[result.mode]}`}</p>}
          {facts.length === 0 && <p className="ask-mode">{MODE_LABEL[result.mode]}</p>}
          <p className={dataOnly ? "ask-note" : "ask-text t-statement"}>{readable(result.answer)}</p>
        </>
      )}
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
              {result.relations?.[c.id] && <p className={`ask-rel ask-rel-${result.relations[c.id]}`}>{RELATION_LABEL[result.relations[c.id]]}</p>}
              <details>
                <summary>
                  {sourceKind(c.sourceIds[0] ?? "")}: {result.sources?.[c.sourceIds[0] ?? ""]?.title ?? titleOf(c.sourceIds[0] ?? "")}
                  {c.flagged ? " (not double-checked)" : ""}
                </summary>
                <p className="ask-claim">{c.text}</p>
                <p className="ask-excerpt">{c.excerpt}</p>
                {isShortQuotesOnly(result.sources?.[c.sourceIds[0] ?? ""]?.license) && (
                  <p className="muted ask-quote-note">Short quote: NASA lists this report as short quotes only.</p>
                )}
                {result.sources?.[c.sourceIds[0] ?? ""]?.url && (
                  <p className="ask-link">
                    <a href={result.sources[c.sourceIds[0] ?? ""].url} target="_blank" rel="noreferrer">
                      Read the full source
                    </a>
                  </p>
                )}
              </details>
              {c.investigationId && (
                <button type="button" className="quiet" onClick={() => onOpen(c.investigationId)}>
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
