import { useEffect, useRef, type ReactNode } from "react";
import { useConsole } from "../app/console.ts";
import { Icon } from "./icons.tsx";
import { navId, navLabel, onPhone, type SheetView } from "./logic.ts";

const close = () => useConsole.getState().setView("stage");

/** The parts of a DOM element that inertBehind touches (an interface, so it can be checked without a browser). */
export interface InertNode {
  parentElement: InertNode | null;
  children: Iterable<InertNode>;
  classList: { contains(name: string): boolean };
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Makes what a sheet covers inert, so Tab cannot walk behind it. Wide screen: the rest of the center (carousel,
 * replay, brief line, top 3). Phone: the sheet is full screen, so the whole console except the Ask panel, which
 * opens over sheets. Returns the undo; leaves alone what was inert already.
 */
export function inertBehind(sheet: InertNode, phone: boolean): () => void {
  const center = sheet.parentElement;
  if (!center) return () => {};
  const keep = (el: InertNode) =>
    el === sheet || el.classList.contains("sheet-scrim") || el.classList.contains("console-right");
  const around = phone && center.parentElement ? [...center.parentElement.children].filter((el) => el !== center) : [];
  const covered = [...center.children, ...around].filter((el) => !keep(el) && !el.hasAttribute("inert"));
  for (const el of covered) el.setAttribute("inert", "");
  return () => {
    for (const el of covered) el.removeAttribute("inert");
  };
}

/** The dimming behind a sheet. A press on it closes the sheet without taking focus, so focus goes back to the nav. */
export function Scrim() {
  return <div className="sheet-scrim" onMouseDown={(e) => e.preventDefault()} onClick={close} />;
}

/**
 * A glass sheet over the replay, one per nav view. The replay dims behind it. It is mounted only while its
 * view is open: focus moves into it on open and back to its nav button on close, and what it covers is inert.
 * Esc, the close button and a press on the dimming close it.
 * The section inside keeps its own h2 as the visible heading; the header holds only the close button.
 */
export default function Sheet({ view, children }: { view: SheetView; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const undoInert = ref.current ? inertBehind(ref.current, onPhone()) : () => {};
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // A dialog (the evidence drawer) handles its own Esc.
      if (e.key !== "Escape" || e.defaultPrevented || (e.target as Element | null)?.closest?.("dialog")) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      undoInert();
      // Closed from inside (Esc, close button, the dimming): the focused element is gone, so focus fell to the page.
      const active = document.activeElement;
      if (!active || active === document.body) document.getElementById(navId(view))?.focus({ preventScroll: true });
    };
  }, [view]);

  return (
    <>
      <Scrim />
      <section ref={ref} className="sheet glass" aria-label={navLabel(view)} tabIndex={-1}>
        <header className="sheet-head">
          <button type="button" className="icon-btn" aria-label={`Close ${navLabel(view)}`} onClick={close}>
            <Icon name="x" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
