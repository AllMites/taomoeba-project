// The HUD over the replay: the brief line (bottom-left) and the top 3 or On Earth (bottom-right). When the center is
// narrower than 60rem (a container query in app.css) both collapse into one 48px bar; its buttons open one card at a
// time as an overlay above the bar.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { BaseId } from "../app/console.ts";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import { closesOnKey, closesOnPress, toggleCard, type HudCard } from "./hud.ts";
import { BriefLine } from "./index.tsx";
import { scoreText, topThree } from "./logic.ts";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** `overlay` is the card for the bottom-right slot: the top 3, or On Earth on the Earth base. */
export default function Hud({ base, overlay }: { base: BaseId; overlay: ReactNode }) {
  const [open, setOpen] = useState<HudCard | null>(null);
  const habitatId = useStore((s) => s.habitat);
  const rank = useDataset("rank");
  const inv = useDataset("investigations");
  const claims = useDataset("claims");
  const briefRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const restore = useRef<HudCard | null>(null);

  const first =
    rank.status === "ready" && inv.status === "ready" && claims.status === "ready" ? topThree(rank.data, inv.data, claims.data, habitatId)[0] : undefined;
  const topLabel = base === "earth" ? "On Earth" : "Top 3";

  const close = useCallback((restoreFocus: boolean) => {
    setOpen((o) => {
      restore.current = restoreFocus ? o : null;
      return null;
    });
  }, []);

  // Focus moves into the card on open (its close button) and back to the bar's button on Esc or Close.
  useEffect(() => {
    if (open) {
      (open === "top" ? topRef : briefRef).current?.querySelector<HTMLElement>(".hud-close")?.focus();
    } else if (restore.current) {
      barRef.current?.querySelector<HTMLElement>(`[data-card="${restore.current}"]`)?.focus();
      restore.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (closesOnKey(open, e.key)) {
        e.stopPropagation();
        close(true);
      }
    };
    const onPress = (e: PointerEvent) => {
      if (closesOnPress(open, e.target as Node, [briefRef.current, topRef.current, barRef.current])) close(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPress, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPress, true);
    };
  }, [open, close]);

  return (
    <div className="console-hud" data-open={open ?? undefined}>
      <div className="console-brief" id="hud-brief" ref={briefRef}>
        <BriefLine />
        <button type="button" className="hud-close icon-btn" aria-label="Close the brief" onClick={() => close(true)}>
          <CloseIcon />
        </button>
      </div>
      <div className="console-overlay" id="hud-top" ref={topRef}>
        {overlay}
        <button type="button" className="hud-close icon-btn" aria-label={`Close ${topLabel}`} onClick={() => close(true)}>
          <CloseIcon />
        </button>
      </div>
      <div className="hud-bar glass" ref={barRef}>
        <p className="hud-bar-top">
          {first ? (
            <>
              <span className="hud-bar-name" title={first.inv.title}>{first.inv.title}</span>
              <span className="hud-bar-score t-readout">{scoreText(first.item.score)}</span>
            </>
          ) : (
            <span className="hud-bar-name">Top result loading</span>
          )}
        </p>
        <button type="button" className="hud-btn" data-card="top" aria-expanded={open === "top"} aria-controls="hud-top" onClick={() => setOpen((o) => toggleCard(o, "top"))}>
          {topLabel}
        </button>
        <button type="button" className="hud-btn" data-card="brief" aria-expanded={open === "brief"} aria-controls="hud-brief" onClick={() => setOpen((o) => toggleCard(o, "brief"))}>
          Brief
        </button>
      </div>
    </div>
  );
}
