// "Fire in this base": a fire scenario on the one timeline, in five stages. A fire starts on an object in the cabin,
// spreads over what burns, fills the air with smoke that follows the ventilation, trips the smoke detector, the crew
// responds, and the stage ends with what the fire and smoke touched. Pure, so it is tested.
//
// What the records say (and nothing more is claimed; every other number is illustrative and labelled so):
// - SAFFIRE-II sample 2-5: cotton-fiberglass fabric spread at 2.1 mm/s at 22.1% oxygen in orbit (spread.ts).
// - BASS-II (fact solids-quench-flow): fabric flames went out when the airflow was turned down to 2.2 to 5 cm/s.
// - ACME BRE (claim clm:PSI-20:finding:2): without airflow, flames at 21% oxygen self-extinguished in a short time,
//   while flames in elevated oxygen kept burning.
// - FLEX (facts flex-dext-share-co2-*): droplet flames went out sooner with more carbon dioxide, a weak trend.
// - No test in the data ran in Moon gravity: the Moon is drawn between orbit and Earth, labelled an estimate.
// - The project data has no test of damage to a habitat's structure: none is modelled.
// A response the records do not settle for this material, air or gravity is drawn as uncertain ("Not tested"): the
// flame weakens but is never shown cleanly out.
import { OBJECTS, JUMP_M, spreadSpeed, type Gravity, type ObjId } from "./spread.ts";

/** Where a fire can start: combustible objects, each with a one-line scenario name. The first is the preset. */
export const STARTS: { id: ObjId; name: string }[] = [
  { id: "cloth", name: "Cloth near the air vent" },
  { id: "checklist", name: "Paper on the desk" },
  { id: "foam", name: "Foam pad by the bench" },
];

/** What the crew does at stage 4. The first is the preset, so the story plays with no input. */
export type Response = "vent" | "co2" | "none";
export const RESPONSES: { id: Response; name: string }[] = [
  { id: "vent", name: "Stop the ventilation" },
  { id: "co2", name: "Discharge carbon dioxide" },
  { id: "none", name: "Do nothing" },
];

/** The three gravity settings: two measured, the Moon drawn between them. */
export const GRAVITIES: { id: Gravity; name: string }[] = [
  { id: "micro", name: "In orbit (measured)" },
  { id: "partial", name: "On the Moon (estimate)" },
  { id: "earth", name: "On Earth (measured)" },
];
export const MOON_ESTIMATE = "Estimate: no fire test has run in Moon gravity";

/** Cabin ventilation while it runs, cm/s along the bench (illustrative; inside the BASS-II "burned" range). */
export const VENT_CMS = 10;
/** Oxygen at or below which a flame without airflow goes out in a short time (ACME BRE, 21% oxygen). */
export const STARVES_AT_O2 = 21.5;
/** Seconds until smoke is seen leaving the fire (illustrative). */
export const SMOKE_S = 4;
/** Seconds from the detector tripping to the crew's response (illustrative). */
export const RESPONSE_S = 25;
/** "A short time": seconds a flame lasts once the air is still at 21% oxygen (illustrative). */
export const QUENCH_S = 6;
/** Spread without airflow in richer oxygen, as a share of the ventilated speed (illustrative). */
export const STILL_SPREAD = 0.5;
/** An untested response: the flame is drawn weaker, never out (illustrative share of the speed). */
export const WEAKER = 0.4;
/** Spread speed against orbit: hot gas rises at 1 g; the Moon is drawn between (estimate). */
const G_SPEED = { micro: 1, partial: 1.2, earth: 1.5 } as const;
/** Upstream spread, against the air, as a share of the downstream speed (illustrative). */
const UPSTREAM = { micro: 0.3, partial: 0.4, earth: 0.6 } as const;
/** How fast smoke rises, m/s: none in orbit, slow on the Moon (estimate), a plume at 1 g (illustrative). */
const RISE = { micro: 0, partial: 0.12, earth: 0.3 } as const;
/** Smoke spreading under the ceiling, m/s (illustrative; the Moon an estimate). */
const CEILING_JET = { micro: 0, partial: 0.06, earth: 0.2 } as const;
/** Still air: how far smoke drifts out from the fire, metres after s seconds (illustrative, slow). */
const stillRadius = (s: number) => 0.05 + 0.03 * Math.sqrt(Math.max(0, s));
/** The smoke detector: on the back wall by the locker, where the air slows against it (drawn in the home view). */
export const DETECTOR = { x: 1.45, y: 0.15, z: -0.3 };
/** Height the smoke rises to at 1 g before it spreads (drawn). */
export const LAYER_Y = 0.6;
export const riseOf = (g: Gravity) => RISE[g];

