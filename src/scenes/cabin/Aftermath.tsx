import { useLayoutEffect, useRef } from "react";
import { askAbout } from "../../app/console.ts";
import { useStore } from "../../app/store.ts";
import { usePlayback } from "../playback.ts";
import { aftermathLines, scenarioIds, scenarioQuestion, type Story } from "../spread/story.ts";
import { roomAbove } from "../zone.ts";
import { moreBelow } from "./SpreadPanel.tsx";

/** "Ask about this": the experiment chips behind the records, then the scenario as the question Ask SI sends. */
export function askScenario(ids: string[], question: string) {
  ids.forEach(askAbout);
  useStore.getState().requestAsk?.(question);
}

/**
 * Stage 5, Aftermath: what the fire and smoke touched, counted from the run, what the response did, what is not
 * known, and that the data has no test of structural damage. "Ask about this" opens Ask SI on the records behind it.
 */
export function AftermathCard({ st, where, inline }: { st: Story; where: string; inline?: boolean }) {
  const on = usePlayback((s) => s.timeline?.compressed === true && s.t >= st.stages[4].at);
  const ref = useRef<HTMLElement>(null);
  // Stops above the console's top-3 card, like the Saffire chips; the rest scrolls.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || inline) return;
    const card = document.querySelector<HTMLElement>(".console-overlay");
    const r = (e: Element) => {
      const b = e.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    };
    // While more is below, the bottom edge fades (the panel's cue).
    const sync = () => el.toggleAttribute("data-more", moreBelow(el));
    const fit = () => {
      el.style.maxHeight = "";
      const room = roomAbove(r(el), card ? r(card) : null);
      if (room !== null) el.style.maxHeight = `${room}px`;
      sync();
    };
    fit();
    el.addEventListener("scroll", sync, { passive: true });
    // Re-fitted when the stage or the card resizes (a side panel opening narrows the center).
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    if (el.parentElement) ro?.observe(el.parentElement);
    if (card) ro?.observe(card);
    return () => {
      el.removeEventListener("scroll", sync);
      ro?.disconnect();
    };
  }, [on, st, inline]);
  if (!on) return null;
  const [counts, detector, did, unknown, structure] = aftermathLines(st);
  const ids = scenarioIds(st);
  return (
    <section ref={ref} className={inline ? "after-card after-inline" : "after-card glass"} aria-label="Aftermath" aria-live="polite">
      <div className="after-top">
        <h3 className="after-h">Aftermath</h3>
        <button type="button" className="spread-btn spread-btn-main" title={scenarioQuestion(st, where)} onClick={() => askScenario(ids, scenarioQuestion(st, where))}>
          Ask about this
        </button>
      </div>
      <p className="after-big">{counts}</p>
      <p className="spread-text">{detector}</p>
      <p className="spread-text">
        <b>{did}</b>
      </p>
      <p className="spread-text">{unknown}</p>
      <p className="spread-text spread-src">{structure}</p>
    </section>
  );
}
