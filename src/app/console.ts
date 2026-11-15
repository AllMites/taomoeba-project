// Console state for the one-screen layout (docs/RESKIN_PRD.md). Integrator only.
// Kept apart from store.ts so data state (habitat, filters, drawer) and layout state do not mix.
import type { DragEvent } from "react";
import { create } from "zustand";
import type { HabitatId } from "../contracts/index.ts";
import { initialGuide, readStored, stepForView, stepOf, type Step } from "../guide/steps.ts";
import { pickHabitat } from "./motion.ts";
import { useStore } from "./store.ts";

/** A card in the base carousel. Earth is a bonus card, not a habitat preset. */
export type BaseId = "iss" | "moon" | "rover" | "earth";
export const BASE_ORDER: BaseId[] = ["iss", "moon", "rover", "earth"];

/** Earth air (21% O2, 101.3 kPa) matches the ISS, so Earth ranks with the ISS figures. */
export const habitatOf = (base: BaseId): HabitatId => (base === "earth" ? "iss" : base);

/** What sits over the replay. "stage" means no sheet is open. */
export type View = "stage" | "interpret" | "rank" | "compare" | "materials" | "models" | "graph";

export interface ConsoleState {
  base: BaseId;
  view: View;
  /** Left panel (Library). */
  leftOpen: boolean;
  /** Right panel (Ask SI). */
  askOpen: boolean;
  /** Investigation ids the next question is about: the chips above the Ask composer. */
  askAbout: string[];
  /** The guide bar is showing (docs/RESKIN_PRD.md, section 16). */
  guideOn: boolean;
  /** The guide step that matches the console state; kept while the guide is hidden. */
  guideStep: Step;
  setView: (v: View) => void;
  setLeftOpen: (open: boolean) => void;
  setAskOpen: (open: boolean) => void;
  removeAskAbout: (id: string) => void;
  clearAskAbout: () => void;
}

const VIEWS: View[] = ["stage", "interpret", "rank", "compare", "materials", "models", "graph"];

/**
 * First state, from the URL so any state can be linked, screenshotted and filmed:
 * ?base=rover&view=rank&lib=1&ask=0. Without lib/ask, both panels start open on a wide screen (1500px up), so the replay keeps the center.
 */
export function initialConsole(search: string, wide: boolean) {
  const q = new URLSearchParams(search);
  const one = <T extends string>(key: string, allowed: T[], fallback: T) =>
    allowed.includes(q.get(key) as T) ? (q.get(key) as T) : fallback;
  const flag = (key: string) => (q.has(key) ? q.get(key) === "1" : wide);
  return { base: one("base", BASE_ORDER, "moon"), view: one("view", VIEWS, "stage"), leftOpen: flag("lib"), askOpen: flag("ask") };
}

const inBrowser = typeof window !== "undefined" && typeof window.matchMedia === "function";
const first = initialConsole(inBrowser ? window.location.search : "", inBrowser && window.matchMedia("(min-width: 1500px)").matches);

/**
 * The console state with the guide on top: `?guide=N` opens step N with that step's state, `?guide=0` hides the
 * guide; otherwise the stored choice decides, and the step is the one the first view belongs to.
 */
export function withGuide<T extends { view: View; askOpen: boolean }>(state: T, guide: ReturnType<typeof initialGuide>) {
  if (guide.step) {
    const s = stepOf(guide.step);
    return { ...state, view: s.view, askOpen: s.ask ? true : state.askOpen, guideOn: guide.on, guideStep: guide.step };
  }
  return { ...state, guideOn: guide.on, guideStep: stepForView(state.view) ?? (1 as Step) };
}
const start = withGuide(first, initialGuide(inBrowser ? window.location.search : "", inBrowser ? readStored() : null));
if (first.base !== "moon") useStore.setState({ habitat: habitatOf(first.base) });

export const useConsole = create<ConsoleState>((set) => ({
  ...start,
  askAbout: [],
  setView: (view) => set({ view }),
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  setAskOpen: (askOpen) => set({ askOpen }),
  removeAskAbout: (id) => set((s) => ({ askAbout: s.askAbout.filter((x) => x !== id) })),
  clearAskAbout: () => set({ askAbout: [] }),
}));

/** Pick a base from anywhere. The ranking, brief and replay follow through the habitat in store.ts. */
export function pickBase(base: BaseId) {
  if (useConsole.getState().base === base) return;
  useConsole.setState({ base });
  pickHabitat(habitatOf(base));
}

/** "Ask about this": scope the next question to one experiment and open the Ask panel. */
export function askAbout(id: string) {
  useConsole.setState((s) => ({ askOpen: true, askAbout: s.askAbout.includes(id) ? s.askAbout : [...s.askAbout, id] }));
}

/** Drag payload of an experiment card. The Ask panel is the drop target. */
export const DRAG_TYPE = "application/x-flame-investigation";
export const dragProps = (id: string) => ({
  draggable: true,
  onDragStart: (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, id);
    e.dataTransfer.effectAllowed = "copy";
  },
});
