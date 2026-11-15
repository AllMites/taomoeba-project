// Where things stand inside each base's cabin, and where the camera starts. Metres, Y up, the bench top at y = 0,
// the ventilation flow along +x. Pure, so the framing is tested: the fire must be large in the first frame.
import type { BaseId } from "../../app/console.ts";
import type { Mode } from "../playback.ts";
import { OBJECTS } from "../spread/spread.ts";
import { DETECTOR, WEAK_FLOW_X } from "../spread/story.ts";

export type V3 = [number, number, number];

export type Room = {
  /** "tube": a module (cylinder along x); "box": a habitat or cabin. */
  shape: "tube" | "box";
  /** Box: [length x, height y, depth z]. Tube: [length, radius, -]. */
  size: V3;
  /** Floor (box) or tube axis height, relative to the bench top. */
  base: number;
  name: string;
  /** What the window looks out on. */
  outside: "orbit" | "moon" | "earth";
};

export const ROOMS: Record<BaseId, Room> = {
  iss: { shape: "tube", size: [6, 1.1, 0], base: 0.25, name: "ISS module", outside: "orbit" },
  moon: { shape: "box", size: [6, 2.6, 4], base: -0.9, name: "Moon Base habitat", outside: "moon" },
  rover: { shape: "box", size: [3.4, 2, 2.4], base: -0.8, name: "Rover cabin", outside: "moon" },
  earth: { shape: "box", size: [5, 2.6, 4], base: -0.9, name: "Cabin on Earth", outside: "earth" },
};

/** The droplet on its holder: where it floats, and how much larger than life it is drawn. */
export const DROPLET = { at: [0.25, 0.14, 0] as V3, scale: 18 };

/** Flame radius, metres in the scene, for a droplet of d mm: the flame stands off about 2.6 droplet diameters. */
export const flameRadius = (dMm: number) => ((dMm * 2.6) / 2 / 1000) * DROPLET.scale + 0.004;

export type Pose = { pos: V3; target: V3; fov: number };

/** Home view: close on the fire. The burn looks at the droplet; the spread looks along the bench. */
export function homePose(base: BaseId, mode: Mode): Pose {
  if (mode === "spread") {
    const r = ROOMS[base];
    // Moon Base: stand back and up, aimed between the ignition point and the bench's middle, so the room shows above
    // the bench and the start stays in frame on a phone.
    // ISS: from upstream, low and to the near side, looking along the module past the ignition point.
    if (base === "iss") return { pos: [-0.15, 0.78, 0.7], target: [0.45, 0.02, -0.3], fov: 66 };
    if (base === "moon") return { pos: [0.15, 0.82, 1.8], target: [0.35, 0.12, -0.15], fov: 55 };
    const back = r.shape === "box" ? Math.min(1.5, r.size[2] / 2 - 0.15) : 0.85;
    return { pos: [0.55, 0.62, back], target: [0.7, 0, -0.05], fov: r.shape === "tube" ? 64 : 50 };
  }
  const [x, y, z] = DROPLET.at;
  return { pos: [x - 0.22, y + 0.2, z + 0.72], target: [x, y - 0.06, z], fov: 40 };
}

/** Where a label chip is anchored, beside the thing it names, in scene units. */
export const chipAnchor = (at: V3, r: number): V3 => [at[0] + r * 1.25, at[1] + r * 1.1, at[2]];

