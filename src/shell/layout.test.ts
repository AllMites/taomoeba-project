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
    expect(vars["--bottom-sheet-h"]).toMatch(/100dvh - var\(--top-h\) - var\(--carousel-h\)/);
    expect(decls(phone, ".console-left")["max-height"]).toBe("var(--bottom-sheet-h)");
    expect(decls(phone, ".console-right").height).toBe("var(--bottom-sheet-h)");
  });
});

describe("the HUD collapses on the center's width", () => {
  const collapsed = atRule(appCss, "@container center");
  it("the center is a size container the query is keyed on", () => {
    expect(decls(appCss, ".console-center").container).toBe("center / inline-size");
    expect(appCss).toContain("@container center (max-width: 60rem)");
    expect(collapsed).toContain(".hud-bar");
  });
  it("while collapsed, the stage ends above the bar, so nothing in the replay sits under it", () => {
    // 1280x720 with both panels pinned, and a phone: the cards used to cover the playback bar and the scene picker.
    expect(decls(collapsed, ".console-center > .stage").inset).toBe("0 0 var(--hud-bar-h) 0");
    expect(decls(appCss, ".console-center")["--hud-bar-h"]).toBe("3rem");
    expect(decls(collapsed, ".hud-bar").height).toBe("var(--hud-bar-h)");
  });
  it("the bar is hidden on a wide center, which keeps today's layout", () => {
    const wide = appCss.replace(collapsed, "");
    expect(decls(wide, ".hud-bar").display).toBe("none");
    expect(decls(wide, ".hud-close").display).toBe("none");
  });
});
