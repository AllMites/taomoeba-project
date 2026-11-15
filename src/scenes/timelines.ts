// One timeline per scene, in the scene's own seconds, for the stage's playback bar. Pure, so it is tested.
import type { BurnCase } from "./burn/model.ts";
import { captionFor, type Story } from "./spread/story.ts";
import type { Mode, Timeline } from "./playback.ts";
import { loopSpan, type SaffireRecord } from "./saffire/timeline.ts";
import { PLAYBACK_SPEED } from "./saffire/timeline.ts";

/** The three scenes, in picker order. Burn and spread play in the base's cabin (the registry's "lunar" slot). */
export const MODES: { id: Mode; name: string; line: string; scene: "lunar" | "saffire" }[] = [
  { id: "spread", name: "Fire in this base", line: "A fire starts in this base's cabin: how it spreads, where the smoke goes, what it damages.", scene: "lunar" },
  { id: "burn", name: "Lab view: team model burn", line: "A fuel droplet burning in this base's air, sized and timed by the team's model.", scene: "lunar" },
  { id: "saffire", name: "Real fire: Saffire flight test", line: "A fabric strip that really burned inside a cargo spacecraft in orbit.", scene: "saffire" },
];

/**
 * A timeline's identity. It names the air the timeline was computed for, not only the base: during a base change
 * the picked base and the air handed to the scene can differ for a moment, and a key without the air would keep
 * that first, wrong timeline.
 */
export const timelineKey = (mode: Mode, base: string, air: { o2Percent?: number; pressureKPa?: number }, ...rest: string[]) =>
  [mode, base, air.o2Percent ?? "-", air.pressureKPa ?? "-", ...rest].join("|");

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

/** Fire in this base: the story's five stages, each a mark on the seeker with its caption; about 20 s on screen. */
export function storyTimeline(st: Story, key: string, where: string): Timeline {
  return {
    key,
    start: 0,
    end: st.end,
    rate: Math.max(1, Math.ceil(st.end / 20)),
    compressed: true,
    phases: st.stages.map((s) => {
      const c = captionFor(st, s.id, where);
      return { at: s.at, name: s.name, mark: true, caption: c.text, refs: c.refs };
    }),
  };
}
