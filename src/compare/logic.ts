import type { Investigation } from "../contracts/index.ts";
import { formatRange } from "../evidence/logic.ts";

// Compare two experiments attribute by attribute, straight from investigations.json.

const NOT = "Not on record";
const list = (xs: string[]) => (xs.length ? xs.join(", ") : NOT);
const varied = (i: Investigation, v: boolean) => i.variables.filter((x) => x.varies === v).map((x) => x.name);

export type Row = { label: string; a: string; b: string; same: boolean; shared?: string[] };

const ROWS: { label: string; get: (i: Investigation) => string; items?: (i: Investigation) => string[] }[] = [
  { label: "Hardware family", get: (i) => i.hardwareGroup },
  { label: "Hardware (as recorded)", get: (i) => i.hardware || NOT },
  { label: "Fire-safety area", get: (i) => i.pds },
  { label: "Where it ran", get: (i) => (i.evidence === "ground" ? "Ground test or computer model" : i.evidence === "flight" ? "In microgravity" : NOT) },
  { label: "Fuel type", get: (i) => i.fuelKind },
  { label: "Fuel", get: (i) => i.fuel || NOT },
  { label: "Sample or burner", get: (i) => i.sampleShape || NOT },
  { label: "Oxygen", get: (i) => formatRange(i.o2Range, "%") ?? NOT },
  { label: "Pressure", get: (i) => formatRange(i.pressureRange, "kPa") ?? NOT },
  { label: "Airflow", get: (i) => formatRange(i.airflowRange, "cm/s") ?? NOT },
  { label: "What varied", get: (i) => list(varied(i, true)), items: (i) => varied(i, true) },
  { label: "Held fixed", get: (i) => list(varied(i, false)), items: (i) => varied(i, false) },
  { label: "Sensors", get: (i) => list(i.sensors), items: (i) => i.sensors },
  { label: "Measurements", get: (i) => list(i.measurements), items: (i) => i.measurements },
  { label: "Run table", get: (i) => (i.runs ? `${i.runs.rows} runs, ${i.runs.columns.length} columns` : "No run table") },
  { label: "Objectives", get: (i) => i.objectives || NOT },
];

const norm = (s: string) => s.trim().toLowerCase();

export function compareRows(a: Investigation, b: Investigation): Row[] {
  return ROWS.map((r) => {
    const va = r.get(a);
    const vb = r.get(b);
    const row: Row = { label: r.label, a: va, b: vb, same: norm(va) === norm(vb) };
    if (r.items && !row.same) {
      const bs = new Set(r.items(b).map(norm));
      const shared = r.items(a).filter((x) => bs.has(norm(x)));
      if (shared.length) row.shared = shared;
    }
    return row;
  });
}

/** Hardware families in the order the brief lists them, then the rest. */
export function families(invs: Investigation[]): string[] {
  const seen = [...new Set(invs.map((i) => i.hardwareGroup))];
  const first = ["ACME (CIR)", "MDCA (CIR)", "MSG flow duct"];
  return [...first.filter((f) => seen.includes(f)), ...seen.filter((f) => !first.includes(f)).sort()];
}
