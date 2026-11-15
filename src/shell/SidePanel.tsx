// The two side panels, Library (left) and Ask SI (right): one frame, one header, three states.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useConsole, type ConsoleState } from "../app/console.ts";
import { Icon, type IconName } from "./icons.tsx";
import { createPeek, modeOf } from "./peek.ts";

export type PanelId = "left" | "ask";

const NAME: Record<PanelId, string> = { left: "Library", ask: "Ask SI" };
const ICON: Record<PanelId, IconName> = { left: "library", ask: "message" };
const CLASS: Record<PanelId, string> = { left: "console-left", ask: "console-right" };

/** Pinned is the store's open flag: leftOpen and askOpen, and lib=1 and ask=1 in the URL. */
export const pinnedOf = (s: Pick<ConsoleState, "leftOpen" | "askOpen">, panel: PanelId) => (panel === "left" ? s.leftOpen : s.askOpen);
export function setPinned(panel: PanelId, pinned: boolean) {
  const s = useConsole.getState();
  if (panel === "left") s.setLeftOpen(pinned);
  else s.setAskOpen(pinned);
}

const boxId = (panel: PanelId) => `${panel}-panel`;

/**
 * The header both panels share: the name, then the panel's own actions, then Pin. On a phone the panel is a
 * bottom sheet, so Pin gives way to Close. `headingId` makes the name the panel's heading (Ask SI); the Library
 * keeps its own heading inside.
 */
export function PanelHead({ panel, headingId, actions }: { panel: PanelId; headingId?: string; actions?: ReactNode }) {
  const pinned = useConsole((s) => pinnedOf(s, panel));
  const name = NAME[panel];
  return (
    <header className="panel-head">
      {headingId ? (
        <h2 id={headingId} className="panel-title t-readout">
          {name}
        </h2>
      ) : (
        <span className="panel-title t-readout">{name}</span>
      )}
      <div className="panel-actions">
        {actions}
        <button
          type="button"
          className="icon-btn panel-pin"
          aria-label={`Pin ${name}`}
          title={pinned ? `Unpin ${name}` : `Pin ${name}`}
          aria-pressed={pinned}
          onClick={() => setPinned(panel, !pinned)}
        >
          <Icon name="pin" />
        </button>
        <button type="button" className="icon-btn panel-close" aria-label={`Close ${name}`} onClick={() => setPinned(panel, false)}>
          <Icon name="x" />
        </button>
      </div>
    </header>
  );
}

const keyboardFocus = (el: EventTarget | null) => {
  try {
    return el instanceof Element && el.matches(":focus-visible");
  } catch {
    return false;
  }
};

/**
 * A side panel. Minimized it is a 48px strip on its edge (a button); resting the pointer on it or reaching it
 * with Tab opens the panel over the replay (peek); pressing it, or Pin in the header, docks it beside the center.
 * The content stays mounted in every state (the Ask thread lives in it): a minimized panel is only inert.
 */
export default function SidePanel({ panel, children }: { panel: PanelId; children: ReactNode }) {
  const pinned = useConsole((s) => pinnedOf(s, panel));
  const [peekOpen, setPeekOpen] = useState(false);
  const peek = useRef(createPeek(setPeekOpen)).current;
  const strip = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const mode = modeOf(pinned, peekOpen);
  const name = NAME[panel];

  useEffect(() => () => peek.dispose(), [peek]);

  // Pinning or unpinning ends a peek. Focus follows the state, before the Ask panel's own focus handling runs:
  // pinned from the strip, focus moves to the header (the strip is gone); unpinned from inside, back to the strip.
  const was = useRef(pinned);
  useLayoutEffect(() => {
    if (was.current === pinned) return;
    was.current = pinned;
    const active = document.activeElement;
    if (pinned && (active === strip.current || active === document.body)) box.current?.querySelector<HTMLElement>(".panel-pin")?.focus({ preventScroll: true });
    if (!pinned && (!active || active === document.body || box.current?.contains(active))) strip.current?.focus({ preventScroll: true });
    // After the focus move: the strip taking focus from the keyboard must not reopen the panel as a peek.
    peek.reset();
  }, [pinned, peek]);

  return (
    <aside
      ref={root}
      className={CLASS[panel]}
      aria-label={name}
      data-mode={mode}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") peek.pointerEnter();
      }}
      onPointerLeave={() => peek.pointerLeave()}
      onFocus={(e) => {
        if (!pinned) peek.focusIn(e.target === strip.current && keyboardFocus(e.target));
      }}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) peek.focusOut();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || pinned || !peek.open) return;
        // Focus to the strip first: the strip taking focus must not count as a new peek.
        strip.current?.focus({ preventScroll: true });
        if (peek.escape()) e.preventDefault();
      }}
    >
      <button
        ref={strip}
        type="button"
        className="panel-strip"
        aria-expanded={mode !== "min"}
        aria-controls={boxId(panel)}
        onClick={() => setPinned(panel, true)}
      >
        <Icon name={ICON[panel]} />
        <span className="panel-strip-name t-readout">{name}</span>
      </button>
      <div ref={box} id={boxId(panel)} className={mode === "peek" ? "panel-box glass" : "panel-box"} inert={mode === "min"}>
        {children}
      </div>
    </aside>
  );
}
