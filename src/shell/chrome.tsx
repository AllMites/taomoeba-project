// The fixed parts around the replay: top bar with nav, icon rail, status strip. All take the console state as props.
import { habitatOf, useConsole, type BaseId, type View } from "../app/console.ts";
import type { HabitatPreset } from "../contracts/index.ts";
import { Icon } from "./icons.tsx";
import { NAV, navId, toggleView } from "./logic.ts";

const num = (n: number) => `${Math.round(n * 10) / 10}`;

type Panels = { view: View; leftOpen: boolean; askOpen: boolean };

export function TopBar({ view, leftOpen, askOpen }: Panels) {
  const { setView, setLeftOpen, setAskOpen } = useConsole.getState();
  return (
    <header className="console-top">
      <h1 className="brand t-display t-upper">Flame in Freefall</h1>
      <nav className="console-nav" aria-label="Views">
        <ul>
          {/* Phone only: the rail is hidden there, so the Library toggle joins the chip row. */}
          <li className="nav-item nav-lib">
            <button type="button" className="nav-btn" aria-pressed={leftOpen} onClick={() => setLeftOpen(!leftOpen)}>
              Library
            </button>
          </li>
          {NAV.map((n) => (
            <li key={n.view} className="nav-item">
              <button
                type="button"
                id={navId(n.view)}
                className="nav-btn"
                aria-pressed={view === n.view}
                aria-describedby={`${navId(n.view)}-tip`}
                onClick={() => setView(toggleView(view, n.view))}
              >
                {n.label}
              </button>
              <span id={`${navId(n.view)}-tip`} role="tooltip" className="nav-tip glass">
                {n.tip}
              </span>
            </li>
          ))}
        </ul>
      </nav>
      <button type="button" className="ask-pill" aria-pressed={askOpen} onClick={() => setAskOpen(!askOpen)}>
        <span className="ask-dot" aria-hidden="true" />
        Ask SI
      </button>
    </header>
  );
}

export function Rail({ view, leftOpen, askOpen }: Panels) {
  const { setView, setLeftOpen, setAskOpen } = useConsole.getState();
  return (
    <nav className="console-rail" aria-label="Panels">
      <button type="button" className="icon-btn" aria-label="Replay" title="Replay" aria-pressed={view === "stage"} onClick={() => setView("stage")}>
        <Icon name="flame" />
      </button>
      <button type="button" className="icon-btn" aria-label="Library" title="Library" aria-pressed={leftOpen} onClick={() => setLeftOpen(!leftOpen)}>
        <Icon name="library" />
      </button>
      <button type="button" className="icon-btn" aria-label="Ask SI" title="Ask SI" aria-pressed={askOpen} onClick={() => setAskOpen(!askOpen)}>
        <Icon name="message" />
      </button>
    </nav>
  );
}

/** Real readouts for the picked base, plus where the data and the pictures come from. */
export function StatusStrip({
  base,
  habitats,
  sources,
  experiments,
  isFixture,
}: {
  base: BaseId;
  habitats: HabitatPreset[] | null;
  sources: number | null;
  experiments: number | null;
  isFixture: boolean;
}) {
  const air = habitats?.find((h) => h.id === habitatOf(base));
  const name = base === "earth" ? "Earth" : (air?.label ?? "");
  return (
    <footer className="console-status t-readout">
      <dl className="stats">
        <div className="stat stat-base">
          <dt>Base</dt>
          <dd>{name || "…"}</dd>
        </div>
        <div className="stat">
          <dt>O₂</dt>
          <dd>{air ? `${num(air.o2Percent)}%` : "…"}</dd>
        </div>
        <div className="stat">
          <dt>Pressure</dt>
          <dd>{air ? `${num(air.pressureKPa)} kPa` : "…"}</dd>
        </div>
        <div className="stat">
          <dt>Sources checked</dt>
          <dd>{sources ?? "…"}</dd>
        </div>
        <div className="stat">
          <dt>Experiments</dt>
          <dd>{experiments ?? "…"}</dd>
        </div>
        <div className="stat stat-wide">
          <dt>Models</dt>
          <dd>CatBoost · TypeSafe · Claude</dd>
        </div>
      </dl>
      {isFixture && <span className="badge">sample data</span>}
      <details className="about">
        <summary>About</summary>
        <div className="about-body glass">
          <p>Data: NASA Physical Sciences Informatics (PSI).</p>
          <p>Summaries are written by SI from quoted sources. Each one shows its source on request.</p>
          <p>Pictures marked SI-generated are illustrations, not NASA photographs.</p>
        </div>
      </details>
    </footer>
  );
}
