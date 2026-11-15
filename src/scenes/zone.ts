// Where the flames go in the center replay. The console lays glass over the replay (the base carousel, the
// caption, the Past | Now switch, the brief and the top-3 card), and their sizes change with the panels and the
// data. The flames take the clear part of the box that lets them be largest. Pure, so it is tested without a browser.

export type Rect = { x: number; y: number; w: number; h: number };

export type FlameLayout = {
  /** Flame slot side, px. 0 when nothing fits. */
  s: number;
  /** "column": label chip under its flame. "row": chip beside it (a short, wide zone). */
  dir: "column" | "row";
};

/** Sizes the layout reasons with, px. The chip is the glass label under (or beside) each flame. */
export const FLAME_SIZES = { gap: 16, chipH: 60, chipW: 140, chipMinW: 128, sMax: 220 } as const;

/** The largest flame slot that fits `n` flames and their chips in a zone, and which way the chips go. */
export function flameLayout(zone: Pick<Rect, "w" | "h">, n: number, k = FLAME_SIZES): FlameLayout {
  if (n < 1 || zone.w <= 0 || zone.h <= 0) return { s: 0, dir: "column" };
  const colW = (zone.w - (n - 1) * k.gap) / n;
  const below = colW >= k.chipMinW ? Math.min(colW, zone.h - k.chipH - k.gap / 2, k.sMax) : 0;
  const beside = Math.min(colW - k.chipW - k.gap / 2, zone.h, k.sMax);
  const s = Math.max(0, below, beside);
  return { s: Math.floor(s), dir: beside > below ? "row" : "column" };
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The clear rectangle of a `w` x `h` box, away from every obstacle by `margin`, in which `n` flames come out
 * largest. Ties go to the rectangle nearer the box's centre line. Grid search on `cell` px cells: each row's
 * run of clear cells above it (a histogram) gives every maximal rectangle ending on that row.
 */
export function freeZone(box: { w: number; h: number }, obstacles: Rect[], n: number, cell = 16, margin = 12): Rect & FlameLayout {
  const cols = Math.max(1, Math.floor((box.w - 2 * margin) / cell));
  const rows = Math.max(1, Math.floor((box.h - 2 * margin) / cell));
  const ox = (box.w - cols * cell) / 2;
  const oy = (box.h - rows * cell) / 2;
  const grown = obstacles.filter((o) => o.w > 0 && o.h > 0).map((o) => ({ x: o.x - margin, y: o.y - margin, w: o.w + 2 * margin, h: o.h + 2 * margin }));
  const height = new Array<number>(cols).fill(0);
  let best: Rect & FlameLayout = { x: 0, y: 0, w: 0, h: 0, s: 0, dir: "column" };
  let bestScore = -Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const free = !grown.some((o) => hit(o, { x: ox + c * cell, y: oy + r * cell, w: cell, h: cell }));
      height[c] = free ? height[c] + 1 : 0;
    }
    for (let c0 = 0; c0 < cols; c0++) {
      let min = Infinity;
      for (let c1 = c0; c1 < cols && height[c1] > 0; c1++) {
        min = Math.min(min, height[c1]);
        const rect = { x: ox + c0 * cell, y: oy + (r - min + 1) * cell, w: (c1 - c0 + 1) * cell, h: min * cell };
        const lay = flameLayout(rect, n);
        // Size first; then, by less than one cell of size, the zone whose middle is nearer the box's middle.
        const off = Math.abs(rect.x + rect.w / 2 - box.w / 2) / Math.max(1, box.w);
        const score = lay.s - off * (cell / 2);
        if (score > bestScore) {
          bestScore = score;
          best = { ...rect, ...lay };
        }
      }
    }
  }
  return best;
}

/**
 * Keep-out for a stack of glass that grows down from `stack.y` (the Saffire fact chips): how tall it may get before
 * it reaches `card` (the top-3 card) less `margin`. Null when the card is not below it in the same columns.
 */
export function roomAbove(stack: Rect, card: Rect | null, margin = 12): number | null {
  if (!card || card.w <= 0 || card.h <= 0) return null;
  if (stack.x >= card.x + card.w || card.x >= stack.x + stack.w || card.y + card.h <= stack.y) return null;
  return Math.max(0, card.y - margin - stack.y);
}
