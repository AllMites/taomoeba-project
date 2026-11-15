// One timeline per scene, in the scene's own seconds, for the stage's playback bar. Pure, so it is tested.
import type { BurnCase } from "./burn/model.ts";
import type { Mode, Timeline } from "./playback.ts";
import { loopSpan, type SaffireRecord } from "./saffire/timeline.ts";
import { PLAYBACK_SPEED } from "./saffire/timeline.ts";

/** The three scenes, in picker order. Burn and spread play in the base's cabin (the registry's "lunar" slot). */
export const MODES: { id: Mode; name: string; line: string; scene: "lunar" | "saffire" }[] = [
  { id: "burn", name: "This base: model burn", line: "A fuel droplet burning in this base's air, sized and timed by the team's model.", scene: "lunar" },
  { id: "spread", name: "This base: fire spread", line: "A flame creeping over everyday things in this base's cabin.", scene: "lunar" },
  { id: "saffire", name: "Real fire: Saffire flight test", line: "A fabric strip that really burned inside a cargo spacecraft in orbit.", scene: "saffire" },
];

export const sceneFor = (m: Mode) => MODES.find((x) => x.id === m)!.scene;

/** Steady flame with no model numbers: a short loop the bar can still play. */
const STEADY_S = 10;

export function burnTimeline(c: BurnCase, key: string): Timeline {
  if (c.kind === "none") return { key, start: 0, end: STEADY_S, rate: 1, phases: [{ at: 0, name: "Burning (no model timing)" }] };
  const { plan } = c;
  return {
    key,
    start: 0,
    // A short hold after the end, so the last frame (flame out, the droplet left) can be seen.
    end: plan.tEnd * 1.12,
    rate: c.speed,
    phases: [
      { at: 0, name: "Ignition" },
      { at: Math.min(plan.tEnd * 0.02, 0.2), name: "Burning, shrinking by the d² law" },
      { at: plan.tEnd, name: plan.ends === "flame-out" ? "Flame out" : "Burned away" },
    ],
  };
}

export function saffireTimeline(rec: SaffireRecord): Timeline {
  const span = loopSpan(rec);
  const burn = rec.values.burnTimeS.value ?? 0;
  return {
    key: `saffire|${rec.run.sample}`,
    start: span.start,
    end: span.end,
    rate: PLAYBACK_SPEED,
    phases: [
      { at: span.start, name: "Igniter on" },
      { at: 0, name: "Flame spreading with the air flow" },
      { at: burn, name: "Flame out" },
    ],
  };
}

/** Fire spread: from ignition until the front stops, plus a short hold; about 15 s on screen. */
export function spreadTimeline(endS: number, key: string): Timeline {
  const end = Math.max(1, endS * 1.1);
  return {
    key,
    start: 0,
    end,
    rate: Math.max(1, Math.ceil(end / 15)),
    phases: [
      { at: 0, name: "Ignition on the cloth" },
      { at: Math.min(1, endS / 20), name: "Spreading with the airflow" },
      { at: endS, name: "Stopped: nothing left that burns in reach" },
    ],
  };
}
