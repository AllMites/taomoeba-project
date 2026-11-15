import { useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { DRAG_TYPE } from "../app/console.ts";
import { answerSourceIds, citationText } from "./cite.ts";
import {
  factKind,
  isDataOnly,
  isShortQuotesOnly,
  MAX_QUESTION,
  readable,
  RELATION_LABEL,
  sourceKind,
  type AskResult,
} from "./respond.ts";
import { composerKey, filledSteps, FOLLOW_UPS, isRankingOnly, summaryLine, WORKING_STEPS, writerLine, type StepView, type TurnState } from "./thread.ts";

// These four have saved answers (public/data/saved-answers.json), so a first tap answers at once.
// The panel shows three for the picked habitat (suggestionsFor in thread.ts); the first three here are the fallback.
export const EXAMPLES = [
  "Do bigger droplets go out at a bigger diameter?",
  "Which experiment ranks highest for ISS?",
  "What caused the Apollo 1 fire?",
  "What is a cool flame?",
];
const SHOW_COUNT_FROM = MAX_QUESTION - 50;

/** Example or follow-up chips. aria-disabled, not disabled: a disabled button drops keyboard focus to the page. */
export function Chips({ chips, label, busy, onPick }: { chips: string[]; label: string; busy: boolean; onPick: (q: string) => void }) {
  if (!chips.length) return null;
  return (
    <ul className="ask-examples" aria-label={label}>
      {chips.map((ex) => (
        <li key={ex}>
          <button type="button" className="ask-chip" aria-disabled={busy} onClick={() => !busy && onPick(ex)}>
            {ex}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Steps as a list. Done steps carry a tick and the word "Done", so state never rests on colour. */
export function Steps({ steps, label }: { steps: StepView[]; label: string }) {
  return (
    <ol className="ask-steps" aria-label={label}>
      {steps.map((s) => (
        <li key={s.n} className="ask-step" data-state={s.state}>
          <span className="ask-step-mark t-readout" aria-hidden="true">
            {s.state === "done" ? "✓" : s.n}
          </span>
          <span className="ask-step-body">
            <span className="ask-step-text">
              {s.word && <span className="sr-only">{s.word}: </span>}
              {s.text}
              {s.state === "active" ? "…" : ""}
            </span>
            {s.small && <span className="ask-step-small">{s.small}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export type AboutChip = { id: string; name: string };

/** The composer: a textarea that grows to 4 lines. Enter sends, Shift+Enter is a new line. */
export function Composer(p: {
  value: string;
  busy: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  label: string;
  chips: string[];
  chipsLabel: string;
  habitatLabel?: string;
  /** Experiments the next question is about ("Ask about this", or a card dropped on the panel). */
  about?: AboutChip[];
  onRemoveAbout?: (id: string) => void;
  onChange: (q: string) => void;
  onSend: () => void;
  onPick: (q: string) => void;
}) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const ref = p.inputRef ?? own;
  // Grow with the text, up to the CSS max-height (4 lines); then it scrolls inside.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [p.value, ref]);
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composerKey({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }) === "send") {
      e.preventDefault();
      p.onSend();
    }
  };
  return (
    <div className="ask-composer">
      <Chips chips={p.chips} label={p.chipsLabel} busy={p.busy} onPick={p.onPick} />
      {!!p.about?.length && (
        <ul className="ask-about" aria-label="This question is about">
          {p.about.map((a) => (
            <li key={a.id} className="ask-about-chip">
              <span className="ask-about-name">About: {a.name}</span>
              <button type="button" className="ask-about-x" aria-label={`Remove ${a.name}`} onClick={() => p.onRemoveAbout?.(a.id)}>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="ask-compose-form"
        onSubmit={(e) => {
          e.preventDefault();
          p.onSend();
        }}
      >
        <div className="ask-compose-meta">
          <label htmlFor="ask-compose" className="ask-compose-label">
            {p.label}
          </label>
          {p.habitatLabel && <p className="ask-habitat muted">Answering for: {p.habitatLabel}</p>}
        </div>
        <div className="ask-row">
          <textarea
            id="ask-compose"
            ref={ref}
            rows={1}
            value={p.value}
            maxLength={MAX_QUESTION}
            autoComplete="off"
            enterKeyHint="send"
            aria-describedby="ask-compose-count"
            onChange={(e) => p.onChange(e.target.value)}
            onKeyDown={onKey}
          />
          <button type="submit" className="ask-btn ask-go" aria-disabled={p.busy || !p.value.trim()}>
            Send
          </button>
        </div>
        <p id="ask-compose-count" className="muted ask-count">
          {p.value.length >= SHOW_COUNT_FROM ? `${p.value.length} of ${MAX_QUESTION} characters` : ""}
        </p>
      </form>
    </div>
  );
}

type PanelProps = {
  open: boolean;
  turns: TurnState[];
  busy: boolean;
  draft: string;
  habitatLabel?: string;
  live: string;
  lastResult: AskResult | null;
  /** First questions offered in the empty panel, for the picked habitat. */
  suggestions?: string[];
  about?: AboutChip[];
  titleOf: (id: string) => string;
  panelRef?: RefObject<HTMLElement | null>;
  bodyRef?: RefObject<HTMLDivElement | null>;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
  onDraft: (q: string) => void;
  onSend: () => void;
  onPick: (q: string) => void;
  onClose: () => void;
  onReset: () => void;
  onOpenExperiment: (id: string) => void;
  onShow: (ids: string[]) => void;
  /** Light the answer's sources in the Research map. */
  onGraph?: (ids: string[]) => void;
  onRemoveAbout?: (id: string) => void;
  /** An experiment card was dropped on the panel. */
  onDropAbout?: (id: string) => void;
};

/** True when a drag carries an experiment card (dragProps in src/app/console.ts). */
export const isCardDrag = (types: readonly string[] | undefined) => !!types && Array.from(types).includes(DRAG_TYPE);

/**
 * The chat panel. It fills the box the shell gives it (the right-hand panel; a bottom sheet on a phone) and is
 * always in the page, hidden while closed. The thread is passed in from above it, so closing and reopening keeps
 * the conversation. An experiment card dropped anywhere on it scopes the next question to that experiment.
 */
export function Panel(p: PanelProps) {
  const first = p.turns.length === 0;
  // dragenter and dragleave fire for every child the pointer crosses: count them, so the drop state does not flicker.
  const depth = useRef(0);
  const [dropping, setDropping] = useState(false);
  const drag = (e: DragEvent, step: number) => {
    if (!p.onDropAbout || !isCardDrag(e.dataTransfer.types)) return;
    e.preventDefault(); // marks the panel as a place that takes this drop
    depth.current = Math.max(0, depth.current + step);
    setDropping(depth.current > 0 || step === 0);
  };
  const drop = (e: DragEvent) => {
    if (!p.onDropAbout || !isCardDrag(e.dataTransfer.types)) return;
    e.preventDefault();
    depth.current = 0;
    setDropping(false);
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (id) p.onDropAbout(id);
  };
  return (
    <section
      ref={p.panelRef}
      className="ask-panel glass"
      hidden={!p.open}
      aria-labelledby="ask-panel-h"
      data-drop={dropping ? "true" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") p.onClose();
      }}
      onDragEnter={(e) => drag(e, 1)}
      onDragOver={(e) => drag(e, 0)}
      onDragLeave={(e) => drag(e, -1)}
      onDrop={drop}
    >
      <header className="ask-panel-head">
        <h2 id="ask-panel-h" className="ask-panel-h t-readout">
          Ask SI
        </h2>
        <div className="ask-panel-actions">
          {!first && (
            <button type="button" className="ask-btn" onClick={p.onReset}>
              New chat
            </button>
          )}
          <button type="button" className="ask-btn" onClick={p.onClose}>
            Close
          </button>
        </div>
        <p className="ask-writer muted">{writerLine(p.lastResult)}</p>
      </header>

      <div className="ask-body" ref={p.bodyRef}>
        {first ? (
          <div className="ask-empty">
            <p className="ask-empty-lead">Try a question</p>
            <Chips chips={p.suggestions ?? EXAMPLES.slice(0, 3)} label="Suggested questions" busy={p.busy} onPick={p.onPick} />
          </div>
        ) : (
          <>
            <ol className="ask-thread" aria-label="Conversation">
              {p.turns.map((t) => (
                <TurnView key={t.id} turn={t} titleOf={p.titleOf} onOpen={p.onOpenExperiment} onShow={p.onShow} onGraph={p.onGraph} />
              ))}
            </ol>
            {/* Follow-ups end the thread, under the last answer, so the composer stays short in a narrow panel. */}
            <Chips chips={FOLLOW_UPS} label="Follow-up questions" busy={p.busy} onPick={p.onPick} />
          </>
        )}
      </div>

      <p role="status" className="sr-only">
        {p.live}
      </p>

      <Composer
        value={p.draft}
        busy={p.busy}
        inputRef={p.composerRef}
        label={first ? "Your question" : "Ask a follow-up"}
        chips={[]}
        chipsLabel=""
        habitatLabel={p.habitatLabel}
        about={p.about}
        onRemoveAbout={p.onRemoveAbout}
        onChange={p.onDraft}
        onSend={p.onSend}
        onPick={p.onPick}
      />
      <p className="ask-drop" aria-hidden="true">
        Drop to ask about this
      </p>
    </section>
  );
}

/** One exchange: the person's message on the right, SI's answer on the left with no bubble. */
export function TurnView({
  turn,
  titleOf,
  onOpen,
  onShow,
  onGraph,
}: {
  turn: TurnState;
  titleOf: (id: string) => string;
  onOpen: (id: string) => void;
  onShow: (ids: string[]) => void;
  onGraph?: (ids: string[]) => void;
}) {
  const o = turn.outcome;
  return (
    <li className="ask-turn" data-turn={turn.id} data-state={o ? "done" : "pending"}>
      <p className="ask-q">
        <span className="sr-only">You asked: </span>
        {turn.question}
      </p>
      {!!turn.about?.length && <p className="ask-q-about muted">About: {turn.about.join(", ")}</p>}
      {o === null && <Steps steps={WORKING_STEPS} label="Steps for this question" />}
      {o?.kind === "error" && (
        <p role="alert" className="ask-error">
          {o.message}
        </p>
      )}
      {o?.kind === "nocover" && (
        <div className="ask-reply">
          <p className="ask-error">The records do not cover that one. Try rewording it, or pick a suggestion below.</p>
          <StepsSummary result={o.result} noCover />
        </div>
      )}
      {o?.kind === "answer" && <Answer result={o.result} titleOf={titleOf} onOpen={onOpen} onShow={onShow} onGraph={onGraph} />}
      {o?.kind === "answer" && <CopyCitation text={() => citationText(turn.question, o.result, titleOf)} />}
    </li>
  );
}

/** Copy the answer with its numbered sources, for a researcher's notes. */
export function CopyCitation({ text }: { text: () => string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      setState("done");
    } catch {
      setState("failed");
    }
  }
  return (
    <p className="ask-cite">
      <button type="button" className="ask-btn" onClick={() => void copy()}>
        Copy answer with sources
      </button>
      <span role="status" className="muted">
        {state === "done" ? " Copied." : state === "failed" ? " Copy did not work in this browser." : ""}
      </span>
    </p>
  );
}

/** One compact line built from the real counts; it opens into the full step list. */
export function StepsSummary({ result, noCover = false }: { result: AskResult; noCover?: boolean }) {
  return (
    <details className="ask-howmade">
      <summary>{summaryLine(result, noCover)}</summary>
      <Steps steps={filledSteps(result, noCover)} label="Steps for this answer" />
    </details>
  );
}

export function Answer({
  result,
  titleOf,
  onOpen,
  onShow,
  onGraph,
}: {
  result: AskResult;
  titleOf: (id: string) => string;
  onOpen: (id: string) => void;
  onShow: (ids: string[]) => void;
  onGraph?: (ids: string[]) => void;
}) {
  const n = result.investigationIds.length;
  const usedIds = answerSourceIds(result);
  const facts = result.facts ?? [];
  const dataOnly = isDataOnly(result.answer);
  return (
    <div className="ask-reply">
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
      {result.summary && (
        <div className="ask-summary">
          <p className="ask-text">{result.summary}</p>
          <p className="muted ask-summary-note">SI wrote this answer from the checked sentences below. It is a reading of them, not a test result.</p>
        </div>
      )}
      {/* A ranking answer has no paper part: the server sends an empty answer. */}
      {!isRankingOnly(result) && result.answer.trim() !== "" && (
        <>
          {facts.length > 0 && !dataOnly && <p className="ask-mode">What the papers say</p>}
          {result.summary && facts.length === 0 && <p className="ask-mode">The checked sentences</p>}
          <p className={dataOnly ? "ask-note" : "ask-text"}>{readable(result.answer)}</p>
        </>
      )}
      <StepsSummary result={result} />
      {result.claims.length > 0 && (
        <ul className="ask-sources" aria-label="Sources">
          {result.claims.map((c) => {
            const src = result.sources?.[c.sourceIds[0] ?? ""];
            return (
              <li key={c.id} className="ask-source">
                {result.relations?.[c.id] && <p className={`ask-rel ask-rel-${result.relations[c.id]}`}>{RELATION_LABEL[result.relations[c.id]]}</p>}
                <details>
                  <summary>
                    {sourceKind(c.sourceIds[0] ?? "")}: {src?.title ?? titleOf(c.sourceIds[0] ?? "")}
                    {c.flagged ? " (not double-checked)" : ""}
                  </summary>
                  <p className="ask-claim">{c.text}</p>
                  <p className="ask-excerpt">{c.excerpt}</p>
                  {isShortQuotesOnly(src?.license) && <p className="muted ask-quote-note">Short quote: NASA lists this report as short quotes only.</p>}
                  {src?.url && (
                    <p className="ask-link">
                      <a href={src.url} target="_blank" rel="noreferrer">
                        Read the full source
                      </a>
                    </p>
                  )}
                </details>
                {c.investigationId && (
                  <button type="button" className="ask-btn" onClick={() => onOpen(c.investigationId)}>
                    See experiment
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {n > 0 && (
        <button type="button" className="ask-btn ask-show" onClick={() => onShow(result.investigationIds)}>
          Show the {n} {n === 1 ? "experiment" : "experiments"} this answer used
        </button>
      )}
      {onGraph && usedIds.length > 0 && (
        <button type="button" className="ask-btn ask-show" onClick={() => onGraph(usedIds)}>
          Show its sources in the Research map
        </button>
      )}
    </div>
  );
}
