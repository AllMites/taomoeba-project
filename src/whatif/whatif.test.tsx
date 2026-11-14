import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WhatIfView, startSel } from "./index.tsx";
import {
  effects,
  habitatPoint,
  indexOf,
  isMoonLike,
  mixesOf,
  nearest,
  o2Curve,
  parseDoc,
  predict,
  signed,
  support,
  type Gas,
  type Sel,
} from "./logic.ts";

// The real grid shipped to the site (public/data/whatif.json, made by the model package's 06_whatif_grid.py).
const doc = parseDoc(JSON.parse(readFileSync(`${process.cwd()}/public/data/whatif.json`, "utf8")))!;
const mixAt = (gas: Gas, amount: number) => mixesOf(doc, gas).find((i) => Math.abs(doc.axes.mix[i].amount - amount) < 1e-9)!;
const at = (fuel: string, gas: Gas, amount: number, o2: number, p: number, d0: number): Sel => ({
  fuel: doc.axes.fuel.indexOf(fuel),
  mix: mixAt(gas, amount),
  o2: nearest(doc.axes.o2, o2),
  p: nearest(doc.axes.p_mmHg, p),
  d0: nearest(doc.axes.d0, d0),
});
const ok = (s: Sel) => {
  const r = predict(doc, s);
  if (!r.possible) throw new Error("impossible point");
  return r;
};

describe("what-if grid", () => {
  it("loads complete; a broken or incomplete grid is refused", () => {
    expect(doc).not.toBeNull();
    expect(parseDoc({ ...doc, values: doc.values.slice(6) })).toBeNull();
    expect(parseDoc({ hello: 1 })).toBeNull();
  });
  it("looks up the numbers the model package prints (predict.flex_refined) for the same inputs", () => {
    expect(ok(at("methanol", "n2", 0, 0.21, 760, 2.0))).toMatchObject({ extDiameterMm: 0.81, pDisruption: 0.276, similarRuns: 6, inRange: true });
    expect(ok(at("methanol", "n2", 0, 0.3, 527.5, 2.0))).toMatchObject({ extDiameterMm: 0.31, pDisruption: 0.892, similarRuns: 0 });
    expect(ok(at("heptane", "he", 0.2, 0.15, 1000, 3.0))).toMatchObject({ extDiameterMm: 2.19, pDisruption: 0.019, similarRuns: 0 });
    expect(ok(at("methanol", "co2", 0.2, 0.2, 760, 3.0))).toMatchObject({ extDiameterMm: 1.25, pDisruption: 0.107, similarRuns: 0 });
  });
  it("the last index is the last point", () => {
    const a = doc.axes;
    const last = indexOf(doc, { fuel: a.fuel.length - 1, mix: a.mix.length - 1, o2: a.o2.length - 1, p: a.p_mmHg.length - 1, d0: a.d0.length - 1 });
    expect((last + 1) * 6).toBe(doc.values.length);
  });
  it("mixes with more than 100% gas are marked impossible, and only those", () => {
    expect(predict(doc, at("methanol", "co2", 0.7, 0.34, 760, 2)).possible).toBe(false);
    expect(predict(doc, at("methanol", "co2", 0.7, 0.3, 760, 2)).possible).toBe(true);
    expect(support(predict(doc, at("methanol", "co2", 0.7, 0.34, 760, 2))).level).toBe("impossible");
  });
  it("physics holds across the grid: bigger droplets never go out smaller, more oxygen never lowers the chance of break-up", () => {
    const a = doc.axes;
    for (let f = 0; f < a.fuel.length; f++)
      for (let mx = 0; mx < a.mix.length; mx++)
        for (let p = 0; p < a.p_mmHg.length; p++) {
          for (let o = 0; o < a.o2.length; o++)
            for (let s = 1; s < a.d0.length; s++) {
              const hi = predict(doc, { fuel: f, mix: mx, o2: o, p, d0: s });
              const lo = predict(doc, { fuel: f, mix: mx, o2: o, p, d0: s - 1 });
              if (hi.possible && lo.possible) expect(hi.extDiameterMm).toBeGreaterThanOrEqual(lo.extDiameterMm);
            }
          const c = o2Curve(doc, { fuel: f, mix: mx, o2: 0, p, d0: 1 }).filter((q) => q.p !== null);
          for (let i = 1; i < c.length; i++) expect(c[i].p!).toBeGreaterThanOrEqual(c[i - 1].p!);
        }
  });
  it("data support in plain words, including combinations FLEX never tested", () => {
    expect(support(ok(at("methanol", "n2", 0, 0.21, 760, 2.0))).level).toBe("good");
    expect(support(ok(at("methanol", "n2", 0, 0.3, 527.5, 2.0))).level).toBe("sparse");
    expect(support(ok(at("methanol", "n2", 0, 0.21, 2280, 2.0))).level).toBe("far"); // air at 3 atm: never tested
    expect(support(ok(at("methanol", "co2", 0.4, 0.3, 760, 2.0))).level).toBe("far"); // CO2 was only added at <= 25% O2
  });
  it("habitats map to the grid; the suit's 100% oxygen does not", () => {
    expect(habitatPoint(doc, 21, 101.3)).toEqual({ o2: nearest(doc.axes.o2, 0.21), p: nearest(doc.axes.p_mmHg, 760) });
    expect(habitatPoint(doc, 30, 70.3)).toEqual({ o2: nearest(doc.axes.o2, 0.3), p: nearest(doc.axes.p_mmHg, 527.5) });
    expect(habitatPoint(doc, 100, 29.6)).toBeNull();
    expect(isMoonLike(doc, at("methanol", "n2", 0, 0.3, 527.5, 2))).toBe(true);
    expect(isMoonLike(doc, at("methanol", "n2", 0, 0.21, 760, 2))).toBe(false);
  });
});

