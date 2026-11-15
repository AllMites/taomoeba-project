// Side panel states (Library on the left, Ask SI on the right), with no markup.
// Pinned lives in the console store (leftOpen, askOpen) and in the URL; peek is local to the panel.

/** Minimized: a strip on the edge. Peek: the full panel over the replay. Pinned: docked beside the center. */
export type PanelMode = "min" | "peek" | "pinned";

export const modeOf = (pinned: boolean, peek: boolean): PanelMode => (pinned ? "pinned" : peek ? "peek" : "min");

/** The pointer rests this long on the strip before the panel opens, so passing over it does nothing. */
export const PEEK_OPEN_MS = 150;
/** The panel waits this long after the pointer leaves, so a short slip off its edge does not close it. */
export const PEEK_CLOSE_MS = 300;

export interface Peek {
  readonly open: boolean;
  /** A mouse or pen entered the panel (strip or open panel). Touch never peeks. */
  pointerEnter(): void;
  pointerLeave(): void;
  /** Focus arrived inside the panel. From the keyboard it opens the panel; any focus inside keeps it open. */
  focusIn(keyboard: boolean): void;
  /** Focus left the panel for somewhere outside it. */
  focusOut(): void;
  /** Esc: closes a peek. True when it closed one, so the key is used up. */
  escape(): boolean;
  /** Pinned or unpinned: the peek ends either way, and no timer is left. */
  reset(): void;
  dispose(): void;
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void };
const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

export function createPeek(onChange: (open: boolean) => void, timers: Timers = realTimers): Peek {
  let open = false;
  let hover = false;
  let focusInside = false;
  let opening: unknown = null;
  let closing: unknown = null;
  const stopOpening = () => {
    if (opening !== null) timers.clear(opening);
    opening = null;
  };
  const stopClosing = () => {
    if (closing !== null) timers.clear(closing);
    closing = null;
  };
  const set = (next: boolean) => {
    stopOpening();
    stopClosing();
    if (open === next) return;
    open = next;
    onChange(next);
  };
  return {
    get open() {
      return open;
    },
    pointerEnter() {
      hover = true;
      stopClosing();
      if (!open && opening === null) opening = timers.set(() => set(true), PEEK_OPEN_MS);
    },
    pointerLeave() {
      hover = false;
      stopOpening();
      if (open && !focusInside && closing === null) closing = timers.set(() => set(false), PEEK_CLOSE_MS);
    },
    focusIn(keyboard) {
      focusInside = true;
      stopClosing();
      if (keyboard) set(true);
    },
    focusOut() {
      focusInside = false;
      if (!hover) set(false);
    },
    escape() {
      if (!open) return false;
      set(false);
      return true;
    },
    reset() {
      hover = false;
      set(false);
    },
    dispose() {
      stopOpening();
      stopClosing();
    },
  };
}
