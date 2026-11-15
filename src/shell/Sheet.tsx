import { useEffect, useRef, type ReactNode } from "react";
import { useConsole } from "../app/console.ts";
import { Icon } from "./icons.tsx";
import { navId, navLabel, type SheetView } from "./logic.ts";

const close = () => useConsole.getState().setView("stage");

/**
 * A glass sheet over the replay, one per nav view. The replay dims behind it. It is mounted only while its
 * view is open: focus moves into it on open and back to its nav button on close. Esc and the close button close it.
 * The section inside keeps its own h2 as the visible heading; the header here only names the view.
 */
export default function Sheet({ view, children }: { view: SheetView; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // A dialog (the evidence drawer, the chat on a phone) handles its own Esc.
      if (e.key !== "Escape" || e.defaultPrevented || (e.target as Element | null)?.closest?.("dialog")) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Closed from inside (Esc, close button): the focused element is gone, so focus fell to the page.
      const active = document.activeElement;
      if (!active || active === document.body) document.getElementById(navId(view))?.focus({ preventScroll: true });
    };
  }, [view]);

  return (
    <>
      <div className="sheet-scrim" onClick={close} />
      <section ref={ref} className="sheet glass" aria-label={navLabel(view)} tabIndex={-1}>
        <header className="sheet-head">
          <span className="t-readout">{navLabel(view)}</span>
          <button type="button" className="icon-btn" aria-label={`Close ${navLabel(view)}`} onClick={close}>
            <Icon name="x" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
