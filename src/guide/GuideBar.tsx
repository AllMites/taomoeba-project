// The guide bar (docs/RESKIN_PRD.md, section 16.2): one row under the top nav that walks the viewer through the six
// steps and marks the control to use next. "Why this step" opens under the bar, in the flow, so it covers nothing.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useConsole } from "../app/console.ts";
import { applyStep, findTarget, followConsole, nextStep, prevStep, setGuideOn } from "./drive.ts";
import { STEP_COUNT, stepOf, type Step } from "./steps.ts";
import "./guide.css";

const MARK = "data-guide-next";

/** Puts the "use this next" outline on the step's control, and moves it as the control appears or changes. */
function useMark(on: boolean, step: Step) {
  useEffect(() => {
    if (!on || typeof document === "undefined") return;
    const { target } = stepOf(step);
    let marked: Element | null = null;
    let frame = 0;
    const place = () => {
      frame = 0;
      const el = findTarget(target);
      if (el === marked) return;
      marked?.removeAttribute(MARK);
      marked = el;
      marked?.setAttribute(MARK, "");
    };
    place();
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(place);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded", "open"] });
    return () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
      marked?.removeAttribute(MARK);
    };
  }, [on, step]);
}

/**
 * On a phone an open sheet is full screen and makes the rest of the console inert (Sheet.tsx). The bar then docks
 * over the sheet's foot and must stay usable, so it takes its own inert flag back off.
 */
function useNotInert(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mo = new MutationObserver(() => el.hasAttribute("inert") && el.removeAttribute("inert"));
    mo.observe(el, { attributes: true, attributeFilter: ["inert"] });
    return () => mo.disconnect();
  }, [ref]);
}

/** `on` and `step` come from the console store; the props only stand in for it where there is no live store (tests). */
/**
 * The bar's real height (more with "Why this step" open) as --guide-h on the console, so the parts sized against the
 * space above the center (the Ask bottom sheet on a phone, the top 3 card) stop below the bar instead of under it.
 */
function useGuideHeight(ref: React.RefObject<HTMLElement | null>, on: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || typeof ResizeObserver === "undefined") return;
    const fit = () => host.style.setProperty("--guide-h", `${el.offsetHeight}px`);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => {
      ro.disconnect();
      host.style.removeProperty("--guide-h");
    };
  }, [ref, on]);
}

export default function GuideBar(props: { on?: boolean; step?: Step }) {
  const storeOn = useConsole((s) => s.guideOn);
  const storeStep = useConsole((s) => s.guideStep);
  const on = props.on ?? storeOn;
  const step = props.step ?? storeStep;
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const id = useId();
  const box = useRef<HTMLElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const firstStep = useRef(true);
  const wasOn = useRef(on);
  const s = stepOf(step);

  useEffect(() => followConsole(), []);
  useMark(on, step);
  useNotInert(box);
  useGuideHeight(box, on);

  // A step change is read out once; the first step on load is not.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    setSaid(`Step ${step} of ${STEP_COUNT}: ${s.name}. ${s.doThis}`);
  }, [step, s.name, s.doThis]);

  // Brought back with the Guide button: focus lands on Next.
  useLayoutEffect(() => {
    if (on && !wasOn.current) next.current?.focus();
    wasOn.current = on;
  }, [on]);

  if (!on) return null;

  const go = (n: Step | null) => {
    if (!n) return;
    applyStep(n);
    // Sheets and Ask SI move focus themselves; the replay steps put it on the picked base for step 1.
    if (n === 1) requestAnimationFrame(() => document.querySelector<HTMLElement>('.console-carousel [aria-checked="true"]')?.focus());
  };
  const hide = () => {
    setGuideOn(false);
    requestAnimationFrame(() => document.getElementById("nav-guide")?.focus());
  };
  const last = step === STEP_COUNT;
  const panel = `${id}-more`;

  return (
    <section ref={box} className="console-guide" aria-label="Guide" data-open={open || undefined}>
      <div className="guide-bar glass">
        <p className="guide-head">
          <span className="guide-count t-readout">
            <span className="guide-long">Step {step} of {STEP_COUNT}</span>
            <span className="guide-short" aria-hidden="true">
              {step}/{STEP_COUNT}
            </span>
          </span>
          <span className="guide-name guide-long">{s.name}</span>
          <span className="guide-do guide-long">{s.doThis}</span>
        </p>
        <button type="button" className="guide-name-btn guide-short" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)}>
          <span className="sr-only">Step {step} of {STEP_COUNT}: </span>
          <span className="guide-name">{s.name}</span>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <div className="guide-actions">
          <button type="button" className="guide-btn guide-long" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)}>
            Why this step
          </button>
          <button type="button" className="guide-btn guide-long" disabled={step === 1} onClick={() => go(prevStep(step))}>
            Back
          </button>
          <button ref={next} type="button" className="guide-btn guide-next" onClick={() => (last ? hide() : go(nextStep(step)))}>
            {last ? "Done" : "Next"}
          </button>
          <button type="button" className="guide-btn guide-long" onClick={hide}>
            Hide guide
          </button>
        </div>
      </div>
      <div id={panel} className="guide-more glass" hidden={!open}>
        <p className="guide-do guide-short">{s.doThis}</p>
        <h2 className="guide-why-h t-readout">Why this step</h2>
        {s.why.map((w) => (
          <p key={w} className="guide-why">
            {w}
          </p>
        ))}
        {step === 6 && (
          <p className="guide-links">
            <button type="button" className="guide-btn" onClick={() => useConsole.getState().setView("graph")}>
              Open the Research map
            </button>
            <button type="button" className="guide-btn" onClick={() => useConsole.getState().setLeftOpen(true)}>
              Open the Library
            </button>
          </p>
        )}
        <p className="guide-links guide-short">
          <button type="button" className="guide-btn" disabled={step === 1} onClick={() => go(prevStep(step))}>
            Back
          </button>
          <button type="button" className="guide-btn" onClick={hide}>
            Hide guide
          </button>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </section>
  );
}
