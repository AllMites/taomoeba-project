import type { HabitatPreset, Investigation } from "../contracts/index.ts";
import { habitatPoint, predict, support, type WhatIfDoc } from "../whatif/logic.ts";

// "What to test next": where the PSI record runs out for one habitat's air. Every line is computed from the
// experiments' tested ranges (investigations.json) and the team's FLEX grid (whatif.json); nothing is typed in by hand
// except the names of NASA's planned experiments, which come from the challenge brief.

/** Oxygen within 1 percentage point, pressure within 5%: a tested range "covers" the habitat's air. */
const inO2 = (r: readonly [number, number] | null, o2: number) => !!r && o2 >= r[0] - 1 && o2 <= r[1] + 1;
const inP = (r: readonly [number, number] | null, p: number) => !!r && p >= r[0] * 0.95 && p <= r[1] * 1.05;

export type Coverage = {
  both: Investigation[]; // oxygen and pressure both tested around this air
  o2Only: Investigation[]; // oxygen tested here, pressure not on record or outside
  notOnRecord: number; // experiments with no oxygen range on record
  solidsWithO2: number; // solid-material experiments with an oxygen range on record
  solidsCovering: Investigation[]; // solid-material experiments whose oxygen range covers this air
  maxSolidO2: number | null; // highest oxygen any solid-material experiment tested
};

export function coverage(h: Pick<HabitatPreset, "o2Percent" | "pressureKPa">, invs: Investigation[]): Coverage {
  const fire = invs.filter((i) => i.pds !== "Other");
  const solids = fire.filter((i) => i.fuelKind === "solid" && i.o2Range);
  return {
    both: fire.filter((i) => inO2(i.o2Range, h.o2Percent) && inP(i.pressureRange, h.pressureKPa)),
    o2Only: fire.filter((i) => inO2(i.o2Range, h.o2Percent) && !inP(i.pressureRange, h.pressureKPa)),
    notOnRecord: fire.filter((i) => !i.o2Range).length,
    solidsWithO2: solids.length,
    solidsCovering: solids.filter((i) => inO2(i.o2Range, h.o2Percent)),
    maxSolidO2: solids.length ? Math.max(...solids.map((i) => i.o2Range![1])) : null,
  };
}

export type FlexNear = { fuel: string; similar: number; nearby: number }[] | null;

/** Real FLEX runs close to this air for a 2 mm droplet in O2/N2, from the grid's own neighbourhood counts. */
export function flexNear(doc: WhatIfDoc | null, h: Pick<HabitatPreset, "o2Percent" | "pressureKPa">): FlexNear {
  if (!doc) return null;
  const hp = habitatPoint(doc, h.o2Percent, h.pressureKPa);
  if (!hp) return null;
  const n2 = doc.axes.mix.findIndex((m) => m.gas === "n2");
  const d0 = doc.axes.d0.reduce((b, x, i) => (Math.abs(x - 2) < Math.abs(doc.axes.d0[b] - 2) ? i : b), 0);
  return doc.axes.fuel.map((fuel, f) => {
    const p = predict(doc, { fuel: f, mix: n2, o2: hp.o2, p: hp.p, d0 });
    return p.possible ? { fuel, similar: p.similarRuns, nearby: p.nearbyRuns } : { fuel, similar: 0, nearby: 0 };
  });
}

export const PLANNED = {
  luci: { name: "Lunar-g Combustion Investigation (LUCI)", url: null as string | null },
  fm2: {
    name: "Flammability of Materials on the Moon (FM2)",
    url: "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/",
  },
};

export type Next = { title: string; why: string; planned: (keyof typeof PLANNED)[] };

/** The team's suggestions, each following from a gap computed above. */
export function nextTests(h: HabitatPreset, c: Coverage, near: FlexNear): Next[] {
  const out: Next[] = [];
  const air = `${h.o2Percent}% oxygen at ${h.pressureKPa} kPa`;
  if (c.solidsWithO2 > 0 && c.solidsCovering.length === 0)
    out.push({
      title: `Burn solid materials (fabrics, plastics) in ${air}`,
      why: `No solid-material experiment on record reached this oxygen level (the highest was ${c.maxSolidO2}%), yet fabrics and plastics are what would burn in a real cabin or suit.`,
      planned: ["fm2"],
    });
  const lunar = h.id === "moon" || h.id === "rover";
  if (lunar)
    out.push({
      title: "Repeat the key tests in lunar gravity",
      why: "No experiment in PSI ran in partial gravity. Microgravity and Earth-gravity results only bound what happens in between.",
      planned: ["luci", "fm2"],
    });
  if (near) {
    const thin = near.filter((x) => x.similar < 5);
    if (thin.length)
      out.push({
        title: `More fuel-droplet runs in ${air}`,
        why:
          (thin.every((x) => x.similar === 0)
            ? `No FLEX run sits very close to this air (${thin.map((x) => `${x.nearby} ${x.fuel}`).join(" and ")} in the wider area)`
            : `Only ${thin.map((x) => `${x.similar} ${x.fuel}`).join(" and ")} FLEX runs sit very close to this air`) +
          ", so the team models give trends here, not measurements.",
        planned: [],
      });
  }
  if (c.both.length === 0)
    out.push({
      title: `Any fire test in ${air}`,
      why: "No experiment on record tested both this oxygen level and this pressure.",
      planned: [],
    });
  return out;
}
