import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WhatIfView, startSel } from "./index.tsx";
import { habitatPoint, indexOf, isMoonLike, nearest, o2Curve, parseDoc, predict, support, type Sel } from "./logic.ts";

// The real grid shipped to the site (public/data/whatif.json, made by the model package's 06_whatif_grid.py).
const doc = parseDoc(JSON.parse(readFileSync(`${process.cwd()}/public/data/whatif.json`, "utf8")))!;
const at = (fuel: string, dil: string, o2: number, p: number, d0: number): Sel => ({
  fuel: doc.axes.fuel.indexOf(fuel),
  diluent: doc.axes.diluent.indexOf(dil),
  o2: nearest(doc.axes.o2, o2),
  p: nearest(doc.axes.p_mmHg, p),
  d0: nearest(doc.axes.d0, d0),
});

describe("what-if grid", () => {
  it("loads complete; a broken or incomplete grid is refused", () => {
    expect(doc).not.toBeNull();
    expect(parseDoc({ ...doc, points: doc.points.slice(1) })).toBeNull();
    expect(parseDoc({ hello: 1 })).toBeNull();
  });
  it("looks up the same numbers the model package printed (predict.flex_refined)", () => {
    // values printed by the model package for these exact inputs
    expect(predict(doc, at("methanol", "n2", 0.21, 760, 2.0))).toMatchObject({ extDiameterMm: 0.81, pDisruption: 0.276, similarRuns: 6, inRange: true });
    expect(predict(doc, at("methanol", "n2", 0.3, 527.5, 2.0))).toMatchObject({ extDiameterMm: 0.31, pDisruption: 0.892, similarRuns: 0 });
    expect(predict(doc, at("heptane", "he", 0.15, 1000, 3.0))).toMatchObject({ extDiameterMm: 2.19, pDisruption: 0.019 });
  });
  it("every index is inside the grid and distinct", () => {
    const a = doc.axes;
    const last = indexOf(doc, { fuel: a.fuel.length - 1, diluent: a.diluent.length - 1, o2: a.o2.length - 1, p: a.p_mmHg.length - 1, d0: a.d0.length - 1 });
    expect(last).toBe(doc.points.length - 1);
  });
  it("physics holds across the grid: bigger droplets never go out smaller, more oxygen raises the chance of break-up", () => {
    const a = doc.axes;
    for (let f = 0; f < a.fuel.length; f++)
      for (let d = 0; d < a.diluent.length; d++)
        for (let p = 0; p < a.p_mmHg.length; p++) {
          for (let o = 0; o < a.o2.length; o++)
            for (let s = 1; s < a.d0.length; s++)
              expect(predict(doc, { fuel: f, diluent: d, o2: o, p, d0: s }).extDiameterMm).toBeGreaterThanOrEqual(
                predict(doc, { fuel: f, diluent: d, o2: o, p, d0: s - 1 }).extDiameterMm,
              );
          const c = o2Curve(doc, { fuel: f, diluent: d, o2: 0, p, d0: 1 });
          for (let i = 1; i < c.length; i++) expect(c[i].p).toBeGreaterThanOrEqual(c[i - 1].p);
        }
  });
  it("support level in plain words", () => {
    expect(support(predict(doc, at("methanol", "n2", 0.21, 760, 2.0))).level).toBe("good");
    expect(support(predict(doc, at("methanol", "n2", 0.3, 527.5, 2.0))).level).toBe("sparse");
    expect(support({ extDiameterMm: 1, bandMm: [0, 2], pDisruption: 0.1, burningRate: 0.5, inRange: false, similarRuns: 0 }).level).toBe("out");
  });
  it("habitats map to the grid; the suit's 100% oxygen does not", () => {
    expect(habitatPoint(doc, 21, 101.3)).toEqual({ o2: nearest(doc.axes.o2, 0.21), p: nearest(doc.axes.p_mmHg, 760) });
    expect(habitatPoint(doc, 30, 70.3)).toEqual({ o2: nearest(doc.axes.o2, 0.3), p: nearest(doc.axes.p_mmHg, 527.5) });
    expect(habitatPoint(doc, 100, 29.6)).toBeNull();
    expect(isMoonLike(doc, at("methanol", "n2", 0.3, 527.5, 2))).toBe(true);
    expect(isMoonLike(doc, at("methanol", "n2", 0.21, 760, 2))).toBe(false);
  });
});

describe("what-if view", () => {
  const noop = () => {};
  it("shows the three predictions, their honesty notes and labelled controls", () => {
    const html = renderToStaticMarkup(<WhatIfView doc={doc} sel={startSel(doc)} onChange={noop} />);
    expect(html).toContain("0.81 mm");
    expect(html).toContain("28%"); // chance of break-up at the start point
    expect(html).toContain("mm²/s");
    expect(html).toContain("These are predictions, not");
    expect(html).toContain("similar real runs");
    expect(html).toMatch(/<label class="whatif-field"><span>Pressure<\/span><select/);
    expect(html).toContain('role="img"');
  });
  it("warns at Moon-Base air and offers habitat air only when the models cover it", () => {
    const moon = renderToStaticMarkup(<WhatIfView doc={doc} sel={at("methanol", "n2", 0.3, 527.5, 2)} onChange={noop} habitat={{ label: "Moon Base", apply: noop }} />);
    expect(moon).toContain("not valid here");
    expect(moon).toContain("whatif-dim");
    expect(moon).toContain("no similar real run exists");
    expect(moon).toContain("Use Moon Base air");
    const suit = renderToStaticMarkup(<WhatIfView doc={doc} sel={startSel(doc)} onChange={noop} habitat={{ label: "Suit reference", apply: null }} />);
    expect(suit).toContain("outside what FLEX tested");
  });
});
