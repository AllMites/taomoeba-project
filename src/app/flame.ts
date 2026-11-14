import type { CSSProperties } from "react";

/** Oxygen range the sphere responds over: soft and large at sea-level air, tight and bright at 30%. */
export const FLAME_O2 = { soft: 21, hot: 30 };

/**
 * The two custom properties that drive the hero sphere for a habitat's oxygen.
 * --flame-size: 1 at 21% (larger, softer), 0.78 at 30% (tighter). --flame-glow: 0 at 21%, 1 at 30%.
 * Values outside the range clamp to its ends.
 */
export function flameVars(o2Percent: number): CSSProperties {
  const t = Math.min(1, Math.max(0, (o2Percent - FLAME_O2.soft) / (FLAME_O2.hot - FLAME_O2.soft)));
  return { "--flame-size": (1 - 0.22 * t).toFixed(3), "--flame-glow": t.toFixed(3) } as CSSProperties;
}
