import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useStore } from "../app/store.ts";
import { ASK_ABOUT_QUESTIONS, askAbout } from "./askAbout.ts";
import { CSV_COLUMNS, csvRow, oxygenSweep, toCsv } from "./csv.ts";
import { WhatIfView, startSel } from "./index.tsx";
import { mixesOf, nearest, parseDoc, predict, type Gas, type Sel } from "./logic.ts";

const doc = parseDoc(JSON.parse(readFileSync(`${process.cwd()}/public/data/whatif.json`, "utf8")))!;
const at = (fuel: string, gas: Gas, amount: number, o2: number, p: number, d0: number): Sel => ({
  fuel: doc.axes.fuel.indexOf(fuel),
  mix: mixesOf(doc, gas).find((i) => Math.abs(doc.axes.mix[i].amount - amount) < 1e-9)!,
  o2: nearest(doc.axes.o2, o2),
  p: nearest(doc.axes.p_mmHg, p),
  d0: nearest(doc.axes.d0, d0),
});

describe("CSV export", () => {
  const s = startSel(doc);
  it("one row per setting, every column filled from the grid, notes name the models", () => {
    const csv = toCsv(doc, [{ sel: s, label: "current" }]);
    const lines = csv.trim().split("\n");
    const notes = lines.filter((l) => l.startsWith("#"));
    expect(notes.join(" ")).toContain(doc.models.burning_rate.name);
    expect(notes.join(" ")).toContain("not data");
    const header = lines[notes.length].split(",");
    expect(header).toEqual([...CSV_COLUMNS]);
    const row = lines[notes.length + 1].split(",");
    expect(row).toHaveLength(CSV_COLUMNS.length);
    const p = predict(doc, s);
    if (!p.possible) throw new Error("start point must be possible");
    expect(Number(row[header.indexOf("burning_rate_mm2_s")])).toBe(p.burningRate);
    expect(Number(row[header.indexOf("ext_diameter_mm")])).toBe(p.extDiameterMm);
    expect(row[header.indexOf("added_gas")]).toBe("none");
  });
  it("the oxygen sweep has one row per oxygen level; impossible mixes say so and leave numbers empty", () => {
    const rows = oxygenSweep(doc, at("methanol", "co2", 0.7, 0.21, 760, 2));
    expect(rows).toHaveLength(doc.axes.o2.length);
    const last = csvRow(doc, rows[rows.length - 1].sel, "x");
    expect(last).toContain("not a possible mix");
    expect(last[CSV_COLUMNS.indexOf("ext_diameter_mm")]).toBeNull();
  });
});

describe("ask about this setting", () => {
  it("picks questions from the fixed list, up to three, by gas, condition and physics", () => {
    const air = askAbout(doc, startSel(doc));
    expect(air[0]).toBe("What did FLEX find about methanol droplet flames?");
    expect(air).toContain("How do measured burning rates compare with droplet combustion theory?");
    expect(askAbout(doc, at("heptane", "he", 0.2, 0.2, 760, 2))[0]).toBe("Does helium change droplet extinction?");
    expect(askAbout(doc, at("methanol", "co2", 0.2, 0.2, 760, 2))[0]).toBe("How does carbon dioxide affect droplet flames?");
    expect(askAbout(doc, at("methanol", "n2", 0, 0.3, 527.5, 2))).toContain("Can we trust the model predictions for a Moon base?");
    for (let f = 0; f < 2; f++)
      for (let m = 0; m < doc.axes.mix.length; m++)
        for (const o2 of [0, 9, 18, 22])
          for (let p = 0; p < doc.axes.p_mmHg.length; p++) {
            const qs = askAbout(doc, { fuel: f, mix: m, o2, p, d0: 1 });
            expect(qs.length).toBeLessThanOrEqual(3);
            for (const q of qs) expect(ASK_ABOUT_QUESTIONS).toContain(q);
          }
  });
  it("every chip question is in the demo save list, so each one can have a saved answer", () => {
    const save = readFileSync(`${process.cwd()}/scripts/rag/save_answers.mjs`, "utf8");
    for (const q of ASK_ABOUT_QUESTIONS) expect(save).toContain(`"${q}"`);
  });
  it("the store hands the question to the Ask box; repeats are distinct", () => {
    const st = useStore.getState();
    st.requestAsk?.("Does helium change droplet extinction?");
    const first = useStore.getState().askRequest!;
    st.requestAsk?.("Does helium change droplet extinction?");
    expect(useStore.getState().askRequest!.n).toBe(first.n + 1);
    useStore.getState().clearAskRequest?.();
    expect(useStore.getState().askRequest).toBeNull();
  });
  it("renders the chips and both downloads; no chips without an Ask box", () => {
    const html = renderToStaticMarkup(<WhatIfView doc={doc} sel={startSel(doc)} onChange={() => {}} onAsk={() => {}} />);
    expect(html).toContain("Take it further");
    expect(html).toContain("What did FLEX find about methanol droplet flames?");
    expect(html).toContain("Download this setting (CSV)");
    expect(html).toContain("oxygen sweep");
    const bare = renderToStaticMarkup(<WhatIfView doc={doc} sel={startSel(doc)} onChange={() => {}} />);
    expect(bare).not.toContain("Ask the records about this setting");
  });
});
