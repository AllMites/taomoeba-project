import type { RankFactor } from "../contracts/index.ts";
import { covers, fmt, rangeText, scalePct, TICK_BELOW } from "./logic.ts";

/**
 * Fixed 0 to 100% oxygen scale. No hue: the tested span is solid when it covers the habitat and a dashed
 * outline when it misses, and the caption says which in words. A range narrower than one point is a tick, not a
 * widened span. The habitat is an accent marker with its value above it.
 */
export default function OxygenBar({
  range,
  habitatO2,
  factor,
  id,
}: {
  range: [number, number] | null;
  habitatO2: number;
  factor?: RankFactor;
  id?: string;
}) {
  if (!range)
    return (
      <span className="rk-o2-none" id={id}>
        Oxygen: not on record
      </span>
    );
  const left = scalePct(range[0]);
  const width = scalePct(range[1]) - left;
  const tick = range[1] - range[0] < TICK_BELOW;
  const hit = covers(range, habitatO2);
  const label = factor?.reason ?? `Tested at ${rangeText(range)} oxygen; this habitat has ${fmt(habitatO2)}%.`;
  const mark = scalePct(habitatO2);
  return (
    <span className="rk-o2" id={id} data-covers={hit}>
      <span className="rk-o2-track" role="img" aria-label={label} title={label}>
        {tick ? (
          <span className="rk-o2-tick" style={{ left: `${left}%` }} />
        ) : (
          <span className="rk-o2-span" style={{ left: `${left}%`, width: `${width}%` }} />
        )}
        <span className="rk-o2-mark" style={{ left: `${mark}%` }}>
          <span className="rk-o2-val t-readout" aria-hidden="true">
            {fmt(habitatO2)}%
          </span>
        </span>
      </span>
      <span className="rk-o2-cap" aria-hidden="true">
        <span className="t-readout">0</span>
        <span>
          Tested {rangeText(range)} · {hit ? <b className="rk-o2-hit">covers yours</b> : "misses yours"}
        </span>
        <span className="t-readout">100%</span>
      </span>
    </span>
  );
}
