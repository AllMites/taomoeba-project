// The guided path (docs/RESKIN_PRD.md, section 16): six steps through the console, each with the console state it
// sets and the control the viewer should use next. Data only, so console.ts can read it without a cycle.
// Every factual sentence here is checked against what the site shows: change the copy only after reading the sheet.
import type { View } from "../app/console.ts";

export type Step = 1 | 2 | 3 | 4 | 5 | 6;
export const STEP_COUNT = 6;

export interface GuideStep {
  n: Step;
  /** 2 to 5 words. */
  name: string;
  /** One sentence: what to do. */
  doThis: string;
  /** "Why this step": 2 to 4 sentences. */
  why: string[];
  /** The view the step opens. "stage": no sheet. */
  view: View;
  /** The step opens the Ask SI panel. */
  ask?: boolean;
  /** The control to use next: the first of these selectors that is on screen gets the outline. */
  target: string[];
}

export const STEPS: GuideStep[] = [
  {
    n: 1,
    name: "Pick your base",
    doThis: "Pick a base in the row at the top of the replay.",
    why: [
      "The bases differ in oxygen, air pressure and gravity, and fire behaves differently in each.",
      "The air of the base you pick shows under the row and in the strip at the foot of the screen.",
      "Everything after this step is for that base.",
    ],
    view: "stage",
    target: [".console-carousel"],
  },
  {
    n: 2,
    name: "See what matters most",
    doThis: "Read the ranked list, then open How ranking works.",
    why: [
      "The experiments are ranked by how well they fit this base.",
      "Each gets five checks: oxygen match and pressure match count double; fire-safety focus, a flight in space and goal fit count once.",
      "The score is their weighted average, and a check the record cannot answer counts as half.",
      "The records come from NASA Physical Sciences Informatics (PSI).",
    ],
    view: "rank",
    target: [".sheet .rk-how > summary"],
  },
  {
    n: 3,
    name: "Read what it means",
    doThis: "Read what the evidence says for this base, and open How we know on any line you doubt.",
    why: [
      "This sheet sums up what the experiments found about flames in this base's air.",
      "It sets results in orbit beside the same tests on Earth.",
      "Its last part says what the data cannot tell you.",
    ],
    view: "interpret",
    target: [".sheet .brief-how > summary"],
  },
  {
    n: 4,
    name: "Watch a fire and respond",
    doThis: "Pick where the fire starts and a response, then read what happens.",
    why: [
      "The fire, its spread and the smoke are drawn, not filmed, and the times are illustrative, scaled by oxygen.",
      "What each response does comes from the test records where they exist, with How we know beside it.",
      "Where no test covers this air or gravity, the scene says Not tested and draws a weaker flame.",
    ],
    view: "stage",
    target: ['.burn-toggle[aria-expanded="false"]', ".spread-set"],
  },
  {
    n: 5,
    name: "Ask your own question",
    doThis: "Type a question in plain words, or pick one of the suggested questions.",
    why: [
      "Ask SI answers for the base you picked, only from the sources it shows.",
      "Every answer lists those sources.",
      "Data findings are computed by code from the team's tables, not written by SI.",
    ],
    view: "stage",
    ask: true,
    target: [".console-right textarea"],
  },
  {
    n: 6,
    name: "Check how it was made",
    doThis: "Try the team's droplet model, then open the Research map or the Library.",
    why: [
      "Team models predicts how a burning fuel droplet behaves, from models trained on NASA FLEX droplet tests aboard the ISS.",
      "Its numbers are predictions, not measurements, and it says how far off they can be.",
      "The Research map shows how experiments, reports and NASA pages connect, and the Library lists the experiments.",
    ],
    view: "models",
    target: [".sheet .burn-controls > button"],
  },
];

export const stepOf = (n: Step) => STEPS[n - 1]!;

/** The step whose sheet this is, or null for a view that is not on the path. */
export function stepForView(view: View): Step | null {
  if (view === "graph") return 6;
  return STEPS.find((s) => s.view === view && view !== "stage")?.n ?? null;
}

export const asStep = (n: number): Step | null => (Number.isInteger(n) && n >= 1 && n <= STEP_COUNT ? (n as Step) : null);

/** Stored choice: "off" after Hide guide. */
export const GUIDE_KEY = "firebreak.guide";

/**
 * First guide state. `?guide=N` (1 to 6) opens at step N, `?guide=0` hides it; neither is stored.
 * Without it, the guide is on unless the viewer hid it before.
 */
export function initialGuide(search: string, stored: string | null): { on: boolean; step: Step | null; fromUrl: boolean } {
  const q = new URLSearchParams(search);
  if (q.has("guide")) {
    const n = Number(q.get("guide"));
    if (n === 0) return { on: false, step: null, fromUrl: true };
    const step = asStep(n);
    if (step) return { on: true, step, fromUrl: true };
  }
  return { on: stored !== "off", step: null, fromUrl: false };
}

export function readStored(): string | null {
  try {
    return window.localStorage.getItem(GUIDE_KEY);
  } catch {
    return null;
  }
}

export function writeStored(on: boolean) {
  try {
    window.localStorage.setItem(GUIDE_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked (private window): the choice lasts for this visit only.
  }
}
