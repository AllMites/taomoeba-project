import { useEffect, useMemo } from "react";
import Ask from "../ask/index.tsx";
import Brief from "../brief/index.tsx";
import Compare from "../compare/index.tsx";
import type { Investigation } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import Earth from "../earth/index.tsx";
import Evidence from "../evidence/index.tsx";
import Gaps from "../gaps/index.tsx";
import Graph from "../graph/index.tsx";
import Library from "../library/index.tsx";
import Ranking from "../ranking/index.tsx";
import Stage from "../scenes/Stage.tsx";
import Carousel from "../shell/Carousel.tsx";
import { Rail, StatusStrip, TopBar } from "../shell/chrome.tsx";
import { Icon } from "../shell/icons.tsx";
import { openRankOnHighlight } from "../shell/logic.ts";
import Sheet from "../shell/Sheet.tsx";
import TopForBase, { BriefLine } from "../top/index.tsx";
import Trust from "../trust/index.tsx";
import WhatIf from "../whatif/index.tsx";
import "./app.css";
import { useConsole } from "./console.ts";

/** Counts behind the limits block, all from the fire experiments (pds is not "Other"). */
export function limitsFrom(items: Investigation[]) {
  const fire = items.filter((i) => i.pds !== "Other");
  return {
    total: fire.length,
    flight: fire.filter((i) => i.evidence === "flight").length,
    ground: fire.filter((i) => i.evidence === "ground").length,
    noO2: fire.filter((i) => !i.o2Range).length,
    noPressure: fire.filter((i) => !i.pressureRange).length,
  };
}

function Dots({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? "dot on" : "dot"} />
      ))}
    </span>
  );
}

/** What the ranking cannot say. Sits at the foot of the Rank sheet. */
function Limits({ limits }: { limits: ReturnType<typeof limitsFrom> | null }) {
  return (
    <aside className="limits" aria-labelledby="limits-h">
      <h2 id="limits-h" className="sec-h">What this data cannot tell you</h2>
      {limits && (
        <ul className="limit-cards">
          <li className="limit">
            <span className="limit-n t-display">0 of {limits.total}</span>
            <span className="limit-t">experiments ran in Moon or Mars gravity.</span>
            <Dots filled={limits.flight} total={limits.total} />
            <span className="muted">
              {limits.flight} ran in microgravity (solid dots), {limits.ground} are ground tests or computer models.
            </span>
          </li>
          <li className="limit">
            <span className="limit-n t-display">{limits.noO2} of {limits.total}</span>
            <span className="limit-t">have no tested oxygen level on record.</span>
            <Dots filled={limits.total - limits.noO2} total={limits.total} />
            <span className="muted">Solid dots: on record.</span>
          </li>
          <li className="limit">
            <span className="limit-n t-display">{limits.noPressure} of {limits.total}</span>
            <span className="limit-t">have no tested air pressure on record.</span>
            <Dots filled={limits.total - limits.noPressure} total={limits.total} />
            <span className="muted">Solid dots: on record.</span>
          </li>
        </ul>
      )}
      <p className="limit-note">
        Results from weightlessness and from Earth gravity bracket Moon gravity. They do not replace a test there.
      </p>
    </aside>
  );
}

// One screen (docs/RESKIN_PRD.md). The replay fills the center; the base carousel, the brief line and the top 3
// sit over it on glass. Library opens on the left, Ask SI on the right. Each nav view is a sheet over the replay.
// Evidence is the detail drawer; it shows itself when the store has a selected investigation.
export default function App() {
  const habitats = useDataset("habitats");
  const inv = useDataset("investigations");
  const sources = useDataset("sources");
  const base = useConsole((s) => s.base);
  const view = useConsole((s) => s.view);
  const leftOpen = useConsole((s) => s.leftOpen);
  const askOpen = useConsole((s) => s.askOpen);
  const isFixture = (habitats.status === "ready" && habitats.isFixture) || (inv.status === "ready" && inv.isFixture);
  const limits = useMemo(() => (inv.status === "ready" ? limitsFrom(inv.data) : null), [inv]);

  useEffect(() => openRankOnHighlight(), []);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="console" data-view={view} data-left={leftOpen} data-ask={askOpen}>
        <TopBar view={view} leftOpen={leftOpen} askOpen={askOpen} />
        <Rail view={view} leftOpen={leftOpen} askOpen={askOpen} />
        <aside className="console-left" aria-label="Library" hidden={!leftOpen}>
          <header className="panel-head">
            <span className="t-readout">Library</span>
            <button type="button" className="icon-btn" aria-label="Close Library" onClick={() => useConsole.getState().setLeftOpen(false)}>
              <Icon name="x" />
            </button>
          </header>
          <Library />
          <Trust />
        </aside>
        <main id="main" className="console-center" tabIndex={-1}>
          <Carousel base={base} habitats={habitats.status === "ready" ? habitats.data : null} />
          <Stage />
          <div className="console-ticks" aria-hidden="true" />
          <div className="console-hud">
            <div className="console-brief">
              <BriefLine />
            </div>
            <div className="console-overlay">{base === "earth" ? <Earth /> : <TopForBase />}</div>
          </div>
          {view === "interpret" && (
            <Sheet view="interpret">
              <Brief />
            </Sheet>
          )}
          {view === "rank" && (
            <Sheet view="rank">
              <Ranking />
              <Gaps />
              <Limits limits={limits} />
            </Sheet>
          )}
          {view === "compare" && (
            <Sheet view="compare">
              <Compare />
            </Sheet>
          )}
          {view === "models" && (
            <Sheet view="models">
              <WhatIf />
            </Sheet>
          )}
          {view === "graph" && (
            <Sheet view="graph">
              <Graph />
            </Sheet>
          )}
        </main>
        <aside className="console-right" aria-label="Ask SI" hidden={!askOpen}>
          <Ask />
        </aside>
        <StatusStrip
          base={base}
          habitats={habitats.status === "ready" ? habitats.data : null}
          sources={sources.status === "ready" ? sources.data.length : null}
          experiments={limits ? limits.total : null}
          isFixture={isFixture}
        />
      </div>
      <Evidence />
    </>
  );
}
