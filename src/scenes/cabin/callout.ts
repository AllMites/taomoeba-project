// Object details as callouts in the scene (PRD 17.5): a glass card joined to the object by a leader line. Which
// callout shows (none, a hover preview, a pinned card) and where its card goes on the stage, clear of the glass
// laid over the replay. Pure, so it is tested without a browser.
import type { Rect } from "../zone.ts";

export type Callouts = { pinned: string | null; preview: string | null };

/** What shows: the picked object pinned; the hovered one as a preview, unless it is the pinned one. */
export function calloutState(hovered: string | null, picked: string | null): Callouts {
  return { pinned: picked, preview: hovered && hovered !== picked ? hovered : null };
}

/** A press on an object (in the scene or its row in the panel) pins it, or unpins it when it is already pinned. */
export const nextPick = (current: string | null, pressed: string) => (current === pressed ? null : pressed);

export type Placed = {
  /** Card's top-left, px in the stage. */
  x: number;
  y: number;
  /** The object is off screen: the card sits at the stage edge nearest it, its line pointing off. */
  docked: boolean;
  /** The leader line, from the object's anchor (or the edge it points through) to the card's nearest edge. */
  line: [number, number, number, number];
};

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** The point of a rectangle nearest to (px, py). */
export function nearestOn(r: Rect, px: number, py: number): [number, number] {
  return [Math.max(r.x, Math.min(r.x + r.w, px)), Math.max(r.y, Math.min(r.y + r.h, py))];
}

/**
 * Where a w x h card goes for an object seen at `at` (px in a `stage`), clear of the `keepOut` boxes. Beside the
 * object first (right, left, above, below, then the diagonals, a `gap` away), the first spot that is inside the stage
 * and clear wins; else the spot that covers least. An object behind the camera or off the stage docks its card at
 * the nearest stage edge, inside it and clear where it can be.
 */
export function placeCard(at: { x: number; y: number; inFront: boolean }, card: { w: number; h: number }, stage: { w: number; h: number }, keepOut: Rect[], gap = 28, margin = 8): Placed {
  const { w, h } = card;
  const fits = (x: number, y: number) => x >= margin && y >= margin && x + w <= stage.w - margin && y + h <= stage.h - margin;
  const clampX = (x: number) => Math.max(margin, Math.min(stage.w - margin - w, x));
  const clampY = (y: number) => Math.max(margin, Math.min(stage.h - margin - h, y));
  const cost = (x: number, y: number) => keepOut.reduce((s, k) => s + overlap({ x, y, w, h }, k), 0);
  const onStage = at.inFront && at.x >= 0 && at.x <= stage.w && at.y >= 0 && at.y <= stage.h;

  let tries: [number, number][];
  let ax = at.x;
  let ay = at.y;
  if (onStage) {
    tries = [
      [at.x + gap, at.y - h / 2],
      [at.x - gap - w, at.y - h / 2],
      [at.x - w / 2, at.y - gap - h],
      [at.x - w / 2, at.y + gap],
      [at.x + gap, at.y - gap - h],
      [at.x - gap - w, at.y - gap - h],
      [at.x + gap, at.y + gap],
      [at.x - gap - w, at.y + gap],
    ];
  } else {
    // Behind the camera the projection mirrors: point the other way.
    const dx = (at.inFront ? 1 : -1) * (at.x - stage.w / 2);
    const dy = (at.inFront ? 1 : -1) * (at.y - stage.h / 2);
    const k = Math.min(Math.abs(stage.w / 2 / (dx || 1e-6)), Math.abs(stage.h / 2 / (dy || 1e-6)));
    ax = stage.w / 2 + dx * k;
    ay = stage.h / 2 + dy * k;
    const ex = clampX(ax - w / 2);
    const ey = clampY(ay - h / 2);
    // Along the edge it points through, sliding to clear the glass.
    tries = [-1, 1, -2, 2, -3, 3, -4, 4].reduce<[number, number][]>((acc, i) => {
      const along = Math.abs(dx) * stage.h > Math.abs(dy) * stage.w ? [ex, clampY(ey + (i * h) / 2)] : [clampX(ex + (i * w) / 2), ey];
      acc.push(along as [number, number]);
      return acc;
    }, [[ex, ey]]);
  }
  let best: [number, number] | null = null;
  let bestCost = Infinity;
  for (const [x, y] of tries) {
    const inside = fits(x, y);
    const cx = inside ? x : clampX(x);
    const cy = inside ? y : clampY(y);
    const c = cost(cx, cy) + (inside ? 0 : 1);
    if (c === 0) {
      best = [cx, cy];
      break;
    }
    if (c < bestCost) {
      bestCost = c;
      best = [cx, cy];
    }
  }
  const [x, y] = best!;
  const [lx, ly] = nearestOn({ x, y, w, h }, ax, ay);
  return { x, y, docked: !onStage, line: [ax, ay, lx, ly] };
}
