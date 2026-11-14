// Turns the run-table numbers in public/data/scenes/saffire.json into what the replay shows at a
// given moment. Pure functions, no three.js, so the numbers can be tested.

export type RecordValue = { value: number | null; unit: string; source: string | null; field: string; default?: number; defaultNote?: string };

export type SaffireRecord = {
  experiment: { id: string; name: string; source: string };
  run: { sample: string; material: string; flowDirection: string; source: string; field: string };
  values: {
    o2Percent: RecordValue;
    airflowCmS: RecordValue;
    pressureKPa: RecordValue;
    sampleLengthCm: RecordValue;
    sampleWidthCm: RecordValue;
    spreadRateMmS: RecordValue;
    burnLengthCm: RecordValue;
    burnTimeS: RecordValue;
    ignitionPowerW: RecordValue;
    ignitionTimeS: RecordValue;
  };
  card: { samples: { sample: string; material: string | null; microgravityBurnLength: string }[] };
  callouts: ({ claimId: string; anchor: string } | { claimIdByHabitat: Record<string, string>; anchor: string })[];
};

/** The replay runs this many times faster than the real burn. Stated on screen. */
export const PLAYBACK_SPEED = 10;
/** Record seconds the burnt strip stays on screen after the flame goes out, before the loop restarts. */
export const HOLD_S = 25;
/** Record seconds over which the flame grows after the igniter stops. Illustrative. */
const GROW_S = 4;

export type Phase = "igniting" | "burning" | "out";

export type ReplayFrame = {
  phase: Phase;
  /**
   * Record clock, seconds. Negative while the igniter is on; 0 when it stops and the burn clock starts.
   * Whether the run table's burn time includes the ignition time is not on record; the replay starts the
   * burn clock when the igniter stops.
   */
  t: number;
  /** Burn clock shown on screen, seconds, 0..burn time. */
  burnS: number;
  /** Flame-front distance from the ignition end, cm. Null when the record cannot place it. */
  frontCm: number | null;
  /** 0..1, how alive the flame is. */
  intensity: number;
};

/** Spread speed in cm/s: the recorded rate, or burn length over burn time when only those are on record. */
export function spreadCmS(rec: SaffireRecord): number | null {
  const rate = rec.values.spreadRateMmS.value;
  if (rate != null) return rate / 10;
  const len = rec.values.burnLengthCm.value;
  const time = rec.values.burnTimeS.value;
  return len != null && time ? len / time : null;
}

/** Record-clock span of one loop: igniter on, burn, then the hold. */
export function loopSpan(rec: SaffireRecord): { start: number; end: number } {
  return { start: -(rec.values.ignitionTimeS.value ?? 0), end: (rec.values.burnTimeS.value ?? 0) + HOLD_S };
}

/** Mid-burn: the still frame shown under reduced motion and on the poster. */
export function midBurn(rec: SaffireRecord): number {
  return (rec.values.burnTimeS.value ?? 0) / 2;
}

export function frameAt(rec: SaffireRecord, t: number): ReplayFrame {
  const burnTime = rec.values.burnTimeS.value ?? 0;
  const burnLen = rec.values.burnLengthCm.value ?? rec.values.sampleLengthCm.value;
  const v = spreadCmS(rec);
  if (t < 0) return { phase: "igniting", t, burnS: 0, frontCm: 0, intensity: 0 };
  const burnS = Math.min(t, burnTime);
  const frontCm = v == null || burnLen == null ? null : Math.min(burnLen, v * burnS);
  if (t >= burnTime) return { phase: "out", t, burnS, frontCm, intensity: 0 };
  // The flame grows after ignition, then fades between reaching the end of the strip and the recorded burn time.
  const grow = Math.min(1, t / GROW_S);
  const reachS = v && burnLen != null ? burnLen / v : burnTime;
  const fadeFrom = Math.min(reachS, burnTime);
  const fade = t <= fadeFrom ? 1 : Math.max(0, 1 - (t - fadeFrom) / Math.max(burnTime - fadeFrom, 1e-6));
  return { phase: "burning", t, burnS, frontCm, intensity: grow * fade };
}

/**
 * The small status line under the HUD. It must describe the frame on screen: a stopped replay is only
 * "mid-burn" when the clock really sits at mid-burn (calm, the poster), not after "Play once" has ended.
 */
export function statusLine(rec: SaffireRecord, f: ReplayFrame, playing: boolean): string {
  if (playing) return `Replay ${PLAYBACK_SPEED}× speed`;
  if (f.t === midBurn(rec)) return "Still frame, mid-burn";
  if (f.phase === "out") return "Still frame, burn over";
  return "Paused";
}
