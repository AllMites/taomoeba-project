import type { RankFactor } from "../contracts/index.ts";
import { fmt, rangeText, scalePct } from "./logic.ts";

/** Fixed 0 to 100% oxygen scale: tested range as a filled span, habitat as a marker. */
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
  const width = Math.max(scalePct(range[1]) - left, 2); // a single tested value still shows
  const label = factor?.reason ?? `Tested at ${rangeText(range)} oxygen; this habitat has ${fmt(habitatO2)}%.`;
  return (
    <span className="rk-o2" id={id}>
      <span className="rk-o2-track" role="img" aria-label={label} title={label}>
        <span className="rk-o2-span" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
        <span className="rk-o2-mark" style={{ left: `${scalePct(habitatO2)}%` }} />
      </span>
      <span className="rk-o2-cap" aria-hidden="true">
        <span>0%</span>
        <span>Tested {rangeText(range)} · here {fmt(habitatO2)}%</span>
        <span>100%</span>
      </span>
    </span>
  );
}
