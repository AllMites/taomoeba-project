import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";
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
import { composerKey, filledSteps, FOLLOW_UPS, IDLE_STEPS, isRankingOnly, summaryLine, WORKING_STEPS, writerLine, type StepView, type TurnState } from "./thread.ts";

export const EXAMPLES = [
  "Which experiments tested 30% oxygen?",
  "What happened to silicone in microgravity?",
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

/** The small in-page form: one line, an Ask button, and the example chips. Sending opens the panel. */
export function Controls(p: {
  question: string;
  busy: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (q: string) => void;
  onSubmit: (e: React.FormEvent) => void;
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
            enterKeyHint="send"
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
      <Chips chips={EXAMPLES} label="Example questions" busy={p.busy} onPick={p.onPick} />
    </>
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

/** The composer: a textarea that grows to 4 lines. Enter sends, Shift+Enter is a new line. */
export function Composer(p: {
  value: string;
  busy: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  label: string;
  chips: string[];
  chipsLabel: string;
  habitatLabel?: string;
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
          <button type="submit" className="pill ask-go" aria-disabled={p.busy || !p.value.trim()}>
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

/** The button that opens the panel: text plus a small mark, fixed bottom right. */
export function Launcher({ hidden, onOpen, buttonRef }: { hidden: boolean; onOpen: () => void; buttonRef?: RefObject<HTMLButtonElement | null> }) {
  return (
    <button type="button" ref={buttonRef} className="ask-launch" hidden={hidden} onClick={onOpen}>
      <span className="ask-mark" aria-hidden="true" />
      Ask SI
    </button>
  );
}

type PanelProps = {
  open: boolean;
  wide: boolean;
  turns: TurnState[];
  busy: boolean;
  draft: string;
  habitatLabel?: string;
  live: string;
  lastResult: AskResult | null;
  titleOf: (id: string) => string;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  bodyRef?: RefObject<HTMLDivElement | null>;
  composerRef?: RefObject<HTMLTextAreaElement | null>;
  onDraft: (q: string) => void;
  onSend: () => void;
  onPick: (q: string) => void;
  onClose: () => void;
  onReset: () => void;
  onOpenExperiment: (id: string) => void;
  onShow: (ids: string[]) => void;
};

/**
 * The chat panel. It is always in the page (hidden while closed), and the thread is passed in from above it,
 * so closing and reopening keeps the conversation. Wide screens get a side panel that leaves the page usable;
 * narrow ones get a full-height sheet (the caller opens it with showModal).
 */
export function Panel(p: PanelProps) {
  const first = p.turns.length === 0;
  // The dialog opens non-modal on wide screens (the caller calls show()), so Escape needs a handler of its own.
  useEffect(() => {
    const d = p.dialogRef?.current;
    if (!d) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && d.open) p.onClose();
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  });
  return (
    <dialog
      ref={p.dialogRef}
      className="ask-panel"
      data-wide={p.wide ? "true" : "false"}
      aria-labelledby="ask-panel-h"
      onCancel={(e) => {
        e.preventDefault(); // keep our own state in step with the dialog
        p.onClose();
      }}
    >
      <header className="ask-panel-head">
        <h2 id="ask-panel-h" className="ask-panel-h">
          Ask the records
        </h2>
        <div className="ask-panel-actions">
          {!first && (
            <button type="button" className="quiet" onClick={p.onReset}>
              New chat
            </button>
          )}
          <button type="button" className="quiet" onClick={p.onClose}>
            Close
          </button>
        </div>
        <p className="ask-writer muted">{writerLine(p.lastResult)}</p>
      </header>

      <div className="ask-body" ref={p.bodyRef}>
        {first ? (
          <div className="ask-empty">
            <p className="ask-empty-lead">How an answer is made</p>
            <Steps steps={IDLE_STEPS} label="How an answer is made" />
            <Chips chips={EXAMPLES} label="Example questions" busy={p.busy} onPick={p.onPick} />
          </div>
        ) : (
          <ol className="ask-thread" aria-label="Conversation">
            {p.turns.map((t) => (
              <TurnView key={t.id} turn={t} titleOf={p.titleOf} onOpen={p.onOpenExperiment} onShow={p.onShow} />
            ))}
          </ol>
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
        chips={first ? [] : FOLLOW_UPS}
        chipsLabel="Follow-up questions"
        habitatLabel={p.habitatLabel}
        onChange={p.onDraft}
        onSend={p.onSend}
        onPick={p.onPick}
      />
    </dialog>
  );
}

/** One exchange: the person's message on the right, SI's answer on the left with no bubble. */
export function TurnView({
  turn,
  titleOf,
  onOpen,
  onShow,
}: {
  turn: TurnState;
  titleOf: (id: string) => string;
  onOpen: (id: string) => void;
  onShow: (ids: string[]) => void;
}) {
  const o = turn.outcome;
  return (
    <li className="ask-turn" data-turn={turn.id} data-state={o ? "done" : "pending"}>
      <p className="ask-q">
        <span className="sr-only">You asked: </span>
        {turn.question}
      </p>
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
      {o?.kind === "answer" && <Answer result={o.result} titleOf={titleOf} onOpen={onOpen} onShow={onShow} />}
    </li>
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
}: {
  result: AskResult;
  titleOf: (id: string) => string;
  onOpen: (id: string) => void;
  onShow: (ids: string[]) => void;
}) {
  const n = result.investigationIds.length;
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
      {/* A ranking answer has no paper part: the server sends an empty answer. */}
      {!isRankingOnly(result) && result.answer.trim() !== "" && (
        <>
          {facts.length > 0 && !dataOnly && <p className="ask-mode">What the papers say</p>}
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
                  <button type="button" className="quiet" onClick={() => onOpen(c.investigationId)}>
                    See experiment
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {n > 0 && (
        <button type="button" className="quiet ask-show" onClick={() => onShow(result.investigationIds)}>
          Show the {n} {n === 1 ? "experiment" : "experiments"} this answer used
        </button>
      )}
    </div>
  );
}
