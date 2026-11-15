import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConsole, withGuide } from "../app/console.ts";
import { usePlayback } from "../scenes/playback.ts";
import { NAV_PATH, TopBar } from "../shell/chrome.tsx";
import { applyStep, followConsole, setGuideOn, stepAfter } from "./drive.ts";
import GuideBar from "./GuideBar.tsx";
import { GUIDE_KEY, initialGuide, readStored, STEPS, stepForView, writeStored, type Step } from "./steps.ts";

let unfollow = () => {};
beforeEach(() => {
  useConsole.setState({ base: "rover", view: "stage", leftOpen: false, askOpen: false, guideOn: true, guideStep: 1 });
  usePlayback.setState({ mode: "burn" });
  unfollow = followConsole();
});
afterEach(() => {
  unfollow();
  vi.unstubAllGlobals();
});

const state = () => {
  const c = useConsole.getState();
  return { view: c.view, askOpen: c.askOpen, step: c.guideStep, base: c.base };
};

describe("each step sets its console state", () => {
  it("walks all six with Next, keeping the picked base", () => {
    const seen = ([1, 2, 3, 4, 5, 6] as Step[]).map((n) => {
      applyStep(n);
      return state();
    });
    expect(seen).toEqual([
      { view: "stage", askOpen: false, step: 1, base: "rover" },
      { view: "rank", askOpen: false, step: 2, base: "rover" },
      { view: "interpret", askOpen: false, step: 3, base: "rover" },
      { view: "stage", askOpen: false, step: 4, base: "rover" },
      { view: "stage", askOpen: true, step: 5, base: "rover" },
      { view: "models", askOpen: false, step: 6, base: "rover" },
    ]);
  });
  it("step 4 picks the Fire in this base scene", () => {
    applyStep(4);
    expect(usePlayback.getState().mode).toBe("spread");
  });
  it("Back from 5 puts Ask SI back the way it was; one already open stays open", () => {
    applyStep(5);
    applyStep(4);
    expect(state()).toMatchObject({ askOpen: false, step: 4 });
    useConsole.setState({ askOpen: true });
    applyStep(5);
    applyStep(6);
    expect(state()).toMatchObject({ askOpen: true, view: "models", step: 6 });
  });
});

describe("a change by hand moves the step to match", () => {
  it("opening a sheet on the path shows its step", () => {
    useConsole.getState().setView("interpret");
    expect(state().step).toBe(3);
    useConsole.getState().setView("rank");
    expect(state().step).toBe(2);
    useConsole.getState().setView("graph");
    expect(state().step).toBe(6);
    useConsole.getState().setView("models");
    expect(state().step).toBe(6);
  });
  it("opening Ask SI is step 5; closing it there is the replay, step 4", () => {
    useConsole.getState().setAskOpen(true);
    expect(state().step).toBe(5);
    useConsole.getState().setAskOpen(false);
    expect(state().step).toBe(4);
  });
  it("closing a sheet goes back to the replay step: 1 early on, 4 once past it", () => {
    useConsole.getState().setView("rank");
    useConsole.getState().setView("stage");
    expect(state().step).toBe(1);
    useConsole.getState().setView("models");
    useConsole.getState().setView("stage");
    expect(state().step).toBe(4);
  });
  it("a sheet off the path keeps the step", () => {
    applyStep(3);
    useConsole.getState().setView("compare");
    expect(state().step).toBe(3);
  });
  it("the mapping is the same function the bar uses", () => {
    expect(stepAfter(2, { view: "rank", askOpen: false }, { view: "materials", askOpen: false })).toBe(2);
    for (const s of STEPS) if (s.view !== "stage") expect(stepForView(s.view)).toBe(s.n);
  });
});

describe("URL and stored choice", () => {
  it("?guide=N opens step N with its state; ?guide=0 hides it; bad values fall back", () => {
    const base = { base: "moon", view: "stage" as const, leftOpen: false, askOpen: false };
    expect(withGuide(base, initialGuide("?guide=3", null))).toMatchObject({ view: "interpret", guideOn: true, guideStep: 3 });
    expect(withGuide(base, initialGuide("?guide=5", "off"))).toMatchObject({ view: "stage", askOpen: true, guideOn: true, guideStep: 5 });
    expect(withGuide(base, initialGuide("?guide=0", null))).toMatchObject({ guideOn: false, guideStep: 1 });
    expect(withGuide(base, initialGuide("?guide=9", null))).toMatchObject({ guideOn: true, guideStep: 1 });
    expect(withGuide({ ...base, view: "rank" as const }, initialGuide("", null))).toMatchObject({ view: "rank", guideStep: 2 });
  });
  it("first visit: on at step 1; after Hide guide: off", () => {
    expect(initialGuide("", null)).toEqual({ on: true, step: null, fromUrl: false });
    expect(initialGuide("", "off")).toMatchObject({ on: false });
    expect(initialGuide("", "on")).toMatchObject({ on: true });
  });
  it("reads and writes localStorage, and survives storage that throws", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
    expect(readStored()).toBeNull();
    setGuideOn(false);
    expect(store.get(GUIDE_KEY)).toBe("off");
    expect(readStored()).toBe("off");
    expect(useConsole.getState().guideOn).toBe(false);
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } });
    expect(readStored()).toBeNull();
    expect(() => writeStored(true)).not.toThrow();
  });
});

describe("markup", () => {
  it("the bar is a labelled region with the step, Back, Next and Hide guide", () => {
    const html = renderToStaticMarkup(<GuideBar on step={2} />);
    expect(html).toMatch(/<section[^>]*class="console-guide"[^>]*aria-label="Guide"/);
    expect(html).toContain("Step 2 of 6");
    expect(html).toContain("See what matters most");
    expect(html).toContain(">Next<");
    expect(html).toContain(">Back<");
    expect(html).toContain(">Hide guide<");
    expect(html).toContain('aria-live="polite"');
    expect(renderToStaticMarkup(<GuideBar on step={6} />)).toContain(">Done<");
    expect(renderToStaticMarkup(<GuideBar on={false} step={1} />)).toBe("");
  });
  it("the nav follows the path and numbers its steps; Guide shows only while the guide is hidden", () => {
    expect(NAV_PATH.map((n) => n.view)).toEqual(["rank", "interpret", "models", "graph", "compare", "materials"]);
    const on = renderToStaticMarkup(<TopBar view="stage" leftOpen={false} askOpen={false} guide />);
    expect(on).not.toContain('id="nav-guide"');
    expect(on).toMatch(/id="nav-rank"[^>]*><span class="nav-step t-readout"><span class="sr-only">Step <\/span>2/);
    expect(on).toMatch(/id="nav-models"[^>]*><span class="nav-step t-readout"><span class="sr-only">Step <\/span>6/);
    expect(on).toMatch(/id="nav-graph"[^>]*>Research map/);
    expect(renderToStaticMarkup(<TopBar view="stage" leftOpen={false} askOpen={false} guide={false} />)).toContain('id="nav-guide"');
  });
  it("every step's copy keeps to the rules: short name, one instruction, 2 to 4 reasons, no em dash", () => {
    for (const s of STEPS) {
      const words = s.name.split(" ").length;
      expect(words).toBeGreaterThanOrEqual(2);
      expect(words).toBeLessThanOrEqual(5);
      expect(s.doThis.match(/[.!?](\s|$)/g)).toHaveLength(1);
      expect(s.why.length).toBeGreaterThanOrEqual(2);
      expect(s.why.length).toBeLessThanOrEqual(4);
      expect([s.name, s.doThis, ...s.why].join(" ")).not.toMatch(/—|Artemis/);
    }
  });
});
