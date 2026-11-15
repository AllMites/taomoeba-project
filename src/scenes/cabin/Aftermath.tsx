import { useLayoutEffect, useRef } from "react";
import { askAbout } from "../../app/console.ts";
import { usePlayback } from "../playback.ts";
import { aftermathLines, scenarioIds, scenarioQuestion, type Story } from "../spread/story.ts";
import { roomAbove } from "../zone.ts";
import { moreBelow } from "./SpreadPanel.tsx";

/**
 * Stage 5, Aftermath: what the fire and smoke touched, counted from the run, what the response did, what is not
 * known, and that the data has no test of structural damage. "Ask about this" opens Ask SI on the records behind it.
 */
export function AftermathCard({ st, where }: { st: Story; where: string }) {
  const on = usePlayback((s) => s.timeline?.compressed === true && s.t >= st.stages[4].at);
  const ref = useRef<HTMLElement>(null);
  // Stops above the console's top-3 card, like the Saffire chips; the rest scrolls.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const card = document.querySelector<HTMLElement>(".console-overlay");
    const r = (e: Element) => {
      const b = e.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    };
    el.style.maxHeight = "";
    const room = roomAbove(r(el), card ? r(card) : null);
    if (room !== null) el.style.maxHeight = `${room}px`;
    // While more is below, the bottom edge fades (the panel's cue).
    const sync = () => el.toggleAttribute("data-more", moreBelow(el));
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    return () => el.removeEventListener("scroll", sync);
  }, [on, st]);
  if (!on) return null;
  const [counts, detector, did, unknown, structure] = aftermathLines(st);
  const ids = scenarioIds(st);
  return (
    <section ref={ref} className="after-card glass" aria-label="Aftermath" aria-live="polite">
      <div className="after-top">
        <h3 className="after-h">Aftermath</h3>
        {ids.length > 0 && (
          <button type="button" className="spread-btn spread-btn-main" title={scenarioQuestion(st, where)} onClick={() => ids.forEach(askAbout)}>
            Ask about this
          </button>
        )}
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