export type StoryInput = { g: Gravity; o2: number; start: ObjId; response: Response };

/**
 * What the response does here. "out": the records say the flame goes out. "burns": the records say it keeps
 * burning. "weaker": the records do not settle it: drawn weaker, labelled "Not tested".
 */
export type Outcome = "out" | "burns" | "weaker";

export function outcomeOf(s: Pick<StoryInput, "g" | "o2" | "start" | "response">): Outcome {
  if (s.response === "none") return "burns";
  if (s.response === "co2") return "weaker"; // FLEX: a weak trend in droplet tests only
  // Stop the ventilation.
  if (s.g === "earth") return "burns"; // rising hot gas feeds the flame whatever the fan does
  if (s.g === "partial") return "weaker"; // no test in Moon gravity
  if (s.o2 > STARVES_AT_O2) return "burns"; // ACME BRE: elevated-oxygen flames kept burning without airflow
  return s.start === "cloth" ? "out" : "weaker"; // BASS-II tested this fabric; no test stopped the air on paper or foam
}

export type Stage = { id: "ignition" | "spread" | "smoke" | "detect" | "after"; at: number; name: string };

export type Story = {
  input: StoryInput;
  outcome: Outcome;
  /** Where the fire starts (x along the bench), and the run of touching burnable objects it can reach. */
  xs: number;
  run: [number, number];
  /** When the smoke reaches the detector. */
  detect: number;
  /** When the crew responds. */
  respond: number;
  /** When the ventilation stops (null: it never does). */
  ventOff: number | null;
  /** When the flame goes out (put out, or the fuel in reach is gone). */
  out: number;
  outBy: "response" | "fuel";
  end: number;
  stages: Stage[];
};

const byId = (id: ObjId) => OBJECTS.find((o) => o.id === id)!;

/** The run of touching burnable objects that contains x, as [lo, hi] along the bench. */
export function runAround(g: Gravity, x: number): [number, number] {
  const fuel = OBJECTS.filter((o) => o.burns(g)).sort((a, b) => a.x0 - b.x0);
  let lo = x;
  let hi = x;
  for (let changed = true; changed; ) {
    changed = false;
    for (const o of fuel) {
      if (o.x1 < lo - JUMP_M || o.x0 > hi + JUMP_M) continue;
      if (o.x0 < lo || o.x1 > hi) {
        lo = Math.min(lo, o.x0);
        hi = Math.max(hi, o.x1);
        changed = true;
      }
    }
  }
  return [lo, hi];
}

const vOf = (s: StoryInput) => spreadSpeed(s.o2, "micro") * G_SPEED[s.g];
/** Speed after the response, as a share of the speed before. */
const afterShare = (s: StoryInput, o: Outcome) =>
  o === "out" ? 0 : o === "weaker" ? WEAKER : s.response === "vent" && s.g !== "earth" ? STILL_SPREAD : 1;

/** Smoke's downstream edge along the bench at time t, the ventilation running until ventOff. */
export function smokeHead(g: Gravity, xs: number, ventOff: number | null, t: number): number {
  const age = Math.max(0, t - SMOKE_S);
  const off = ventOff ?? Infinity;
  const blown = (VENT_CMS / 100) * Math.max(0, Math.min(age, off - SMOKE_S));
  const jet = CEILING_JET[g] * Math.max(0, age - (RISE[g] > 0 ? LAYER_Y / RISE[g] : 0));
  return xs + Math.max(blown + jet, stillRadius(age));
}