describe("what matters most here", () => {
  it("each row is the real difference between two grid points", () => {
    const s = at("methanol", "n2", 0, 0.21, 760, 2.0);
    const rows = effects(doc, s);
    expect(rows.map((r) => r.change)).toEqual([
      "+5% oxygen (to 26%)",
      "Pressure 760 → 1000 mmHg",
      "Droplet 2 → 2.5 mm",
      "Add 10% CO₂",
      "Add 10% helium",
      "Switch to heptane",
    ]);
    const o2 = rows[0];
    expect(o2.dChance).toBe(Math.round((ok(o2.to).pDisruption - ok(s).pDisruption) * 100));
    expect(o2.dChance!).toBeGreaterThan(0); // more oxygen, more break-ups
    expect(rows[2].dExt!).toBeGreaterThanOrEqual(0); // bigger droplet, flame goes out no smaller
  });
  it("at the top of a range it steps down instead, and flags steps into untested combinations", () => {
    const s = at("methanol", "co2", 0.7, 0.21, 2280, 4.0);
    const rows = effects(doc, s);
    expect(rows.find((r) => r.change.startsWith("Droplet"))!.change).toBe("Droplet 4 → 3.5 mm");
    expect(rows.find((r) => r.change.startsWith("CO₂"))!.change).toBe("CO₂ 70% → 60%");
    const far = effects(doc, at("methanol", "n2", 0, 0.21, 1520, 2.0)).find((r) => r.change.startsWith("Pressure"))!;
    expect(far.note).toBe("no FLEX run near that point");
  });
  it("signed differences read naturally", () => {
    expect(signed(18, "pts")).toBe("+18 pts");
    expect(signed(-0.123, "mm", 2)).toBe("−0.12 mm");
    expect(signed(0.001, "mm", 2)).toBe("no change");
  });
});

describe("what-if view", () => {
  const noop = () => {};
  it("shows the predictions, honesty notes, the effects table and labelled controls", () => {
    const html = renderToStaticMarkup(<WhatIfView doc={doc} sel={startSel(doc)} onChange={noop} onPin={noop} pinned={null} />);
    expect(html).toContain("0.81 mm");
    expect(html).toContain("28%");
    expect(html).toContain("mm²/s");
    expect(html).toContain("These are predictions, not");
    expect(html).toContain("What matters most here");
    expect(html).toContain("Pin to compare");
    expect(html).toMatch(/<label class="whatif-field"><span>Pressure<\/span><select/);
    expect(html).not.toContain("Carbon dioxide <b"); // the amount slider only shows when a gas is added
  });
  it("shows the CO2 amount slider when CO2 is added", () => {
    const html = renderToStaticMarkup(<WhatIfView doc={doc} sel={at("methanol", "co2", 0.2, 0.2, 760, 3)} onChange={noop} />);
    expect(html).toContain("Carbon dioxide");
    expect(html).toContain("20%");
  });
  it("compares a pinned setting with the current one", () => {
    const a = at("methanol", "n2", 0, 0.21, 760, 2);
    const b = at("methanol", "n2", 0, 0.3, 527.5, 2);
    const html = renderToStaticMarkup(<WhatIfView doc={doc} sel={b} onChange={noop} pinned={a} onPin={noop} />);
    expect(html).toContain("Pinned vs now");
    expect(html).toContain("+62 pts"); // 27.6% -> 89.2%
    expect(html).toContain("Stop comparing");
    expect(html).toContain("many similar runs");
  });
  it("an impossible mix shows only the explanation", () => {
    const html = renderToStaticMarkup(<WhatIfView doc={doc} sel={at("methanol", "co2", 0.7, 0.34, 760, 2)} onChange={noop} />);
    expect(html).toContain("not possible");
    expect(html).not.toContain("What matters most here");
  });
  it("warns at Moon-Base air and offers habitat air only when the models cover it", () => {
    const moon = renderToStaticMarkup(
      <WhatIfView doc={doc} sel={at("methanol", "n2", 0, 0.3, 527.5, 2)} onChange={noop} habitat={{ label: "Moon Base", apply: noop }} />,
    );
    expect(moon).toContain("not valid here");
    expect(moon).toContain("whatif-dim");
    expect(moon).toContain("Use Moon Base air");
    const suit = renderToStaticMarkup(<WhatIfView doc={doc} sel={startSel(doc)} onChange={noop} habitat={{ label: "Suit reference", apply: null }} />);
    expect(suit).toContain("outside what FLEX tested");
  });
});
