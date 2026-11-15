// Layout promises that live in CSS (docs/RESKIN_PRD.md, sections 3 and 8). There is no DOM in these tests, so they
// read the stylesheet: each check names the rule that keeps a promise a real browser showed broken without it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const appCss = read("../app/app.css");

/** The body of an at-rule whose prelude starts with `head`, by brace matching. */
function atRule(css: string, head: string): string {
  const start = css.indexOf(head);
  if (start < 0) throw new Error(`no ${head}`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  throw new Error(`unclosed ${head}`);
}

/** Declarations of every rule in `css` (top level only) whose selector list includes `selector`, merged in order. */
function decls(css: string, selector: string): Record<string, string> {
  const flat = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  const out: Record<string, string> = {};
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]!.split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    for (const d of m[2]!.split(";")) {
      const [k, ...v] = d.split(":");
      if (k && v.length) out[k.trim()] = v.join(":").trim();
    }
  }
  return out;
}

describe("the console never scrolls", () => {
  it("the console and the center clip instead of scrolling, so scrollIntoView cannot shift the replay", () => {
    // A lit card scrolled into view in the Rank sheet used to scroll .console-center by 81px: carousel cut, scrim short.
    expect(decls(appCss, ".console").overflow).toBe("clip");
    expect(decls(appCss, ".console-center").overflow).toBe("clip");
    expect(decls(appCss, ".sheet").overflow).toBe("clip");
  });
  it("an open sheet fills the center and covers the base carousel", () => {
    expect(decls(appCss, ".sheet").inset).toBe("var(--space-3)");
    expect(Number(decls(appCss, ".sheet")["z-index"])).toBeGreaterThan(Number(decls(appCss, ".console-carousel")["z-index"]));
  });
  it("absolute elements inside the panels stay inside them instead of growing the page", () => {
    // The Library's visually hidden heading sat at its static place 2,700px down and made <html> scrollable.
    expect(decls(appCss, ".console").position).toBe("relative");
    expect(decls(appCss, ".console-left").position).toBe("relative");
    expect(decls(appCss, ".console-right").position).toBe("relative");
  });
});

describe("no hue in the UI", () => {
  it("native checkboxes, radios and sliders take the bone white, not the browser's blue", () => {
    // The Research map's link checkboxes and the replay's past/now radios rendered blue.
    expect(decls(read("../styles/base.css"), ":root")["accent-color"]).toBe("var(--color-accent)");
  });
});

describe("phone (390 wide)", () => {
  const phone = atRule(appCss, "@media (max-width: 47.5rem)");
  it("Ask SI opens over a full-screen sheet, so Ask about this in the Rank sheet shows the chat", () => {
    // It opened at z-index 20 under the sheet's 30: the button seemed to do nothing.
    const ask = Number(decls(phone, ".console-right")["z-index"]);
    const sheet = Number(decls(phone, ".sheet.glass")["z-index"]);
    expect(ask).toBeGreaterThan(sheet);
  });
  it("the phone block no longer stacks the brief line and the top 3: the collapsed bar replaces that", () => {
    expect(phone).not.toMatch(/.console-(hud|brief|overlay)/);
  });
  it("the Library and Ask bottom sheets stop under the carousel", () => {
    // At 80dvh they reached 169px from the top, over the carousel that ends at 220px.
    const vars = decls(phone, ".console");
    // The guide bar sits between the top nav and the carousel, so its height comes off too.
    expect(vars["--bottom-sheet-h"]).toMatch(/100dvh - var\(--top-h\) - var\(--guide-h, 0rem\) - var\(--carousel-h\)/);
    expect(decls(phone, ".console-left")["max-height"]).toBe("var(--bottom-sheet-h)");
    expect(decls(phone, ".console-right").height).toBe("var(--bottom-sheet-h)");
  });
});

describe("the HUD collapses on the center's width", () => {
  const collapsed = atRule(appCss, "@container center");
  it("the center is a size container the query is keyed on", () => {
    expect(decls(appCss, ".console-center").container).toBe("center / inline-size");
    expect(appCss).toContain("@container center (min-width: 0)");
    expect(collapsed).toContain(".hud-bar");
  });
  it("while collapsed, the stage ends above the bar, so nothing in the replay sits under it", () => {
    // 1280x720 with both panels pinned, and a phone: the cards used to cover the playback bar and the scene picker.
    expect(decls(collapsed, ".console-center > .stage").inset).toBe("0 0 var(--hud-bar-h) 0");
    expect(decls(appCss, ".console-center")["--hud-bar-h"]).toBe("3rem");
    expect(decls(collapsed, ".hud-bar").height).toBe("var(--hud-bar-h)");
  });
  it("the bar is the layout at every center width: the cards never sit open over the replay at rest", () => {
    expect(appCss).not.toMatch(/@container center \(max-width/);
    expect(collapsed).toMatch(/\.console-brief, \.console-overlay \{\s*display: none;/);
    expect(collapsed).toContain('.console-hud[data-open="brief"] .console-brief');
  });
});

describe("mid widths and phone landscape (769 to 1100 wide)", () => {
  const mid = atRule(appCss, "@media (min-width: 47.5625rem) and (max-width: 68.75rem)");
  it("the nav scrolls sideways instead of running under the Ask SI pill", () => {
    // At 768x1024 and 844x390 "Research map" covered the centre of the Ask SI pill.
    expect(decls(mid, ".console-nav")["overflow-x"]).toBe("auto");
  });
  it("on a short screen a panel rises to the top of the center", () => {
    // At 844x390 the Library under the carousel kept 94px for its content.
    const short = atRule(appCss, "@media (min-width: 47.5625rem) and (max-width: 68.75rem) and (max-height: 30rem)");
    expect(decls(short, '[data-mode="pinned"] > .panel-box').top).toBe("var(--space-3)");
  });
});

describe("touch screens", () => {
  it("fields are at least 16px on touch, phone and phone landscape, so iOS does not zoom on focus", () => {
    // The Rank search measured 14px, the Compare selects and the replay's selects too, at every phone size.
    const touch = atRule(read("../styles/base.css"), "@media (pointer: coarse), (max-width: 47.5rem), (max-height: 30rem)");
    expect(touch).toMatch(/select, textarea \{\s*font-size: max\(1rem, 1em\) !important;/);
  });
  it("the Rank and Compare text buttons are 44px tall on touch and narrow screens", () => {
    const rk = atRule(read("../ranking/ranking.css"), "@media (pointer: coarse), (max-width: 68.75rem)");
    expect(decls(rk, ".rk-how summary")["line-height"]).toBe("2.75rem");
    const cmp = atRule(read("../compare/compare.css"), "@media (pointer: coarse), (max-width: 68.75rem)");
    expect(decls(cmp, ".cmp-open")["min-height"]).toBe("2.75rem");
    expect(decls(cmp, ".cmp-open")["min-width"]).toBe("2.75rem");
  });
  it("on a phone the Compare table fits the screen, so the second experiment is not hidden off to the right", () => {
    const phone = atRule(read("../compare/compare.css"), "@media (max-width: 40rem)");
    expect(decls(phone, ".cmp-table")["min-width"]).toBe("0");
  });
});
