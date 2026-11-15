// Fit a model into the scene by its bounding box. The two NASA ISS files differ in scale, orientation and pivot
// (docs/lane-reports/rs-t.md), so each is measured after its own transforms and placed the same way. Pure maths.

export type Box = { min: readonly [number, number, number]; max: readonly [number, number, number] };

/**
 * Uniform scale and offset that put the box's centre at the origin and its longest side (or the side along
 * `axis`, 0 = x) at `span` units.
 */
export function fitBox(box: Box, span: number, axis?: 0 | 1 | 2): { scale: number; offset: [number, number, number] } {
  const size = [0, 1, 2].map((i) => box.max[i] - box.min[i]);
  const longest = axis === undefined ? Math.max(...size) : size[axis];
  if (!(longest > 0) || !Number.isFinite(longest)) return { scale: 1, offset: [0, 0, 0] };
  const scale = span / longest;
  const centre = [0, 1, 2].map((i) => (box.min[i] + box.max[i]) / 2);
  return { scale, offset: [-centre[0] * scale, -centre[1] * scale, -centre[2] * scale] };
}

/** Mono grey of the same lightness as an RGB colour (0..1), kept in a band that reads under one sun. */
export function monoGrey(r: number, g: number, b: number, lo = 0.12, hi = 0.5): number {
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  return Math.min(hi, Math.max(lo, l));
}
