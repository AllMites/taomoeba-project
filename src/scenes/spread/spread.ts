// Fire spread in a base's cabin: which objects burn, where the flame front is at a given time, and what the real
// tests say about each object. An illustration of how fire spreads in this air, not a simulation of a real event.
// Real numbers come only from public/data/solids.json (BASS-II fabric tests, SAFFIRE-II samples); the rest is
// drawn and labelled as illustrative. Pure, so it is tested without a browser.
import type { FabricTest, SolidsDoc } from "../../solids/logic.ts";

export type Gravity = "micro" | "partial" | "earth";

export const gravityOf = (base: string): Gravity => (base === "earth" ? "earth" : base === "iss" ? "micro" : "partial");

export type ObjId = "cloth" | "checklist" | "foam" | "panel" | "cable" | "bag" | "locker" | "window";

export type CabinObject = {
  id: ObjId;
  name: string;
  /** Along the airflow (x, metres from the ignition point) and across it (z). */
  x0: number;
  x1: number;
  z: number;
  /** Size of the box drawn for it: width along x comes from x0..x1; [height, depth]. */
  hd: [number, number];
  /** Burns in this gravity? A function, because some materials behave differently in space and on Earth. */
  burns: (g: Gravity) => boolean;
  /** One or two plain sentences on how it behaves in microgravity. */
  behaviour: string;
  /** The SAFFIRE-II sample row that matches it, if any. */
  saffire?: string;
  /** Investigation ids in public/data/investigations.json that tested this material. */
  evidence: string[];
  /** Drawn as a fabric sheet whose flame depends on airflow (the BASS-II tests). */
  fabric?: boolean;
};

const always = () => true;
const never = () => false;

/** The cabin set, in the order the ventilation flow meets them. Ignition is at x = 0, on the cloth. */
export const OBJECTS: CabinObject[] = [
  {
    id: "cloth",
    name: "Cotton-fiberglass cloth (SIBAL)",
    x0: 0,
    x1: 0.42,
    z: 0,
    hd: [0.004, 0.22],
    burns: always,
    behaviour: "In microgravity a fabric flame has no rising hot gas to feed it; it lives on the cabin's airflow and can go out when the air is too still.",
    saffire: "2-5",
    evidence: ["PSI-25", "PSI-99"],
    fabric: true,
  },
  {
    id: "checklist",
    name: "Paper checklist",
    x0: 0.45,
    x1: 0.66,
    z: 0.02,
    hd: [0.003, 0.28],
    burns: always,
    behaviour: "Paper is thin and burns readily. No test in this project's data burned paper, so its spread here is illustrative.",
    evidence: [],
  },
  {
    id: "foam",
    name: "Foam pad",
    x0: 0.69,
    x1: 0.98,
    z: -0.01,
    hd: [0.03, 0.24],
    burns: always,
    behaviour: "Foam is light and full of air, so it burns easily and smokes. No test in this project's data burned foam; illustrative.",
    evidence: [],
  },
  {
    id: "panel",
    name: "Acrylic (PMMA) panel",
    x0: 1.02,
    x1: 1.5,
    z: 0,
    hd: [0.008, 0.3],
    burns: always,
    behaviour: "Acrylic softens and burns with a steady flame. In space the flame can sit anchored where the air comes from.",
    saffire: "2-7",
    evidence: ["PSI-99", "PSI-25"],
  },
  {
    id: "locker",
    name: "Aluminium locker",
    x0: 1.56,
    x1: 2.02,
    z: 0,
    hd: [0.32, 0.36],
    burns: never,
    behaviour: "Metal does not burn here. It stops the flame: the fire has nothing to creep onto.",
    evidence: [],
  },
  {
    id: "cable",
    name: "Silicone cable insulation",
    x0: 0.12,
    x1: 0.92,
    z: -0.17,
    hd: [0.012, 0.012],
    burns: (g) => g === "earth",
    behaviour: "In the SAFFIRE-II test silicone did not spread a flame in space, while the same samples burned on Earth.",
    saffire: "2-1",
    evidence: ["PSI-99"],
  },
  {
    id: "bag",
    name: "Nomex stowage bag",
    x0: -0.5,
    x1: -0.12,
    z: 0.05,
    hd: [0.12, 0.2],
    burns: never,
    behaviour: "Nomex is a flame-resistant fabric used for crew clothing and bags. In the SAFFIRE-II test it never caught fire.",
    saffire: "2-7",
    evidence: ["PSI-99"],
  },
  {
    id: "window",
    name: "Glass window",
    x0: 0.5,
    x1: 1.1,
    z: -0.6,
    hd: [0.6, 0.02],
    burns: never,
    behaviour: "Glass does not burn. A fire behind it heats it, but the flame cannot spread onto it.",
    evidence: [],
  },
];

/** SIBAL spread rate in space from the SAFFIRE-II run table (sample 2-5: 2.1 mm/s at 22.1% oxygen). */
export const SIBAL_MM_S = 2.1;
export const SIBAL_O2 = 22.1;
/** A gap the flame can jump between touching objects, metres. Illustrative. */
export const JUMP_M = 0.05;
/** Time the flame holds at the ignition point before it goes out when the fabric verdict is "out", seconds. */
export const FAIL_S = 8;

