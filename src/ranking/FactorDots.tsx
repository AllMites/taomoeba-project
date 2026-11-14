import type { RankFactor } from "../contracts/index.ts";
import { dotLevel, SHORT_LABEL, type DotLevel } from "./logic.ts";

function Dot({ level }: { level: DotLevel }) {
  return (
    <svg className={`rk-dot rk-dot-${level}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      {level === "high" && <circle cx="8" cy="8" r="6.5" className="rk-dot-fill" />}
      {level === "mid" && (
        <>
          <circle cx="8" cy="8" r="6" className="rk-dot-ring" />
          <path d="M8 2a6 6 0 0 0 0 12z" className="rk-dot-fill" />
        </>
      )}
      {level === "low" && <circle cx="8" cy="8" r="6" className="rk-dot-ring" />}
      {level === "unknown" && (
        <>
          <circle cx="8" cy="8" r="6" className="rk-dot-ring rk-dot-dashed" />
          <path d="M4 12L12 4" className="rk-dot-slash" />
        </>
      )}
    </svg>
  );
}

/** Five checks as dots, in the order given. Reasons are in each name; the drawer shows them in full. */
export default function FactorDots({ factors }: { factors: RankFactor[] }) {
  return (
    <span className="rk-dots">
      {factors.map((f) => {
        const name = `${f.label}: ${f.value === null ? "not on record. " : ""}${f.reason}`;
        return (
          <span key={f.key} className="rk-dot-item" role="img" aria-label={name} title={name}>
            <Dot level={dotLevel(f.value)} />
            <span className="rk-dot-label" aria-hidden="true">{SHORT_LABEL[f.key]}</span>
          </span>
        );
      })}
    </span>
  );
}
