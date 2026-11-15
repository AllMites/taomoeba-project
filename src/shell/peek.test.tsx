import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askAbout, initialConsole, useConsole } from "../app/console.ts";
import { createPeek, modeOf, PEEK_CLOSE_MS, PEEK_OPEN_MS } from "./peek.ts";
import SidePanel, { PanelHead, pinnedOf } from "./SidePanel.tsx";

beforeEach(() => {
  vi.useFakeTimers();
  useConsole.setState({ leftOpen: false, askOpen: false, askAbout: [] });
});
afterEach(() => vi.useRealTimers());

function peekWithLog() {
  const log: boolean[] = [];
  const peek = createPeek((open) => log.push(open));
  return { peek, log };
}

describe("panel states", () => {
  it("pinned wins over peek; without either the panel is minimized", () => {
    expect(modeOf(false, false)).toBe("min");
    expect(modeOf(false, true)).toBe("peek");
    expect(modeOf(true, false)).toBe("pinned");
    expect(modeOf(true, true)).toBe("pinned");
  });

  it("the pointer resting on the strip opens a peek after a short wait; passing over it does not", () => {
    const { peek, log } = peekWithLog();
    peek.pointerEnter();
    vi.advanceTimersByTime(PEEK_OPEN_MS - 10);
    peek.pointerLeave();
    vi.advanceTimersByTime(1000);
    expect(log).toEqual([]);
    peek.pointerEnter();
    vi.advanceTimersByTime(PEEK_OPEN_MS);
    expect(peek.open).toBe(true);
  });

  it("a peek closes a moment after the pointer leaves, and stays if it comes back in time", () => {
    const { peek } = peekWithLog();
    peek.pointerEnter();
    vi.advanceTimersByTime(PEEK_OPEN_MS);
    peek.pointerLeave();
    vi.advanceTimersByTime(PEEK_CLOSE_MS - 50);
    peek.pointerEnter();
    vi.advanceTimersByTime(1000);
    expect(peek.open).toBe(true);
    peek.pointerLeave();
    vi.advanceTimersByTime(PEEK_CLOSE_MS);
    expect(peek.open).toBe(false);
  });

  it("focus inside keeps a peek open when the pointer leaves (typing in Ask), and focus leaving closes it", () => {
    const { peek } = peekWithLog();
    peek.pointerEnter();
    vi.advanceTimersByTime(PEEK_OPEN_MS);
    peek.focusIn(false); // a click into the composer
    peek.pointerLeave();
    vi.advanceTimersByTime(5000);
    expect(peek.open).toBe(true);
    peek.focusOut();
    expect(peek.open).toBe(false);
  });

  it("reaching the strip with the keyboard opens a peek at once; a mouse focus does not", () => {
    const { peek } = peekWithLog();
    peek.focusIn(false);
    expect(peek.open).toBe(false);
    peek.focusIn(true);
    expect(peek.open).toBe(true);
  });

  it("Esc closes a peek, even with focus inside, and is only used up when there was one", () => {
    const { peek } = peekWithLog();
    expect(peek.escape()).toBe(false);
    peek.focusIn(true);
    expect(peek.escape()).toBe(true);
    expect(peek.open).toBe(false);
  });

  it("pinning or unpinning ends the peek and leaves no timer to reopen it", () => {
    const { peek, log } = peekWithLog();
    peek.pointerEnter();
    peek.reset();
    vi.advanceTimersByTime(1000);
    expect(log).toEqual([]);
  });
});

describe("pinned is the store's open flag", () => {
  it("lib=1 and ask=1 pin; askAbout pins Ask", () => {
    expect(initialConsole("?lib=1&ask=0", false)).toMatchObject({ leftOpen: true, askOpen: false });
    expect(pinnedOf({ leftOpen: true, askOpen: false }, "left")).toBe(true);
    askAbout("PSI-69");
    expect(pinnedOf(useConsole.getState(), "ask")).toBe(true);
  });

  it("minimized: the strip is a button that is not expanded, and the panel content is mounted but inert", () => {
    const html = renderToStaticMarkup(
      <SidePanel panel="ask">
        <p id="kept">thread</p>
      </SidePanel>,
    );
    expect(html).toMatch(/<aside class="console-right" aria-label="Ask SI" data-mode="min">/);
    expect(html).toMatch(/<button type="button" class="panel-strip" aria-expanded="false" aria-controls="ask-panel">/);
    expect(html).toMatch(/class="panel-box" inert="">.*id="kept"/);
  });

  it("the header names the panel and puts its own actions before Pin", () => {
    const html = renderToStaticMarkup(<PanelHead panel="ask" headingId="h" actions={<button type="button">New chat</button>} />);
    expect(html).toMatch(/<h2 id="h" class="panel-title t-readout">Ask SI<\/h2>/);
    expect(html.indexOf("New chat")).toBeLessThan(html.indexOf("Pin Ask SI"));
    expect(html).toMatch(/aria-label="Pin Ask SI"[^>]*aria-pressed="false"/);
  });
});

describe("panel CSS", () => {
  const css = readFileSync(new URL("../app/app.css", import.meta.url), "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  it("both panels share one width and one header height", () => {
    expect(css).toContain("--panel-w: 21.25rem");
    expect(css).toMatch(/\.panel-head \{[^}]*height: var\(--panel-head-h\)/);
    expect(css).toContain("--panel-head-h: 3rem");
  });
  it("a peek is an overlay (absolute) and only pinned takes width from the center", () => {
    expect(css).toMatch(/\.panel-box \{[^}]*position: absolute/);
    expect(css).toMatch(/\.console-left\[data-mode="pinned"\], \.console-right\[data-mode="pinned"\] \{ width: var\(--panel-w\); \}/);
  });
  it("the overlay eases only when motion is allowed, and never animates width", () => {
    const motion = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  .panel-box"));
    expect(motion).toMatch(/^@media \(prefers-reduced-motion: no-preference\) \{\s*\.panel-box \{ transition: opacity var\(--motion-fast\)/);
    expect(css).not.toMatch(/transition:[^;]*width/);
  });
});
