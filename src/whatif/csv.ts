import { gravityFactor, LEVEL_LABEL, predict, support, theoryRate, type Sel, type WhatIfDoc } from "./logic.ts";

// Download what the tool shows as a CSV, with the model names and how much data supports each row, so a researcher
// can take the numbers away without losing what they are.

export const CSV_COLUMNS = [
  "label",
  "fuel",
  "o2_fraction",
  "added_gas",
  "added_gas_fraction",
  "pressure_mmHg",
  "droplet_d0_mm",
  "ext_diameter_mm",
  "ext_band_low_mm",
  "ext_band_high_mm",
  "p_disruption",
  "burning_rate_mm2_s",
  "textbook_burning_rate_mm2_s",
  "theory_gravity_factor_moon",
  "theory_gravity_factor_earth",
  "data_support",
  "similar_flex_runs",
  "nearby_flex_runs",
] as const;

const cell = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function csvRow(doc: WhatIfDoc, s: Sel, label: string): (string | number | null)[] {
  const a = doc.axes;
  const m = a.mix[s.mix];
  const base = [label, a.fuel[s.fuel], a.o2[s.o2], m.gas === "n2" ? "none" : m.gas, m.amount, a.p_mmHg[s.p], a.d0[s.d0]];
  const p = predict(doc, s);
  if (!p.possible) return [...base, null, null, null, null, null, null, null, null, LEVEL_LABEL.impossible, null, null];
  return [
    ...base,
    p.extDiameterMm,
    p.bandMm[0],
    p.bandMm[1],
    p.pDisruption,
    p.burningRate,
    theoryRate(doc, s),
    gravityFactor(doc, s, "moon"),
    gravityFactor(doc, s, "earth"),
    LEVEL_LABEL[support(p).level],
    p.similarRuns,
    p.nearbyRuns,
  ];
}

/** Notes first (lines starting with #), then the header and one row per setting. */
export function toCsv(doc: WhatIfDoc, rows: { sel: Sel; label: string }[]): string {
  const m = doc.models;
  const notes = [
    `# Flame in Freefall what-if export. ${doc.about}`,
    `# Grid made ${doc.made}. Models: extinction diameter = ${m.ext_diameter.name} (RMSE ${m.ext_diameter.rmse_mm} mm, band covered ${Math.round(m.ext_diameter.band_coverage * 100)}% on held-out test days); disruption = ${m.disruption.name} (AUC ${m.disruption.auc}); burning rate = ${m.burning_rate.name} (RMSE ${m.burning_rate.rmse} ${m.burning_rate.unit}).`,
    "# textbook_* and theory_* columns are classical droplet theory and a buoyancy scaling estimate, not data. Data source: NASA PSI FLEX (PSI-69).",
  ];
  const body = rows.map((r) => csvRow(doc, r.sel, r.label).map(cell).join(","));
  return [...notes, CSV_COLUMNS.join(","), ...body].join("\n") + "\n";
}

/** Every oxygen level of the grid with the other choices fixed. */
export const oxygenSweep = (doc: WhatIfDoc, s: Sel) => doc.axes.o2.map((_, i) => ({ sel: { ...s, o2: i }, label: "oxygen sweep" }));

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
