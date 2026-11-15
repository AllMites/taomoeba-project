import { describe, expect, it } from "vitest";
import { BASE_ORDER } from "../../app/console.ts";
import { chipAnchor, DROPLET, flameRadius, homePose, keepInView, lensShift, project, ROOMS, type V3 } from "./layout.ts";

// The center replay at 1440 x 900 with no side panels is about 1380 x 794.
const W = 1380;
const H = 794;

describe("the fire is large and in the scene in the first frame (defect: flames were 6 px dots)", () => {
  it.each(BASE_ORDER)("%s: the model-burn flame is at least 120 px across, near the middle, with its chip beside it", (base) => {
    const pose = homePose(base, "burn");
    const r = flameRadius(2);
    const flame = project(pose, W, H, DROPLET.at, r);
    expect(flame.inFront).toBe(true);
    expect(flame.r * 2).toBeGreaterThanOrEqual(120);
    // Clear of the brief (bottom left) and the top-3 card (bottom right): the flame sits in the middle band.
    expect(Math.abs(flame.x - W / 2)).toBeLessThan(W * 0.15);
    expect(flame.y).toBeGreaterThan(H * 0.25);
    expect(flame.y).toBeLessThan(H * 0.65);
    const chip = project(pose, W, H, chipAnchor(DROPLET.at, r));
    expect(Math.hypot(chip.x - flame.x, chip.y - flame.y)).toBeLessThan(flame.r * 2.5);
    expect(Math.hypot(chip.x - flame.x, chip.y - flame.y)).toBeGreaterThan(flame.r);
  });

  it.each(BASE_ORDER)("%s: the fire-spread view looks at the ignition point on the bench", (base) => {
    const pose = homePose(base, "spread");
    const ign = project(pose, W, H, [0, 0, 0]);
    expect(ign.inFront).toBe(true);
    expect(ign.x).toBeGreaterThan(0);
    expect(ign.x).toBeLessThan(W);
    expect(ign.y).toBeGreaterThan(H * 0.2);
    expect(ign.y).toBeLessThan(H * 0.8);
  });
});

describe("the fire sits in the clear part of the stage", () => {
  it("shifts the picture so the flame lands in the middle of the zone, and not at all for an empty zone", () => {
    const pose = homePose("moon", "burn");
    const at = project(pose, W, H, DROPLET.at);
    const zone = { x: 100, y: 300, w: 400, h: 300 };
    const off = lensShift(pose, W, H, DROPLET.at, zone)!;
    // A view offset of (ox, oy) moves the picture by (-ox, -oy).
    expect(at.x - off.x).toBeCloseTo(300, 6);
    expect(at.y - off.y).toBeCloseTo(450, 6);
    expect(lensShift(pose, W, H, DROPLET.at, { x: 0, y: 0, w: 0, h: 0 })).toBeNull();
  });
  it("never slides the cabin more than a third of the box", () => {
    const off = lensShift(homePose("iss", "burn"), W, H, DROPLET.at, { x: 0, y: 0, w: 10, h: 10 })!;
    expect(Math.abs(off.x)).toBeLessThanOrEqual(W / 3);
    expect(Math.abs(off.y)).toBeLessThanOrEqual(H / 3);
  });
});

describe("camera limits keep the fire in view and the camera inside the cabin (P1-2, P1-3, P1-4)", () => {
  const LEASH = 0.1;
  const inside = (base: keyof typeof ROOMS, cam: V3) => {
    const r = ROOMS[base];
    if (r.shape === "tube") return Math.hypot(cam[1] - r.base, cam[2]) < r.size[1];
    return cam[1] > r.base && cam[1] < r.base + r.size[1] && Math.abs(cam[2]) < r.size[2] / 2;
  };

  it.each(BASE_ORDER)("%s: the home views are already within the limits", (base) => {
    for (const mode of ["burn", "spread"] as const) {
      const p = homePose(base, mode);
      const cam = [...p.pos] as V3;
      const target = [...p.target] as V3;
      expect(keepInView(cam, target, mode === "burn" ? DROPLET.at : p.target, mode === "burn" ? LEASH : 0.3, ROOMS[base])).toBe(false);
    }
  });

  it("a long pan is pulled back so the flame stays near the middle", () => {
    const home = homePose("iss", "burn");
    const cam: V3 = [home.pos[0] + 1.2, home.pos[1], home.pos[2]];
    const target: V3 = [home.target[0] + 1.2, home.target[1], home.target[2]];
    keepInView(cam, target, DROPLET.at, LEASH, ROOMS.iss);
    const flame = project({ pos: cam, target, fov: home.fov }, W, H, DROPLET.at);
    expect(Math.abs(flame.x - W / 2)).toBeLessThan(W * 0.25);
    expect(Math.abs(flame.y - H / 2)).toBeLessThan(H * 0.25);
  });

  it("zoomed in all the way, the orbit point closes on the droplet so the flame does not rise off the top", () => {
    const home = homePose("iss", "burn");
    const target = [...home.target] as V3;
    const dir = home.pos.map((v, i) => v - home.target[i]);
    const len = Math.hypot(...dir);
    const cam = target.map((v, i) => v + (dir[i] / len) * 0.12) as V3;
    keepInView(cam, target, DROPLET.at, LEASH, ROOMS.iss);
    const flame = project({ pos: cam, target, fov: home.fov }, W, H, DROPLET.at);
    expect(Math.abs(flame.y - H / 2)).toBeLessThan(H * 0.15);
  });

  it.each(BASE_ORDER)("%s: zooming out and tilting cannot take the camera through the walls", (base) => {
    for (const far of [[0.25, 3, 0.5], [0.25, 0.1, 3.5], [5, 0.2, 0], [0.25, -3, -2]] as V3[]) {
      const cam = [...far] as V3;
      const target = [...DROPLET.at] as V3;
      keepInView(cam, target, DROPLET.at, LEASH, ROOMS[base]);
      expect(inside(base, cam)).toBe(true);
    }
  });
});

describe("every base defines the story's places inside its own room (17.4)", () => {
  it.each(BASE_ORDER)("%s: vent, detector, locker, airflow, smoke and the three start points are inside the walls", async (base) => {
    const { anchorsOf, insideRoom } = await import("./layout.ts");
    const { STARTS, DETECTOR } = await import("../spread/story.ts");
    const a = anchorsOf(base);
    for (const k of ["vent", "detector", "locker", "airflow", "smoke"] as const) expect(insideRoom(ROOMS[base], a[k]), `${base} ${k}`).toBe(true);
    for (const s of STARTS) expect(insideRoom(ROOMS[base], a.starts[s.id as keyof typeof a.starts]), `${base} ${s.id}`).toBe(true);
    // The detector stands where the story checks the smoke.
    expect(a.detector[0]).toBe(DETECTOR.x);
    // The vent is upstream of the cloth (the flow runs along +x).
    expect(a.vent[0]).toBeLessThan(a.starts.cloth[0]);
  });
});
