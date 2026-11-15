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
  it("absolute elements inside the panels stay inside them instead of growing the page", () => {
    // The Library's visually hidden heading sat at its static place 2,700px down and made <html> scrollable.
    expect(decls(appCss, ".console").position).toBe("relative");
    expect(decls(appCss, ".console-left").position).toBe("relative");
    expect(decls(appCss, ".console-right").position).toBe("relative");
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
  it("the Library and Ask bottom sheets stop under the carousel", () => {
    // At 80dvh they reached 169px from the top, over the carousel that ends at 220px.
    const vars = decls(phone, ".console");
    expect(vars["--bottom-sheet-h"]).toMatch(/100dvh - var\(--top-h\) - var\(--carousel-h\)/);
    expect(decls(phone, ".console-left")["max-height"]).toBe("var(--bottom-sheet-h)");
    expect(decls(phone, ".console-right").height).toBe("var(--bottom-sheet-h)");
  });
});
