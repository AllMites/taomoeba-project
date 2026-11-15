// Console shell logic with no markup: the nav list, carousel stepping, and store wiring.
import { BASE_ORDER, useConsole, type BaseId, type View } from "../app/console.ts";
import { useStore } from "../app/store.ts";

export type SheetView = Exclude<View, "stage">;

/** Top nav, in order. Each opens a sheet over the replay; tip is the one-line description on hover and focus. */
export const NAV: { view: SheetView; label: string; tip: string }[] = [
  { view: "interpret", label: "Interpret", tip: "What the records mean for this base, in plain words." },
  { view: "rank", label: "Rank", tip: "Every experiment, ranked for this base's air." },
  { view: "compare", label: "Compare", tip: "Two experiments side by side." },
  { view: "models", label: "Team models", tip: "What-if estimates from the team's trained model." },
  { view: "graph", label: "Research map", tip: "How experiments, reports and pages connect." },
];
export const navLabel = (view: SheetView) => NAV.find((n) => n.view === view)!.label;
export const navId = (view: SheetView) => `nav-${view}`;

/** Pressing the open view's button closes it. */
export const toggleView = (current: View, pressed: SheetView): View => (current === pressed ? "stage" : pressed);

/** The base one step left (-1) or right (+1) in the carousel. It wraps at both ends. */
export function stepBase(base: BaseId, dir: -1 | 1): BaseId {
  const n = BASE_ORDER.length;
  return BASE_ORDER[(BASE_ORDER.indexOf(base) + dir + n) % n]!;
}

/** Which way a key moves the carousel, or the base it jumps to. Null: not a carousel key. */
export function baseForKey(key: string, base: BaseId): BaseId | null {
  if (key === "ArrowLeft" || key === "ArrowUp") return stepBase(base, -1);
  if (key === "ArrowRight" || key === "ArrowDown") return stepBase(base, 1);
  if (key === "Home") return BASE_ORDER[0]!;
  if (key === "End") return BASE_ORDER[BASE_ORDER.length - 1]!;
  return null;
}

/**
 * The Ask panel's "Show the N experiments" lights cards in the ranked list, and that list lives in the
 * Rank sheet. So when cards light up, open Rank. Returns the unsubscribe.
 */
export function openRankOnHighlight() {
  return useStore.subscribe((s, prev) => {
    if (s.highlightIds !== prev.highlightIds && s.highlightIds.length > 0) useConsole.getState().setView("rank");
  });
}
