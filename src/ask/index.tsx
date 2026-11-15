import { useEffect, useRef, useState } from "react";
import { askAbout, useConsole } from "../app/console.ts";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import { Panel } from "./chat.tsx";
import { askForHabitat, MAX_ABOUT, readable, type AskResult } from "./respond.ts";
import { centredScrollTop, focusBackTo, historyFrom, startOver, suggestionsFor, type TurnState } from "./thread.ts";
import "./ask.css";

export { Answer, Composer, Panel, Steps, TurnView } from "./chat.tsx";

/**
 * Cited experiments light up in the ranked list only when the person presses "Show the N experiments".
 * The ranking lane scrolls to the first lit card the moment ids arrive in the store, so lighting them on
 * every answer would move the page without a press.
 */
const LIGHT_ON_ANSWER = false;

/** On a phone the shell shows this panel as a bottom sheet, which would cover the Rank sheet and the detail drawer. */
const NARROW = "(max-width: 760px)";
const narrow = () => typeof window !== "undefined" && !!window.matchMedia?.(NARROW).matches;
const calmMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Ask SI. It fills its parent box (the shell's right-hand panel) and stays mounted while closed, so the
 * conversation survives a close and a question sent from another section still arrives.
 * Open state and the experiments a question is about live in the console store (src/app/console.ts).
 */
export default function Ask() {
  const setHighlightIds = useStore((s) => s.setHighlightIds);
  const setSelected = useStore((s) => s.setSelectedInvestigationId);
  const habitatId = useStore((s) => s.habitat);
  const open = useConsole((s) => s.askOpen);
  const aboutIds = useConsole((s) => s.askAbout);
  const sources = useDataset("sources");
  const habitats = useDataset("habitats");
  const investigations = useDataset("investigations");

  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<TurnState[]>([]);
  const turnsRef = useRef<TurnState[]>([]);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const panel = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(open);
  useEffect(() => () => abort.current?.abort(), []);

  const update = (next: TurnState[]) => {
    turnsRef.current = next;
    setTurns(next);
  };
  const busy = turns.some((t) => t.outcome === null);
  const close = () => useConsole.getState().setAskOpen(false);
  const nameOf = (id: string) => (investigations.status === "ready" ? investigations.data.find((i) => i.id === id)?.title : undefined) ?? id;

  // Opening moves focus to the composer; closing gives it back to whatever opened the panel.
  // A panel that is already open when the page loads takes no focus.
  useEffect(() => {
    if (open && !wasOpen.current) {
      opener.current = (document.activeElement as HTMLElement | null) ?? null;
      composer.current?.focus({ preventScroll: true });
    }
    if (!open && wasOpen.current) {
      const lost = document.activeElement === document.body || !!panel.current?.contains(document.activeElement);
      const back = lost && focusBackTo(opener.current, [document.querySelector<HTMLElement>(".ask-pill"), document.getElementById("main")]);
      if (back) back.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  // The server takes at most MAX_ABOUT experiments: the oldest chip leaves when one more arrives.
  // A new chip also puts the cursor in the composer, ready for the question.
  const aboutCount = useRef(aboutIds.length);
  useEffect(() => {
    if (aboutIds.length > MAX_ABOUT) useConsole.getState().removeAskAbout(aboutIds[0]);
    else if (aboutIds.length > aboutCount.current && open) composer.current?.focus({ preventScroll: true });
    aboutCount.current = aboutIds.length;
  }, [aboutIds, open]);

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

  async function submit(q: string) {
    const text = q.trim();
    // One question at a time: a second Enter or click while waiting does nothing.
    if (!text || abort.current) return;
    const ctl = new AbortController();
    abort.current = ctl;
    const id = nextId.current++;
    const history = historyFrom(turnsRef.current);
    // The chips stay after sending, so a follow-up keeps the same scope until the person removes them.
    const about = useConsole.getState().askAbout.slice(-MAX_ABOUT);
    update([...turnsRef.current, { id, question: text, outcome: null, about: about.map(nameOf) }]);
    if (LIGHT_ON_ANSWER) setHighlightIds([]);
    const outcome = await askForHabitat(text, () => useStore.getState().habitat, undefined, ctl.signal, history, about);
    if (ctl.signal.aborted) return;
    abort.current = null;
    update(turnsRef.current.map((t) => (t.id === id ? { ...t, outcome } : t)));
    if (outcome.kind === "error") setDraft((cur) => cur || text); // keep their words so they can send again
    if (LIGHT_ON_ANSWER && outcome.kind === "answer") setHighlightIds(outcome.result.investigationIds);
  }

  function send(q: string) {
    if (!q.trim() || abort.current) return;
    setDraft("");
    void submit(q);
  }

  // Another section (the what-if tool) asked a question for the person: open the panel and send it.
  const askRequest = useStore((s) => s.askRequest);
  useEffect(() => {
    if (!askRequest) return;
    useStore.getState().clearAskRequest?.();
    useConsole.getState().setAskOpen(true);
    void submit(askRequest.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askRequest]);

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
    useConsole.getState().clearAskAbout();
    composer.current?.focus({ preventScroll: true }); // the New chat button goes away, so focus would otherwise drop
  }

  /** Light the cited experiments and open the ranked list, where the lit cards are. */
  function showExperiments(ids: string[]) {
    if (narrow()) close(); // a bottom sheet would cover what the person asked to see
    const same = ids.join("|") === useStore.getState().highlightIds.join("|");
    setHighlightIds(ids);
    useConsole.getState().setView("rank");
    // New ids: the ranking lane scrolls to the first lit card itself. Same ids: nothing would fire, so go there once the list is up.
    if (same) requestAnimationFrame(() => revealInList(document.querySelector<HTMLElement>('[data-lit="true"]') ?? document.getElementById("ranking-h")));
  }
  /** Scroll only the list that holds the card (the Rank sheet), never the console around it. */
  function revealInList(el: HTMLElement | null) {
    let list = el?.parentElement ?? null;
    while (list && !/auto|scroll/.test(getComputedStyle(list).overflowY)) list = list.parentElement;
    if (!el || !list) return;
    const l = list.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const top = centredScrollTop({ scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, top: l.top }, { top: b.top, height: b.height });
    list.scrollTo({ top, behavior: calmMotion() ? "auto" : "smooth" });
  }
  /** Light the answer's sources in the Research map and open it; the map frames the lit dots itself. */
  function showInGraph(ids: string[]) {
    if (narrow()) close(); // a bottom sheet would cover the map
    useStore.getState().setGraphFocus?.(ids);
    useConsole.getState().setView("graph");
  }
  function openExperiment(id: string) {
    if (narrow()) close(); // the drawer would open behind the sheet
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
    <Panel
      open={open}
      turns={turns}
      busy={busy}
      draft={draft}
      habitatLabel={habitatLabel}
      live={live}
      lastResult={lastResult}
      suggestions={suggestionsFor(habitatId)}
      about={aboutIds.map((id) => ({ id, name: nameOf(id) }))}
      titleOf={titleOf}
      panelRef={panel}
      bodyRef={body}
      composerRef={composer}
      onDraft={setDraft}
      onSend={() => send(draft)}
      onPick={send}
      onClose={close}
      onReset={reset}
      onOpenExperiment={openExperiment}
      onShow={showExperiments}
      onGraph={showInGraph}
      onRemoveAbout={(id) => useConsole.getState().removeAskAbout(id)}
      onDropAbout={askAbout}
    />
  );
}