export function story(input: StoryInput): Story {
  const s = input;
  const o = byId(s.start);
  const xs = (o.x0 + o.x1) / 2;
  const run = runAround(s.g, xs);
  const need = Math.max(run[1] - xs, (xs - run[0]) / UPSTREAM[s.g]);
  const outcome = outcomeOf(s);

  // The ventilation runs until the crew responds, so the smoke always reaches the detector.
  let detect = SMOKE_S;
  while (smokeHead(s.g, xs, null, detect) < DETECTOR.x - 0.05 && detect < 600) detect += 0.25;
  const respond = detect + RESPONSE_S;
  const ventOff = s.response === "vent" ? respond : null;

  const v1 = vOf(s);
  const v2 = v1 * afterShare(s, outcome);
  const fuelOut = need <= v1 * respond ? need / v1 : v2 > 0 ? respond + (need - v1 * respond) / v2 : Infinity;
  const quench = outcome === "out" ? respond + QUENCH_S : Infinity;
  const outBy = quench < fuelOut ? "response" : "fuel";
  const out = Math.min(quench, fuelOut, 3600);
  const last = Math.max(out, detect);
  const after = last + 1;
  const at = [0, 1.5, SMOKE_S + 1, detect, after];
  for (let i = 1; i < at.length; i++) at[i] = Math.max(at[i], at[i - 1] + 0.5);
  const ids: Stage["id"][] = ["ignition", "spread", "smoke", "detect", "after"];
  const names = ["Ignition", "Spread", "Smoke and air", "Detection and response", "Aftermath"];
  const stages = ids.map((id, i) => ({ id, at: at[i], name: names[i] }));
  return { input, outcome, xs, run, detect, respond, ventOff, out, outBy, end: Math.max(after + 6, last * 1.08), stages };
}

export type StoryAt = {
  /** The burning span along the bench [lo, hi]; the flame fronts are at its ends while alive. */
  lo: number;
  hi: number;
  alive: boolean;
  /** 0..1: how strong the flame is drawn (weaker after an untested response, fading when put out). */
  strength: number;
  vent: boolean;
  /** The span burnt on each object, or null. */
  burnt: Record<ObjId, [number, number] | null>;
  /** Objects the smoke has reached that did not burn: they get a soot tint. */
  sooted: Set<ObjId>;
  smoke: number;
  tripped: boolean;
};

export function storyAt(st: Story, t: number): StoryAt {
  const s = st.input;
  const v1 = vOf(s);
  const v2 = v1 * afterShare(s, st.outcome);
  const tt = Math.max(0, Math.min(t, st.out));
  const d = v1 * Math.min(tt, st.respond) + v2 * Math.max(0, tt - st.respond);
  const lo = Math.max(st.run[0], st.xs - d * UPSTREAM[s.g]);
  const hi = Math.min(st.run[1], st.xs + d);
  const alive = t >= 0 && t < st.out;
  const after = t >= st.respond;
  const strength = !alive
    ? 0
    : st.outcome === "out" && after
      ? Math.max(0.1, 1 - (t - st.respond) / QUENCH_S)
      : after && st.outcome === "weaker"
        ? 0.55
        : Math.min(1, 0.3 + t / 1.5);
  const burnt = Object.fromEntries(
    OBJECTS.map((o) => {
      const a = Math.max(o.x0, lo);
      const b = Math.min(o.x1, hi);
      return [o.id, o.burns(s.g) && b > a ? [a, b] : null];
    }),
  ) as StoryAt["burnt"];
  // Smoke stops coming a little after the flame is out; what is in the air stays.
  const smoke = smokeHead(s.g, st.xs, st.ventOff, Math.min(t, st.out + 4));
  const sooted = new Set<ObjId>(OBJECTS.filter((o) => !burnt[o.id] && t > SMOKE_S && o.x1 >= lo - 0.1 && o.x0 <= smoke).map((o) => o.id));
  return { lo, hi, alive, strength, vent: st.ventOff === null || t < st.ventOff, burnt, sooted, smoke, tripped: t >= st.detect };
}

export const stageAt = (st: Story, t: number) => [...st.stages].reverse().find((x) => t >= x.at) ?? st.stages[0];

const r0 = (x: number) => Math.round(x);

