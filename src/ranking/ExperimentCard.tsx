import { useId } from "react";
import { askAbout, dragProps } from "../app/console.ts";
import { useStore } from "../app/store.ts";
import { cardTransitionName, openFromCard } from "../app/motion.ts";
import { displayClass } from "../app/type.ts";
import FactorDots from "./FactorDots.tsx";
import { rankNumeral, type Row } from "./logic.ts";
import OxygenBar from "./OxygenBar.tsx";
import PdsTag from "./PdsTag.tsx";

/** "Ask about this": scopes the next question to this experiment and opens the Ask panel. Same result as dragging the card there. */
export function AskAboutButton({ id, title }: { id: string; title: string }) {
  return (
    <button type="button" className="quiet rk-ask" aria-label={`Ask about ${title}`} onClick={() => askAbout(id)}>
      Ask about this
    </button>
  );
}

export default function ExperimentCard({ row, habitatO2, lit, litIndex = 0 }: { row: Row; habitatO2: number; lit: boolean; litIndex?: number }) {
  const selected = useStore((s) => s.selectedInvestigationId === row.inv.id);
  const { inv, item } = row;
  const uid = useId();
  const ids = (...parts: (string | false | null | undefined)[]) =>
    parts.filter(Boolean).map((p) => `${uid}-${p}`).join(" ");
  // Short name (rank, title, lit), the rest as description: the whole card as a name ran to ~600 characters.
  return (
    // The row is the drag handle (a <button> does not start a drag in every browser); the Ask panel is the drop target.
    <li className="rk-li" style={{ viewTransitionName: cardTransitionName(inv.id) }} {...dragProps(inv.id)}>
      <button
        type="button"
        className="rk-card"
        data-id={inv.id}
        data-lit={lit}
        data-selected={selected}
        style={lit ? ({ "--lit-i": litIndex } as React.CSSProperties) : undefined}
        aria-haspopup="dialog"
        aria-labelledby={ids("n", "t", lit && "l")}
        aria-describedby={ids("m", row.summary && "s", "o", item.factors && "f", "w")}
        onClick={(e) => openFromCard(e.currentTarget, inv.id)}
      >
        <span className="rk-head">
          <span className="rk-num t-display" id={`${uid}-n`} aria-label={`Rank ${row.position}`}>
            {rankNumeral(row.position)}
          </span>
          <span className="rk-headtext">
            {lit && (
              <span className="rk-lit t-readout" id={`${uid}-l`}>
                In the answer
              </span>
            )}
            <span className={`rk-title ${displayClass(inv.title)}`} id={`${uid}-t`}>
              {inv.title}
            </span>
            <span className="rk-meta" id={`${uid}-m`}>
              <PdsTag pds={inv.pds} />
              <span className="rk-id t-readout">{inv.id}</span>
            </span>
          </span>
        </span>
        {row.summary && (
          <span className="rk-sum" id={`${uid}-s`}>
            <span className="rk-label t-readout">Summarize</span>
            {row.summary}
          </span>
        )}
        <OxygenBar id={`${uid}-o`} range={inv.o2Range} habitatO2={habitatO2} factor={item.factors?.find((f) => f.key === "o2")} />
        {item.factors && <FactorDots id={`${uid}-f`} factors={item.factors} />}
        <span className="rk-why" id={`${uid}-w`}>
          {item.rationale}
        </span>
      </button>
      <AskAboutButton id={inv.id} title={inv.title} />
    </li>
  );
}
