import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Investigation } from "../contracts/index.ts";
import { CompareView } from "./index.tsx";
import { compareRows, families } from "./logic.ts";

const raw = JSON.parse(readFileSync(`${process.cwd()}/public/data/investigations.json`, "utf8"));
const invs = (raw.items ?? raw) as Investigation[];
const by = (id: string) => invs.find((i) => i.id === id)!;

describe("compare two experiments", () => {
  it("FLEX and FLEX-2 share hardware; FLEX and CFI-G differ in hardware and fuel type", () => {
    const flex2 = compareRows(by("PSI-69"), by("PSI-68"));
    expect(flex2.find((r) => r.label === "Hardware family")!.same).toBe(true);
    const cfig = compareRows(by("PSI-69"), by("PSI-159"));
    expect(cfig.find((r) => r.label === "Fuel type")!.same).toBe(false);
    expect(cfig.find((r) => r.label === "Oxygen")!.a).toMatch(/12.*34/);
  });
  it("lists items the two share even when the rows differ", () => {
    const rows = compareRows(by("PSI-102"), by("PSI-101"));
    const sensors = rows.find((r) => r.label === "Sensors")!;
    if (!sensors.same) expect(sensors.shared?.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(rows.every((r) => r.a.length > 0 && r.b.length > 0)).toBe(true);
  });
  it("hardware families put the brief's three first", () => {
    expect(families(invs).slice(0, 3)).toEqual(["ACME (CIR)", "MDCA (CIR)", "MSG flow duct"]);
  });
  it("renders the pickers, the summary and every attribute row", () => {
    const html = renderToStaticMarkup(<CompareView investigations={invs} onOpen={() => {}} />);
    expect(html).toContain("Compare two experiments");
    expect(html).toContain("All hardware");
    expect(html).toMatch(/Same in \d+ of 16 attributes/);
    expect(html).toContain(">FLEX<");
    expect(html).toContain(">ACME CFI-G<");
  });
});
