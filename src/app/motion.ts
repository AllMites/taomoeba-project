import { flushSync } from "react-dom";
import type { HabitatId } from "../contracts/index.ts";
import { useStore } from "./store.ts";

type VTDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/** True when the visitor asked for less motion. Safe outside a browser. */
export const prefersCalm = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Run a state update inside a view transition when the browser has one and motion is welcome;
 * otherwise run it directly. flushSync makes React commit inside the transition's update callback.
 */
export function withViewTransition(update: () => void, doc: VTDocument | undefined = typeof document === "undefined" ? undefined : document) {
  if (!doc || typeof doc.startViewTransition !== "function" || prefersCalm()) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

/** Pick a habitat from anywhere (hero picker, sticky bar): cards glide to their new rank. */
export function pickHabitat(h: HabitatId) {
  if (useStore.getState().habitat === h) return;
  withViewTransition(() => useStore.getState().setHabitat(h));
}

/** Names shared by a card and the drawer header; only one element carries each at any moment. */
export const MORPH = { num: "ev-num", title: "ev-title" } as const;

/**
 * Open a card in the drawer. The card's numeral and title take the shared names just before the
 * transition starts and give them up inside the update, when the drawer header takes them (CSS).
 */
export function openFromCard(card: HTMLElement | null, id: string) {
  const open = () => useStore.getState().setSelectedInvestigationId(id);
  const num = card?.querySelector<HTMLElement>(".rk-num");
  const title = card?.querySelector<HTMLElement>(".rk-title");
  const doc = typeof document === "undefined" ? undefined : (document as VTDocument);
  if (!num || !title || !doc || typeof doc.startViewTransition !== "function" || prefersCalm()) {
    open();
    return;
  }
  num.style.viewTransitionName = MORPH.num;
  title.style.viewTransitionName = MORPH.title;
  doc.startViewTransition(() => {
    num.style.viewTransitionName = "";
    title.style.viewTransitionName = "";
    flushSync(open);
  });
}

/** view-transition-name for a card, from its experiment id ("PSI-69" -> "card-PSI-69"). */
export const cardTransitionName = (id: string) => `card-${id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
