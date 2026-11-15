// The fixed parts around the replay: top bar with nav, icon rail, status strip. All take the console state as props.
import { habitatOf, useConsole, type BaseId, type View } from "../app/console.ts";
import type { HabitatPreset } from "../contracts/index.ts";
import { setGuideOn } from "../guide/drive.ts";
import { STEPS, stepForView } from "../guide/steps.ts";
import { Icon } from "./icons.tsx";
import { NAV, navId, toggleView } from "./logic.ts";

const num = (n: number) => `${Math.round(n * 10) / 10}`;

type Panels = { view: View; leftOpen: boolean; askOpen: boolean };

/** The nav in the order of the guided path: the sheets that are steps by step number (the Research map goes with
 * step 6, after Team models), then the rest as listed. */
export const NAV_PATH = [...NAV].sort((a, b) => (stepForView(a.view) ?? 99) - (stepForView(b.view) ?? 99));
const ASK_STEP = STEPS.find((s) => s.ask)!.n;

/** A step's number on its nav button: "Step 2" to assistive tech, "2" on screen. */
function StepNo({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span className="nav-step t-readout">
      <span className="sr-only">Step </span>
      {n}
      <span className="sr-only">:</span>
    </span>
  );
}

export function TopBar({ view, leftOpen, askOpen, guide }: Panels & { guide?: boolean }) {
  const { setView, setLeftOpen, setAskOpen } = useConsole.getState();
  const storeGuide = useConsole((s) => s.guideOn);
  const guideOn = guide ?? storeGuide;
  return (
    <header className="console-top">
      <h1 className="brand t-display t-upper">Firebreak</h1>
      <nav className="console-nav" aria-label="Views">
        <ul>
          {/* Hidden guide: this brings it back at the step the console is on. */}
          {!guideOn && (
            <li className="nav-item">
              <button type="button" id="nav-guide" className="nav-btn" onClick={() => setGuideOn(true)}>
                Guide
              </button>
            </li>
          )}
          {/* Phone only: the rail is hidden there, so the Library toggle joins the chip row. */}
          <li className="nav-item nav-lib">
            <button type="button" className="nav-btn" aria-pressed={leftOpen} onClick={() => setLeftOpen(!leftOpen)}>
              Library
            </button>
          </li>
          {NAV_PATH.map((n) => (
            <li key={n.view} className="nav-item">
              <button
                type="button"
                id={navId(n.view)}
                className="nav-btn"
                aria-pressed={view === n.view}
                aria-describedby={`${navId(n.view)}-tip`}
                onClick={() => setView(toggleView(view, n.view))}
              >
                <StepNo n={STEPS.find((s) => s.view === n.view)?.n ?? null} />
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
        <StepNo n={ASK_STEP} />
        Ask SI
      </button>
    </header>
  );
}

/** The rail keeps Replay only: Library and Ask SI each have one control, the strip on their own edge (SidePanel.tsx). */
export function Rail({ view }: { view: View }) {
  const { setView } = useConsole.getState();
  return (
    <nav className="console-rail" aria-label="Replay">
      <button type="button" className="icon-btn" aria-label="Replay" title="Replay" aria-pressed={view === "stage"} onClick={() => setView("stage")}>
        <Icon name="flame" />
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
