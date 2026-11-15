// Shared state between the center replay's controls (Stage.tsx) and the scene inside it: which scene, the one
// timeline and its seeker, the camera's navigation state, the model-burn settings and the picked object. The scene
// contract (SceneProps) stays as it is; scenes read and write this store instead.
import { create } from "zustand";
import type { Sel } from "../whatif/logic.ts";

/** "burn": this base, model burn. "spread": this base, fire spread. "saffire": the real Saffire flight test. */
export type Mode = "burn" | "spread" | "saffire";

export type Phase = { at: number; name: string };

/** A scene's timeline in its own seconds. `rate` is screen speed (10 = ten times real time). */
export type Timeline = { key: string; start: number; end: number; rate: number; phases: Phase[] };

export type Nudge = { orbit: number; tilt: number; zoom: number; n: number };

export type PlaybackState = {
  mode: Mode;
  timeline: Timeline | null;
  t: number;
  playing: boolean;
  /** The viewer has moved the camera: drift stops for good, rigs stop steering. */
  drifted: boolean;
  /** The camera is the viewer's (until "Reset view"). */
  steered: boolean;
  /** Bumped by "Reset view". */
  resetN: number;
  /** Arrow and plus/minus keys on the focused stage. */
  nudge: Nudge;
  /** Model-burn settings (fuel, gas mix, start diameter); oxygen and pressure come from the base. */
  sel: Sel | null;
  /** Show a faint flame in station air at the same spot. */
  compare: boolean;
  /** Fire spread: the object pointed at or picked. */
  picked: string | null;
  setMode: (m: Mode) => void;
  setTimeline: (tl: Timeline | null) => void;
  seek: (t: number) => void;
  setPlaying: (p: boolean) => void;
  steer: () => void;
  resetView: () => void;
  push: (orbit: number, tilt: number, zoom: number) => void;
  setSel: (s: Sel | null) => void;
  setCompare: (c: boolean) => void;
  pick: (id: string | null) => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const usePlayback = create<PlaybackState>((set, get) => ({
  mode: "burn",
  timeline: null,
  t: 0,
  playing: false,
  drifted: false,
  steered: false,
  resetN: 0,
  nudge: { orbit: 0, tilt: 0, zoom: 0, n: 0 },
  sel: null,
  compare: false,
  picked: null,
  setMode: (mode) => set({ mode, picked: null }),
  // A new timeline (another scene, base or setting) starts from its beginning; the same one keeps its place.
  setTimeline: (tl) => {
    const cur = get().timeline;
    if (cur?.key === tl?.key) return;
    set({ timeline: tl, t: tl ? tl.start : 0 });
  },
  seek: (t) => {
    const tl = get().timeline;
    set({ t: tl ? clamp(t, tl.start, tl.end) : 0 });
  },
  setPlaying: (playing) => set({ playing }),
  steer: () => set({ drifted: true, steered: true }),
  resetView: () => set((s) => ({ steered: false, resetN: s.resetN + 1 })),
  push: (orbit, tilt, zoom) => set((s) => ({ drifted: true, steered: true, nudge: { orbit, tilt, zoom, n: s.nudge.n + 1 } })),
  setSel: (sel) => set({ sel }),
  setCompare: (compare) => set({ compare }),
  pick: (picked) => set({ picked }),
}));

/** The phase showing at time t: the last one that has started. */
export function phaseAt(tl: Timeline, t: number): string {
  let name = tl.phases[0]?.name ?? "";
  for (const p of tl.phases) if (t >= p.at) name = p.name;
  return name;
}

/** One playback step: screen seconds dt at the timeline's rate, stopping at the end. */
export function advance(tl: Timeline, t: number, dt: number): { t: number; ended: boolean } {
  const next = t + Math.max(0, dt) * tl.rate;
  return next >= tl.end ? { t: tl.end, ended: true } : { t: next, ended: false };
}

/** "1:05" style clock for a seeker readout; tenths under ten seconds. */
export function clock(s: number): string {
  const v = Math.max(0, s);
  if (v < 10) return `${v.toFixed(1)} s`;
  const m = Math.floor(v / 60);
  const r = Math.floor(v % 60);
  return m ? `${m}:${String(r).padStart(2, "0")}` : `${r} s`;
}
