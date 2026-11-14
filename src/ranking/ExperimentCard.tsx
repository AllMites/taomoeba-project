import { useStore } from "../app/store.ts";
import FactorDots from "./FactorDots.tsx";
import type { Row } from "./logic.ts";
import OxygenBar from "./OxygenBar.tsx";
import PdsTag from "./PdsTag.tsx";

export default function ExperimentCard({ row, habitatO2, lit }: { row: Row; habitatO2: number; lit: boolean }) {
  const select = useStore((s) => s.setSelectedInvestigationId);
  const selected = useStore((s) => s.selectedInvestigationId === row.inv.id);
  const { inv, item } = row;
  return (
    <li className="rk-li">
      <button
        type="button"
        className="rk-card"
        data-id={inv.id}
        data-lit={lit}
        data-selected={selected}
        aria-haspopup="dialog"
        onClick={() => select(inv.id)}
      >
        <span className="rk-head">
          <span className="rk-num" aria-label={`Rank ${row.position}`}>{row.position}</span>
          <span className="rk-title">{inv.title}</span>
          {lit && <span className="rk-lit">In the answer</span>}
        </span>
        <span className="rk-meta">
          <span className="rk-id">{inv.id}</span>
          <PdsTag pds={inv.pds} />
        </span>
        {row.summary && (
          <span className="rk-sum">
            <span className="rk-label">Summarize</span>
            {row.summary}
          </span>
        )}
        <OxygenBar range={inv.o2Range} habitatO2={habitatO2} factor={item.factors?.find((f) => f.key === "o2")} />
        {item.factors && <FactorDots factors={item.factors} />}
        <span className="rk-why">{item.rationale}</span>
      </button>
    </li>
  );
}