/** Counts for the aftermath card, from the end of the run. */
export function aftermath(st: Story) {
  const end = storyAt(st, st.end);
  const burned = OBJECTS.filter((o) => end.burnt[o.id]).length;
  return { burned, sooted: end.sooted.size, untouched: OBJECTS.length - burned - end.sooted.size, total: OBJECTS.length };
}

export type Caption = { text: string; refs: string[] };

/** One evidence line for the chosen response (with its records) and one on what is not known. */
export function responseLines(st: Story): { evidence: Caption; unknown: string } {
  const s = st.input;
  if (s.response === "none")
    return {
      evidence: { text: "In orbit a strip of cotton-fiberglass fabric burned its whole 29 cm with the air flowing.", refs: ["solids:sample:2-5"] },
      unknown: "How far a fire would spread over a whole cabin of mixed materials is not tested.",
    };
  if (s.response === "co2")
    return {
      evidence: { text: "In FLEX droplet tests, flames went out sooner with more carbon dioxide in the air: a weak trend.", refs: ["fact:flex-dext-share-co2-methanol"] },
      unknown: "Not tested: no test in the data put carbon dioxide on a burning solid in a cabin.",
    };
  const bre = ["claim:clm:PSI-20:finding:2"];
  if (s.g === "earth")
    return { evidence: { text: "At 1 g rising hot gas feeds the flame whatever the fan does. Illustration.", refs: [] }, unknown: "The tests in the data stopped airflow only in microgravity." };
  if (s.g === "partial")
    return {
      evidence: { text: "Without airflow, flames at 21% oxygen went out in a short time in orbit; in richer oxygen they kept burning.", refs: bre },
      unknown: "Not tested: no fire test has run in Moon gravity, where weak gravity still moves hot gas.",
    };
  if (s.o2 > STARVES_AT_O2)
    return { evidence: { text: "In richer oxygen, flames kept burning without airflow.", refs: bre }, unknown: "How long such a flame lasts on a solid in a cabin is not tested." };
  if (s.start === "cloth")
    return {
      evidence: { text: "In BASS-II this fabric's flames went out when the airflow was turned down to 2.2 to 5 cm/s.", refs: ["fact:solids-quench-flow", ...bre] },
      unknown: "BASS-II burned strips of one fabric, not a cabin of mixed materials.",
    };
  return {
    evidence: { text: "Without airflow, flames at 21% oxygen went out in a short time.", refs: bre },
    unknown: "Not tested: no test in the data stopped the airflow on burning paper or foam.",
  };
}

/** The aftermath card's lines, from the run's own numbers. */
export function aftermathLines(st: Story): string[] {
  const a = aftermath(st);
  const name = RESPONSES.find((r) => r.id === st.input.response)!.name;
  const did =
    st.outcome === "out"
      ? `${name}: the flame went out ${r0(st.out - st.respond)} s later.`
      : st.outcome === "weaker"
        ? `${name}: drawn as a weaker flame that burned on, because the records do not settle it (Not tested).`
        : st.input.response === "none"
          ? "Nobody acted: the flame burned until the fuel in reach was gone."
          : `${name}: the flame kept burning until the fuel in reach was gone.`;
  return [
    `${a.burned} of ${a.total} objects burned; smoke stained ${a.sooted} more; ${a.untouched} untouched.`,
    `Smoke reached the detector at ${r0(st.detect)} s.`,
    did,
    responseLines(st).unknown,
    "The project data has no test of damage to a habitat's structure, so no wall, seal or pressure loss is drawn.",
  ];
}

/** The scenario as one question for Ask SI. */
export function scenarioQuestion(st: Story, baseName: string): string {
  const s = st.input;
  const start = STARTS.find((x) => x.id === s.start)!.name.toLowerCase();
  const resp = RESPONSES.find((r) => r.id === s.response)!.name.toLowerCase();
  return `If a fire starts on the ${start} in the ${baseName} at ${s.o2}% oxygen, what does the evidence say happens if the crew chooses to ${resp}?`;
}

