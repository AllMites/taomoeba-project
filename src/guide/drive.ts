// What the guide does to the console: Next and Back set a step's state, and a change by hand moves the step to match.
import { useConsole, type View } from "../app/console.ts";
import { usePlayback } from "../scenes/playback.ts";
import { STEP_COUNT, stepForView, stepOf, writeStored, type Step } from "./steps.ts";

type Seen = { view: View; askOpen: boolean };

/**
 * The step that matches the console after a change the viewer made by hand. A sheet on the path names its step.
 * Back on the replay is step 4 once the viewer has been past it, else step 1. Opening Ask is step 5, and closing it
 * there goes back to the replay (step 4). A sheet off the path (Compare, Materials) keeps the step.
 */
export function stepAfter(step: Step, prev: Seen, next: Seen): Step {
  if (next.view !== prev.view) {
    const own = stepForView(next.view);
    if (own) return own;
    if (next.view !== "stage") return step;
    if (step === 5 && next.askOpen) return 5;
    return step >= 4 ? 4 : 1;
  }
  if (next.askOpen && !prev.askOpen) return 5;
  if (!next.askOpen && prev.askOpen && step === 5) return 4;
  return step;
}

let applying = false;
/** Whether Ask SI was open before step 5 opened it, so leaving step 5 puts it back. */
let askBefore: boolean | null = null;

/** Set step n's console state. The base stays as picked; nothing reloads. */
export function applyStep(n: Step) {
  const c = useConsole.getState();
  const s = stepOf(n);
  applying = true;
  try {
    if (c.guideStep === 5 && n !== 5 && askBefore !== null) {
      c.setAskOpen(askBefore);
      askBefore = null;
    }
    if (s.ask && !c.askOpen) {
      askBefore = false;
      c.setAskOpen(true);
    }
    c.setView(s.view);
    if (n === 4) usePlayback.getState().setMode("spread");
    useConsole.setState({ guideStep: n });
  } finally {
    applying = false;
  }
}

export const nextStep = (n: Step): Step | null => (n < STEP_COUNT ? ((n + 1) as Step) : null);
export const prevStep = (n: Step): Step | null => (n > 1 ? ((n - 1) as Step) : null);

export function setGuideOn(on: boolean) {
  writeStored(on);
  useConsole.setState({ guideOn: on });
}

/** Keep the step in line with the console while the viewer clicks around. Returns the unsubscribe. */
export function followConsole() {
  return useConsole.subscribe((s, p) => {
    if (applying || (s.view === p.view && s.askOpen === p.askOpen)) return;
    if (s.askOpen !== p.askOpen) askBefore = null; // a hand on Ask: leaving step 5 no longer undoes it
    const step = stepAfter(s.guideStep, p, s);
    if (step !== s.guideStep) useConsole.setState({ guideStep: step });
  });
}

/** The control to use next: the first match that is on screen. */
export function findTarget(selectors: string[], root: ParentNode = document): Element | null {
  for (const sel of selectors) {
    for (const el of root.querySelectorAll(sel)) if (el.getClientRects().length > 0) return el;
  }
  return null;
}
