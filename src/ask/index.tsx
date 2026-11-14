import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import { Controls, Launcher, Panel } from "./chat.tsx";
import { askForHabitat, readable, type AskResult } from "./respond.ts";
import { historyFrom, launcherHidden, startOver, type TurnState } from "./thread.ts";
import "./ask.css";

export { Answer, Composer, Controls, Launcher, Panel, Steps, TurnView } from "./chat.tsx";

/**
 * Cited experiments light up in the ranked list only when the person presses "Show the N experiments".
 * The ranking lane scrolls to the first lit card the moment ids arrive in the store, so lighting them on
 * every answer would move the page without a press.
 */
const LIGHT_ON_ANSWER = false;

const WIDE = "(min-width: 600px)";
const calmMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);

export default function Ask() {
  const setHighlightIds = useStore((s) => s.setHighlightIds);
  const setSelected = useStore((s) => s.setSelectedInvestigationId);
  const drawerOpen = useStore((s) => s.selectedInvestigationId !== null);
  const habitatId = useStore((s) => s.habitat);
  const sources = useDataset("sources");
  const habitats = useDataset("habitats");
  const wide = useWide();

  const [open, setOpen] = useState(false);
  const [pageQuestion, setPageQuestion] = useState(""); // the small form in the page
  const [draft, setDraft] = useState(""); // the composer in the panel
  const [turns, setTurns] = useState<TurnState[]>([]);
  const turnsRef = useRef<TurnState[]>([]);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const pageInput = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => () => abort.current?.abort(), []);

  const update = (next: TurnState[]) => {
    turnsRef.current = next;
    setTurns(next);
  };
  const busy = turns.some((t) => t.outcome === null);

  // Open and close the dialog: non-modal beside the page on wide screens, a modal sheet on narrow ones.
  useEffect(() => {
    const d = dialog.current;
    if (!d || !open) return;
    if (!d.open) {
      if (wide) d.show();
      else d.showModal();
    }
    composer.current?.focus({ preventScroll: true });
    return () => {
      if (d.open) d.close();
    };
  }, [open, wide]);

  // Focus goes back to whatever opened the panel.
  useEffect(() => {
    if (wasOpen.current && !open) {
      const el = opener.current && opener.current.isConnected ? opener.current : launcher.current;
      el?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  // New messages scroll the panel's own list (never the page): to the top of the newest exchange.
  const newest = turns[turns.length - 1];
  const newestKey = newest ? `${newest.id}:${newest.outcome ? "done" : "wait"}` : "";
  useEffect(() => {
    const el = body.current;
    const li = newest && el?.querySelector<HTMLElement>(`[data-turn="${newest.id}"]`);
    if (!el || !li) return;
    el.scrollTo({ top: Math.max(0, li.offsetTop - el.offsetTop), behavior: calmMotion() ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestKey]);

  function openPanel() {
    opener.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
  }

  async function submit(q: string) {
    const text = q.trim();
    // One question at a time: a second Enter or click while waiting does nothing.
    if (!text || abort.current) return;
    const ctl = new AbortController();
    abort.current = ctl;
    const id = nextId.current++;
    const history = historyFrom(turnsRef.current);
    update([...turnsRef.current, { id, question: text, outcome: null }]);
    if (LIGHT_ON_ANSWER) setHighlightIds([]);
    const outcome = await askForHabitat(text, () => useStore.getState().habitat, undefined, ctl.signal, history);
    if (ctl.signal.aborted) return;
    abort.current = null;
    update(turnsRef.current.map((t) => (t.id === id ? { ...t, outcome } : t)));
    if (outcome.kind === "error") setDraft((cur) => cur || text); // keep their words so they can send again
    if (LIGHT_ON_ANSWER && outcome.kind === "answer") setHighlightIds(outcome.result.investigationIds);
  }

  /** From the page form or a chip there: open the panel with the question already sent. */
  function sendFromPage(q: string) {
    if (!q.trim() || abort.current) return;
    openPanel();
    setPageQuestion("");
    void submit(q);
  }
  function sendFromPanel(q: string) {
    if (!q.trim() || abort.current) return;
    setDraft("");
    void submit(q);
  }

  function onPageSubmit(e: FormEvent) {
    e.preventDefault();
    sendFromPage(pageQuestion);
  }

  function reset() {
    startOver({
      abort: () => {
        abort.current?.abort();
        abort.current = null;
      },
      clearTurns: () => update([]),
      clearHighlights: () => setHighlightIds([]),
      clearInput: () => setDraft(""),
    });
    composer.current?.focus({ preventScroll: true }); // the New chat button goes away, so focus would otherwise drop
  }

  /** The one control that moves the page: light the cited experiments and scroll to the ranked list. */
  function showExperiments(ids: string[]) {
    if (!wide) setOpen(false); // a sheet would cover what the person asked to see
    const same = ids.join("|") === useStore.getState().highlightIds.join("|");
    setHighlightIds(ids);
    // New ids: the ranking lane scrolls to the first lit card itself. Same ids: nothing would fire, so go there now.
    if (same) (document.querySelector<HTMLElement>('[data-lit="true"]') ?? document.getElementById("ranking-h"))?.scrollIntoView({ block: "center", behavior: calmMotion() ? "auto" : "smooth" });
  }
  function openExperiment(id: string) {
    if (!wide) setOpen(false); // the drawer would open behind the sheet
    setSelected(id);
  }

  const titleOf = (id: string) => (sources.status === "ready" ? sources.data.find((s) => s.id === id)?.title : undefined) ?? id;
  const habitatLabel = habitats.status === "ready" ? habitats.data.find((h) => h.id === habitatId)?.label : undefined;
  const last = newest?.outcome;
  const lastResult: AskResult | null =
    [...turns].reverse().map((t) => (t.outcome && t.outcome.kind !== "error" ? t.outcome.result : null)).find(Boolean) ?? null;
  const live =
    last === null
      ? "Searching the records"
      : last?.kind === "answer"
        ? `Answer ready. ${readable(last.result.answer) || last.result.facts?.[0]?.statement || ""}`
        : last?.kind === "nocover"
          ? "The records do not cover that one."
          : "";

  return (
    <section className="ask" aria-labelledby="ask-h">
      <div className="sec-label">
        <p className="sec-word t-readout">SI-powered</p>
        <h2 id="ask-h" className="sec-h">
          Ask the records
        </h2>
      </div>
      <p className="ask-intro">Chat with SI about NASA&apos;s fire experiments. Every answer shows its sources.</p>
      <Controls question={pageQuestion} busy={busy} inputRef={pageInput} onChange={setPageQuestion} onSubmit={onPageSubmit} onPick={sendFromPage} />

      <Launcher hidden={launcherHidden(open, drawerOpen)} onOpen={openPanel} buttonRef={launcher} />
      <Panel
        open={open}
        wide={wide}
        turns={turns}
        busy={busy}
        draft={draft}
        habitatLabel={habitatLabel}
        live={live}
        lastResult={lastResult}
        titleOf={titleOf}
        dialogRef={dialog}
        bodyRef={body}
        composerRef={composer}
        onDraft={setDraft}
        onSend={() => sendFromPanel(draft)}
        onPick={sendFromPanel}
        onClose={() => setOpen(false)}
        onReset={reset}
        onOpenExperiment={openExperiment}
        onShow={showExperiments}
      />
    </section>
  );
}
