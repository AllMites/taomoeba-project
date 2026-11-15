import { describe, expect, it } from "vitest";
import { FLAME_SIZES, flameLayout, freeZone, type Rect } from "./zone.ts";

const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("flame size for a zone", () => {
  it("puts the chips under the flames in a tall zone, and caps the size", () => {
    expect(flameLayout({ w: 600, h: 400 }, 2)).toEqual({ s: FLAME_SIZES.sMax, dir: "column" });
    expect(flameLayout({ w: 400, h: 300 }, 2)).toEqual({ s: 192, dir: "column" });
  });

  it("puts the chips beside the flames in a short, wide zone", () => {
    const lay = flameLayout({ w: 700, h: 110 }, 2);
    expect(lay.dir).toBe("row");
    expect(lay.s).toBe(110);
  });

  it("one flame gets the whole width; nothing fits in an empty zone", () => {
    expect(flameLayout({ w: 300, h: 300 }, 1).s).toBe(220);
    expect(flameLayout({ w: 0, h: 300 }, 2).s).toBe(0);
    expect(flameLayout({ w: 100, h: 30 }, 2).s).toBe(0);
  });
});

describe("clear zone in the replay", () => {
  // 1440 x 900 with no panels: the center is about 1380 x 794.
  const box = { w: 1380, h: 794 };
  const carousel = { x: 357, y: 16, w: 666, h: 90 };
  const caption = { x: 16, y: 112, w: 400, h: 38 };
  const brief = { x: 24, y: 626, w: 404, h: 144 };
  const top3 = { x: 1036, y: 346, w: 320, h: 424 };
  const when = { x: 612, y: 726, w: 156, h: 52 };
  const all = [carousel, caption, brief, top3, when];

  it("stays clear of every glass panel, with a margin", () => {
    const z = freeZone(box, all, 2);
    expect(inside(z, { x: 0, y: 0, ...box })).toBe(true);
    for (const o of all) expect(overlaps(z, { x: o.x - 11, y: o.y - 11, w: o.w + 22, h: o.h + 22 })).toBe(false);
  });

  it("gives the flames a hero size on a desktop", () => {
    expect(freeZone(box, all, 2).s).toBeGreaterThanOrEqual(200);
  });

  it("between two open panels the cards fill most of the box, and the flames still find room", () => {
    const narrow = { w: 700, h: 794 };
    const obstacles = [
      { x: 18, y: 16, w: 664, h: 90 }, // carousel
      { x: 16, y: 112, w: 470, h: 56 }, // caption
      { x: 510, y: 112, w: 174, h: 52 }, // Past | Now
      { x: 24, y: 584, w: 316, h: 186 }, // brief
      { x: 356, y: 346, w: 320, h: 424 }, // top 3
    ];
    const z = freeZone(narrow, obstacles, 2);
    for (const o of obstacles) expect(overlaps(z, o)).toBe(false);
    expect(z.s).toBeGreaterThanOrEqual(120);
  });

  it("prefers the middle when two zones fit the same flames", () => {
    const z = freeZone({ w: 1000, h: 400 }, [{ x: 0, y: 0, w: 1000, h: 50 }], 1);
    expect(Math.abs(z.x + z.w / 2 - 500)).toBeLessThanOrEqual(16);
  });

  it("returns an empty zone when the box is covered", () => {
    expect(freeZone({ w: 400, h: 400 }, [{ x: 0, y: 0, w: 400, h: 400 }], 2).s).toBe(0);
  });
});
