import { useId } from "react";
import { useStore } from "../app/store.ts";
import { displayClass } from "../app/type.ts";
import FactorDots from "./FactorDots.tsx";
import type { Row } from "./logic.ts";
import OxygenBar from "./OxygenBar.tsx";
import PdsTag from "./PdsTag.tsx";

export default function ExperimentCard({ row, habitatO2, lit }: { row: Row; habitatO2: number; lit: boolean }) {
  const select = useStore((s) => s.setSelectedInvestigationId);
  const selected = useStore((s) => s.selectedInvestigationId === row.inv.id);
  const { inv, item } = row;
  const uid = useId();
  const ids = (...parts: (string | false | null | undefined)[]) =>
    parts.filter(Boolean).map((p) => `${uid}-${p}`).join(" ");
  // Short name (rank, title, lit), the rest as description: the whole card as a name ran to ~600 characters.
  return (
    <li className="rk-li">
      <button
        type="button"
        className="rk-card"
        data-id={inv.id}
        data-lit={lit}
        data-selected={selected}
        aria-haspopup="dialog"
        aria-labelledby={ids("n", "t", lit && "l")}
        aria-describedby={ids("m", row.summary && "s", "o", item.factors && "f", "w")}
        onClick={() => select(inv.id)}
      >
        <span className="rk-head">
          <span className="rk-num t-display" id={`${uid}-n`} aria-label={`Rank ${row.position}`}>
            {row.position}
          </span>
          <span className={`rk-title ${displayClass(inv.title)}`} id={`${uid}-t`}>
            {inv.title}
          </span>
          {lit && (
            <span className="rk-lit" id={`${uid}-l`}>
              In the answer
            </span>
          )}
        </span>
        <span className="rk-meta" id={`${uid}-m`}>
          <span className="rk-id t-readout">{inv.id}</span>
          <PdsTag pds={inv.pds} />
        </span>
        {row.summary && (
          <span className="rk-sum" id={`${uid}-s`}>
            <span className="rk-label">Summarize</span>
            {row.summary}
          </span>
        )}
        <OxygenBar id={`${uid}-o`} range={inv.o2Range} habitatO2={habitatO2} factor={item.factors?.find((f) => f.key === "o2")} />
        {item.factors && <FactorDots id={`${uid}-f`} factors={item.factors} />}
        <span className="rk-why" id={`${uid}-w`}>
          {item.rationale}
        </span>
      </button>
    </li>
  );
}
