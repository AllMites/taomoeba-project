import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseId } from "../app/console.ts";
import Stage from "./Stage.tsx";

// A server render reads a zustand store's first state only, so the picked base is handed in here.
const picked = vi.hoisted(() => ({ base: "moon" as BaseId }));
vi.mock("../app/console.ts", async (original) => ({
  ...(await original<typeof import("../app/console.ts")>()),
  useConsole: (select: (s: { base: BaseId }) => unknown) => select(picked),
}));

beforeEach(() => {
  picked.base = "moon";
});

describe("center replay, before any 3D has loaded (and for good where it cannot load)", () => {
  it("shows a plain loading card on glass (the cabin has no still picture yet), with no canvas and no button to press first", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/class="stage-loading glass" role="status"/);
    expect(html).not.toContain("stage-poster");
    expect(html).not.toContain("lunar-moon.webp");
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("stage-scene");
    expect(html).not.toMatch(/Load 3D view|role="alert"/);
  });

  it("follows the base in the console store, and never shows the old exterior shot under a cabin caption", () => {
    picked.base = "rover";
    expect(renderToStaticMarkup(<Stage />)).not.toContain("lunar-rover.webp");
    picked.base = "earth";
    const earth = renderToStaticMarkup(<Stage />);
    expect(earth).not.toContain("lunar-iss.webp");
    expect(earth).toContain("a cabin on Earth");
  });

  it("offers three named scenes with fire in this base picked, and no Past / Now", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/name="replay-scene" checked=""\/><span class="stage-pick-opt-name">Fire in this base<\/span>/);
    expect(html).toContain("Lab view: team model burn");
    expect(html).toContain("Real fire: Saffire flight test");
    expect(html).not.toMatch(/>Past<|>Now</);
  });

  it("says it is an illustration on the glass caption, with the longer note behind a real About control", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/class="stage-caption-text glass"><div class="stage-caption-words"><p aria-live="polite">What if a fire starts in [^<]*Illustration, not a simulation\.<\/p>/);
    expect(html).toContain('<summary aria-label="About this replay">');
    expect(html).toContain("No fire experiment on record ran in Moon gravity.");
  });
});

it("one control strip at the bottom, above the bottom bar; the caption alone at the top; menus open upward (18.2)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("./stage.css", import.meta.url), "utf8");
  expect(css).toMatch(/--stage-strip-bottom: calc\(var\(--hud-bar-h/);
  expect(css).toMatch(/\.stage-strip \{[^}]*bottom: var\(--stage-strip-bottom\);/);
  expect(css).toMatch(/--stage-row2: var\(--stage-top\);/);
  expect(css).toMatch(/\.stage-caption \{[^}]*top: var\(--stage-row2\);/);
  // The hint sits above the strip's real height, so it never covers it.
  expect(css).toMatch(/\.stage-nav \{ bottom: calc\(var\(--stage-strip-bottom\) \+ var\(--stage-strip-h/);
  expect(css).toMatch(/\.stage-pick-list \{ top: auto; bottom: calc\(100% \+/);
  expect(css).toMatch(/\.stage-strip \.burn-panel \{[^}]*bottom: calc\(100% \+/);
  // Scene picker, then the scene's own scenario slot, then play, seeker and time.
  const html = renderToStaticMarkup(<Stage />);
  expect(html).toMatch(/class="stage-strip"><details class="stage-pick"[\s\S]*<div class="stage-strip-slot"><\/div>/);
  const src = readFileSync(new URL("./Stage.tsx", import.meta.url), "utf8");
  expect(src).toMatch(/<ScenePicker \/>\s*<div className="stage-strip-slot" \/>\s*<PlayBar \/>/);
});

it("a scene's side panel starts below the caption's real height, never under a long caption", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("./cabin/cabin.css", import.meta.url), "utf8");
  const top = css.match(/\.burn-panel \{[^}]*\n\s*top: ([^;]*);/)?.[1] ?? "";
  expect(top).toContain("var(--stage-caption-h");
});

describe("stage clutter budget (18.2)", () => {
  it("the caption is one line at rest, with the Illustration mark kept in view, and opens in full on press", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("./stage.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.stage-caption-words > p \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
    expect(css).toMatch(/\.stage-caption\[data-open\] \.stage-caption-words > p \{ white-space: normal;/);
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/class="stage-mark-word t-readout"[^>]*>Illustration</);
    expect(html).not.toContain('class="stage-caption" data-open');
  });
  it("a scene's panel is closed at rest at every width, behind one button", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("./cabin/cabin.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.burn-panel \{[^}]*display: none;/);
    expect(css).toContain(".burn[data-open] .burn-panel { display: grid; }");
    expect(css).toMatch(/\.burn-panel \{[^}]*width: min\(22rem/);
  });
  it("Reset view is an icon button with an accessible name and a tooltip", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./Stage.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/className="stage-reset glass" aria-label="Reset view" title="Reset view"/);
  });
  it("in-scene labels are capped at five", async () => {
    const { MAX_CHIPS } = await import("./cabin/Cabin.tsx");
    expect(MAX_CHIPS).toBeLessThanOrEqual(5);
  });
});