/** Each stage's caption: a record behind it where one exists ("How we know"), otherwise the word "Illustration". */
export function captionFor(st: Story, id: Stage["id"], baseName: string): Caption {
  const s = st.input;
  const moon = s.g === "partial" ? ` ${MOON_ESTIMATE}.` : "";
  switch (id) {
    case "ignition":
      return { text: `What if a fire starts here, in the ${baseName}? ${STARTS.find((x) => x.id === s.start)!.name}. Illustration.`, refs: [] };
    case "spread":
      return s.g === "earth"
        ? { text: "At 1 g hot gas rises and the flames stand tall as they spread. Speed illustrative, scaled by oxygen.", refs: [] }
        : s.g === "partial"
          ? { text: `The flame spreads with the cabin air, a little taller than in orbit.${moon} Illustration.`, refs: [] }
          : {
              text: `The flame creeps along with the cabin air. In orbit a cotton-fiberglass fabric spread at 2.1 mm/s at 22% oxygen; here scaled to ${s.o2}%, illustrative.`,
              refs: ["solids:sample:2-5"],
            };
    case "smoke":
      return s.g === "earth"
        ? { text: "Smoke and hot gas rise, then spread under the ceiling. Illustration.", refs: [] }
        : s.g === "partial"
          ? { text: `Smoke rises slowly while the ventilation carries it.${moon} Illustration.`, refs: [] }
          : { text: "Smoke does not rise in orbit: it drifts with the ventilation toward the air return. Illustration.", refs: [] };
    case "detect": {
      const r = responseLines(st).evidence;
      const name = RESPONSES.find((x) => x.id === s.response)!.name;
      return { text: `The detector trips at ${r0(st.detect)} s. Response: ${name}. ${r.text}${st.outcome === "weaker" ? " Not tested here." : ""}${s.response === "co2" ? " Illustration." : ""}`, refs: r.refs };
    }
    case "after":
      return { text: "What the fire and smoke touched. Times and speeds illustrative.", refs: [] };
  }
}

/** One soft puff of the smoke volume, metres; o is its opacity (0..1). */
export type Puff = { x: number; y: number; z: number; r: number; o: number };

/** Where the airflow is weak: against the locker's face, where the air slows and smoke gathers (drawn). */
export const WEAK_FLOW_X = 1.35;
/** How far along the bench the smoke volume is drawn (the cabin past the locker). */
export const SMOKE_END_X = 2.6;

/**
 * The smoke in the air at time t, as soft puffs from the fire to the smoke's downstream edge. In orbit it does not
 * rise: it drifts with the ventilation close to the bench and gathers where the flow is weak (against the locker); with the ventilation off it pools round the fire. At 1 g it rises to a layer under the ceiling and
 * spreads there. The Moon is drawn between (estimate). Illustration: positions are drawn, not measured.
 */
export function smokeAt(st: Story, t: number, n = 12): Puff[] {
  if (t < SMOKE_S) return [];
  const g = st.input.g;
  const at = storyAt(st, t);
  // Drawn only as far as the cabin's far end past the locker; the smoke beyond is out of sight.
  const head = Math.min(at.smoke, SMOKE_END_X);
  const age = t - SMOKE_S;
  const fade = t > st.out + 4 ? Math.max(0.35, 1 - (t - st.out - 4) / 60) : 1;
  const rise = g === "earth" ? 1 : g === "partial" ? 0.4 : 0;
  const out: Puff[] = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    // From the flame front (where the smoke is made) to the smoke's downstream edge.
    const src = Math.min(at.hi, head);
    const x = src + (head - src) * u;
    const weak = !at.vent ? 1 : x >= WEAK_FLOW_X ? 1 : 0;
    // Rising: the first third climbs above the fire, the rest spreads under the layer.
    const climb = Math.min(1, u * 3);
    const y = 0.06 + 0.04 * u + rise * (LAYER_Y - 0.06) * climb;
    const z = -0.04 + 0.05 * Math.sin(i * 1.7 + age * 0.05);
    const r = (0.05 + 0.05 * u) * (1 + 0.8 * weak) * Math.min(1, 0.4 + age / 8);
    const o = (0.22 + 0.2 * weak) * fade;
    out.push({ x, y, z, r, o });
  }
  return out;
}