/** Screen position (px) and the radius in px of a sphere at `at`, seen from a pose in a w x h box. */
export function project(pose: Pose, w: number, h: number, at: V3, radius = 0): { x: number; y: number; r: number; inFront: boolean } {
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: V3): V3 => {
    const l = Math.hypot(...a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const fwd = norm(sub(pose.target, pose.pos));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const rel = sub(at, pose.pos);
  const depth = dot(rel, fwd);
  const f = h / 2 / Math.tan((pose.fov * Math.PI) / 360);
  return {
    x: w / 2 + (dot(rel, right) / depth) * f,
    y: h / 2 - (dot(rel, up) / depth) * f,
    r: (radius / depth) * f,
    inFront: depth > 0,
  };
}

/**
 * View offset (px) that moves the focus point from where the pose puts it to the middle of a clear zone of the
 * stage. Null when the zone is empty. The shift is capped at a third of the box, so the cabin never slides away.
 */
export function lensShift(pose: Pose, w: number, h: number, focus: V3, zone: { x: number; y: number; w: number; h: number }): { x: number; y: number } | null {
  if (!(zone.w > 0 && zone.h > 0)) return null;
  const p = project(pose, w, h, focus);
  const cap = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return { x: cap(p.x - (zone.x + zone.w / 2), w / 3), y: cap(p.y - (zone.y + zone.h / 2), h / 3) };
}

/** The room's middle along x: the cabin is drawn around x = 0.8 (Cabin.tsx). */
const ROOM_X = 0.8;

/**
 * Camera limits, applied after every orbit, pan, zoom or nudge. The orbit point stays within `leash` x the camera's
 * distance of `focus`, so panning cannot lose the fire and zooming in closes on it (the camera moves with the point).
 * Then the camera stays `margin` inside the walls of `room`. Mutates `cam` and `target`; true when anything moved.
 */
export function keepInView(cam: V3, target: V3, focus: V3, leash: number, room?: Room, margin = 0.08): boolean {
  let moved = false;
  const dist = Math.hypot(cam[0] - target[0], cam[1] - target[1], cam[2] - target[2]);
  const off = [target[0] - focus[0], target[1] - focus[1], target[2] - focus[2]];
  const len = Math.hypot(...off);
  const max = leash * dist;
  if (len > max) {
    const k = max / len;
    for (let i = 0; i < 3; i++) {
      const next = focus[i] + off[i] * k;
      cam[i] += next - target[i];
      target[i] = next;
    }
    moved = true;
  }
  if (!room) return moved;
  const clamp = (i: number, lo: number, hi: number) => {
    const v = Math.min(hi, Math.max(lo, cam[i]));
    if (v !== cam[i]) (cam[i] = v), (moved = true);
  };
  const [l, h, d] = room.size;
  clamp(0, ROOM_X - l / 2 + margin, ROOM_X + l / 2 - margin);
  if (room.shape === "box") {
    clamp(1, room.base + margin, room.base + h - margin);
    clamp(2, -d / 2 + margin, d / 2 - margin);
  } else {
    // Tube along x: radius h around the axis at y = base, z = 0.
    const dy = cam[1] - room.base;
    const r = Math.hypot(dy, cam[2]);
    const lim = h - margin;
    if (r > lim) {
      cam[1] = room.base + (dy * lim) / r;
      cam[2] = (cam[2] * lim) / r;
      moved = true;
    }
  }
  return moved;
}

/**
 * Where the story's places stand in each base, defined here only: the air vent (upstream of the cloth), the smoke
 * detector (its x is the story's DETECTOR.x, where the smoke is checked; height and depth follow the base's mount),
 * the locker, the airflow arrows, where the smoke gathers, and the three start points (on their props). The bench
 * line, and so the burn and the spread, is the same in every base.
 */
export type Anchors = {
  vent: V3;
  detector: V3;
  locker: V3;
  airflow: V3;
  smoke: V3;
  starts: Record<StartId, V3>;
};
export type StartId = "cloth" | "checklist" | "foam";

/** Per base: the detector's mount (height, depth) and the vent's place. */
const MOUNT: Record<BaseId, { detector: [number, number]; vent: V3 }> = {
  iss: { detector: [0.15, -0.3], vent: [-0.74, 0.08, -0.04] },
  moon: { detector: [0.15, -0.3], vent: [-0.74, 0.08, -0.04] },
  rover: { detector: [0.15, -0.3], vent: [-0.74, 0.08, -0.04] },
  earth: { detector: [0.15, -0.3], vent: [-0.74, 0.08, -0.04] },
};

const objAt = (id: string, y = 0): V3 => {
  const o = OBJECTS.find((x) => x.id === id)!;
  return [(o.x0 + o.x1) / 2, o.hd[0] + y, o.z];
};

export function anchorsOf(base: BaseId): Anchors {
  const m = MOUNT[base];
  return {
    vent: m.vent,
    detector: [DETECTOR.x, ...m.detector],
    locker: objAt("locker"),
    airflow: [-0.35, 0.26, -0.1],
    smoke: [WEAK_FLOW_X, 0.12, -0.04],
    starts: { cloth: objAt("cloth"), checklist: objAt("checklist"), foam: objAt("foam") },
  };
}

/** Inside the room's walls (with a margin), for the anchor check. */
export function insideRoom(room: Room, p: V3, margin = 0.05): boolean {
  const [l, h, d] = room.size;
  if (p[0] < ROOM_X - l / 2 + margin || p[0] > ROOM_X + l / 2 - margin) return false;
  if (room.shape === "box") return p[1] > room.base + margin && p[1] < room.base + h - margin && Math.abs(p[2]) < d / 2 - margin;
  return Math.hypot(p[1] - room.base, p[2]) < h - margin;
}
