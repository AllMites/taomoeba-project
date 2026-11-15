import { describe, expect, it } from "vitest";
import type { Rect } from "../zone.ts";
import { calloutState, nearestOn, nextPick, placeCard } from "./callout.ts";

describe("callout states (17.5): none, preview, pinned, and deselect", () => {
  it("shows nothing for an object neither hovered nor pinned", () => {
    expect(calloutState(null, null)).toEqual({ pinned: null, preview: null });
  });
  it("hover shows a preview; a click pins it, and the preview gives way to the pinned card", () => {
    expect(calloutState("foam", null)).toEqual({ pinned: null, preview: "foam" });
    const picked = nextPick(null, "foam");
    expect(calloutState("foam", picked)).toEqual({ pinned: "foam", preview: null });
  });
  it("one pinned at a time; a preview of another object may show beside it", () => {
    let picked = nextPick(null, "foam");
    picked = nextPick(picked, "cloth");
    expect(calloutState("locker", picked)).toEqual({ pinned: "cloth", preview: "locker" });
  });
  it("pressing the pinned object again deselects it, and nothing shows once the pointer leaves", () => {
    const picked = nextPick(nextPick(null, "foam"), "foam");
    expect(picked).toBeNull();
    expect(calloutState(null, picked)).toEqual({ pinned: null, preview: null });
  });
});

describe("callout placement (17.5): inside the stage and out of every keep-out box", () => {
  const stage = { w: 1283, h: 744 };
  const card = { w: 320, h: 220 };
  // The stage's glass at 1440 x 900: the top strip, the caption, the Scenario button, the hint, the bottom bar.
  const keepOut: Rect[] = [
    { x: 16, y: 112, w: 1250, h: 46 },
    { x: 16, y: 166, w: 590, h: 46 },
    { x: 1130, y: 166, w: 136, h: 44 },
    { x: 540, y: 680, w: 210, h: 28 },
    { x: 0, y: 696, w: 1283, h: 48 },
  ];
  const clear = (p: { x: number; y: number }) => keepOut.every((k) => p.x >= k.x + k.w || k.x >= p.x + card.w || p.y >= k.y + k.h || k.y >= p.y + card.h);
  const inside = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x + card.w <= stage.w && p.y + card.h <= stage.h;

  it.each([
    [640, 400],
    [100, 400],
    [1200, 420],
    [640, 230],
    [640, 660],
    [80, 250],
    [1250, 640],
    [400, 300],
  ])("an object at (%i, %i): the card is inside and clear, and does not cover the object", (x, y) => {
    const p = placeCard({ x, y, inFront: true }, card, stage, keepOut);
    expect(inside(p)).toBe(true);
    expect(clear(p)).toBe(true);
    expect(p.docked).toBe(false);
    expect(x >= p.x && x <= p.x + card.w && y >= p.y && y <= p.y + card.h).toBe(false);
  });

  it("the leader line runs from the object to the card's nearest edge", () => {
    const p = placeCard({ x: 640, y: 400, inFront: true }, card, stage, keepOut);
    expect(p.line.slice(0, 2)).toEqual([640, 400]);
    expect(p.line.slice(2)).toEqual(nearestOn({ x: p.x, y: p.y, ...card }, 640, 400));
  });

  it.each([
    [-400, 400, true],
    [1800, 300, true],
    [640, 400, false],
  ] as const)("an object off screen or behind the camera (%i, %i, in front %s): the card docks at the edge, inside the stage", (x, y, inFront) => {
    const p = placeCard({ x, y, inFront }, card, stage, keepOut);
    expect(p.docked).toBe(true);
    expect(inside(p)).toBe(true);
    // The line ends on the stage edge it points through.
    const [ax, ay] = p.line;
    expect(ax <= 0.5 || ax >= stage.w - 0.5 || ay <= 0.5 || ay >= stage.h - 0.5).toBe(true);
  });

  it("a phone: a card 60% of the stage wide still lands inside and clear", () => {
    const phone = { w: 390, h: 560 };
    const c = { w: 234, h: 200 };
    const ko: Rect[] = [{ x: 8, y: 8, w: 374, h: 100 }, { x: 0, y: 512, w: 390, h: 48 }];
    for (const [x, y] of [[195, 300], [40, 350], [350, 250]]) {
      const p = placeCard({ x, y, inFront: true }, c, phone, ko);
      expect(p.x >= 0 && p.x + c.w <= phone.w && p.y >= 0 && p.y + c.h <= phone.h).toBe(true);
      expect(ko.every((k) => p.x >= k.x + k.w || k.x >= p.x + c.w || p.y >= k.y + k.h || k.y >= p.y + c.h)).toBe(true);
    }
  });
});