/**
 * Spread speed, m/s: the SAFFIRE-II fabric rate scaled by the base's oxygen against the test's oxygen (illustrative:
 * the square of the ratio, so more oxygen spreads faster). Earth gravity adds rising hot gas: drawn 1.5x faster.
 */
export function spreadSpeed(o2Percent: number, g: Gravity): number {
  const r = Math.max(0, o2Percent) / SIBAL_O2;
  return (SIBAL_MM_S / 1000) * r * r * (g === "earth" ? 1.5 : 1);
}

/** The farthest point the fire can reach along the flow: the end of the run of burnable objects from the ignition. */
export function reach(objects: CabinObject[], g: Gravity): number {
  const run = objects.filter((o) => o.burns(g)).sort((a, b) => a.x0 - b.x0);
  let end = 0;
  for (const o of run) {
    if (o.x1 < 0) continue;
    if (o.x0 > end + JUMP_M) break;
    end = Math.max(end, o.x1);
  }
  return end;
}

export type Fabric = { lives: boolean; test: FabricTest | null; beyond: boolean };

/**
 * Does the cloth's flame live at this oxygen and airflow? The nearest real BASS-II test on the 2.2 cm fabric
 * (oxygen in points, airflow on a log scale) decides. Above every test's oxygen the data says nothing: drawn burning,
 * marked "beyond the tests". At 1 g rising gas feeds the flame whatever the fan does.
 */
export function fabricVerdict(doc: SolidsDoc | null, o2Percent: number, flowCmS: number, g: Gravity): Fabric {
  if (g === "earth" || !doc) return { lives: true, test: null, beyond: false };
  const f = doc.flammability;
  if (o2Percent > f.maxO2 + 0.5) return { lives: true, test: null, beyond: true };
  const tests = f.tests.filter((t) => t.widthCm === 2.2);
  let best: FabricTest | null = null;
  let bestD = Infinity;
  for (const t of tests) {
    const d = Math.abs(t.o2 - o2Percent) + 4 * Math.abs(Math.log10(t.flowTo) - Math.log10(Math.max(flowCmS, 0.1)));
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  const lives = !!best && (best.outcome === "burned" || best.outcome === "no-blowoff");
  return { lives, test: best, beyond: false };
}

export type SpreadAt = {
  /** Flame front, metres from the ignition point. */
  front: number;
  /** The fire is burning at this moment. */
  alive: boolean;
  /** Burnt length of each object, metres from its upstream end. */
  burnt: Record<ObjId, number>;
  phase: string;
};

/** Seconds until the front stops (or the flame dies at the start). */
export function spreadEnd(objects: CabinObject[], g: Gravity, o2Percent: number, fabric: Fabric): number {
  if (!fabric.lives) return FAIL_S;
  const v = spreadSpeed(o2Percent, g);
  return v > 0 ? reach(objects, g) / v : 0;
}

export function spreadAt(objects: CabinObject[], g: Gravity, o2Percent: number, fabric: Fabric, t: number): SpreadAt {
  const v = spreadSpeed(o2Percent, g);
  const max = fabric.lives ? reach(objects, g) : 0.02;
  const front = Math.min(max, Math.max(0, fabric.lives ? v * t : Math.min(0.02, v * t)));
  const end = spreadEnd(objects, g, o2Percent, fabric);
  const alive = t >= 0 && t < end;
  const burnt = Object.fromEntries(
    objects.map((o) => [o.id, o.burns(g) && o.x1 > 0 && o.x0 <= front + JUMP_M ? Math.max(0, Math.min(o.x1, front) - Math.max(o.x0, 0)) : 0]),
  ) as Record<ObjId, number>;
  const on = objects.find((o) => o.burns(g) && o.x0 <= front && front <= o.x1 && Math.abs(o.z) < 0.1);
  let phase: string;
  if (t <= 0) phase = "Ignition on the cloth";
  else if (!fabric.lives) phase = alive ? "Flame struggling in still air" : "Flame went out: too little airflow";
  else if (alive) phase = on ? `Spreading over the ${on.name.toLowerCase()}` : "Spreading";
  else phase = `Stopped at the ${objects.find((o) => !o.burns(g) && o.x0 >= front - JUMP_M && Math.abs(o.z) < 0.1)?.name.toLowerCase() ?? "end of the fuel"}`;
  return { front, alive, burnt, phase };
}

/** Investigation and data rows for an object's detail card. Ids are checked against the loaded investigations. */
export function evidenceFor(o: CabinObject, doc: SolidsDoc | null, known: Set<string>) {
  const sample = o.saffire && doc ? (doc.saffire.samples.find((s) => s.sample === o.saffire) ?? null) : null;
  return {
    ids: o.evidence.filter((id) => known.has(id)),
    sample,
    findings: o.fabric && doc ? doc.flammability.findings.slice(0, 2) : [],
  };
}
