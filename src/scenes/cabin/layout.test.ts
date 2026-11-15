import { describe, expect, it } from "vitest";
import { BASE_ORDER } from "../../app/console.ts";
import { chipAnchor, DROPLET, flameRadius, homePose, project } from "./layout.ts";

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
