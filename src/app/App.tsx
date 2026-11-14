import { useEffect, useMemo, useRef, useState } from "react";
import Ask from "../ask/index.tsx";
import Brief from "../brief/index.tsx";
import type { HabitatPreset, Investigation } from "../contracts/index.ts";
import { pickerHabitats } from "../data/select.ts";
import { useDataset } from "../data/useDataset.ts";
import Evidence from "../evidence/index.tsx";
import Ranking from "../ranking/index.tsx";
import "./app.css";
import { useStore } from "./store.ts";

/** Counts behind the limits strip, all from the fire experiments (pds is not "Other"). */
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

const pct = (v: number, max: number) => `${Math.min(100, Math.max(4, (v / max) * 100))}%`;

function Dots({ filled, total, hollow }: { filled: number; total: number; hollow?: boolean }) {
  return (
    <span className="dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? "dot on" : hollow ? "dot hollow" : "dot"} />
      ))}
    </span>
  );
}

function Picker({ habitats }: { habitats: HabitatPreset[] }) {
  const habitat = useStore((s) => s.habitat);
  const setHabitat = useStore((s) => s.setHabitat);
  return (
    <fieldset className="picker">
      <legend>Pick your habitat</legend>
      <div className="choices">
      {pickerHabitats(habitats).map((h) => (
        <label key={h.id} className="choice">
          <input type="radio" name="habitat" value={h.id} checked={habitat === h.id} onChange={() => setHabitat(h.id)} />
          <span className="choice-top">
            <span className="choice-name">{h.label}</span>
            <span className="choice-check" aria-hidden="true">
              {habitat === h.id ? "✓ Picked" : ""}
            </span>
          </span>
          <span className="choice-stat">
            <span>
              <b>{h.o2Percent}%</b> oxygen
            </span>
            <span className="bar" aria-hidden="true">
              <span style={{ width: pct(h.o2Percent, 100) }} />
            </span>
          </span>
          <span className="choice-stat">
            <span>
              <b>{h.pressureKPa} kPa</b> pressure
            </span>
            <span className="bar" aria-hidden="true">
              <span style={{ width: pct(h.pressureKPa, 101.3) }} />
            </span>
          </span>
          <span className="choice-note">{h.note}</span>
        </label>
      ))}
      </div>
    </fieldset>
  );
}

function StickyBar({ habitats }: { habitats: HabitatPreset[] }) {
  const habitat = useStore((s) => s.habitat);
  const setHabitat = useStore((s) => s.setHabitat);
  return (
    <div className="sticky">
      <label htmlFor="sticky-habitat">Your habitat</label>
      <select id="sticky-habitat" value={habitat} onChange={(e) => setHabitat(e.target.value as typeof habitat)}>
        {pickerHabitats(habitats).map((h) => (
          <option key={h.id} value={h.id}>
            {h.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// One page, top to bottom: hero + habitat picker, ask box, habitat brief, ranked experiments, limits.
// Evidence is the detail drawer; it shows itself when the store has a selected investigation.
export default function App() {
  const habitats = useDataset("habitats");
  const inv = useDataset("investigations");
  const drawerOpen = useStore((s) => s.selectedInvestigationId !== null);
  const isFixture = (habitats.status === "ready" && habitats.isFixture) || (inv.status === "ready" && inv.isFixture);

  const heroRef = useRef<HTMLElement>(null);
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPastHero(!!e && !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const limits = useMemo(() => (inv.status === "ready" ? limitsFrom(inv.data) : null), [inv]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {habitats.status === "ready" && pastHero && !drawerOpen && <StickyBar habitats={habitats.data} />}
      <header className="hero" ref={heroRef}>
        <div className="glow" aria-hidden="true" />
        <h1 className="brand">Flame in Freefall</h1>
        <p className="lede">Pick where your crew will live, and see which NASA fire experiments match its air.</p>
        {habitats.status === "ready" ? <Picker habitats={habitats.data} /> : <div className="picker-wait" aria-hidden="true" />}
      </header>
      <main id="main" tabIndex={-1}>
        <Ask />
        <Brief />
        <Ranking />
        <aside className="limits" aria-labelledby="limits-h">
          <h2 id="limits-h">What this data cannot tell you</h2>
          {limits && (
            <ul className="limit-cards">
              <li className="limit">
                <span className="limit-n">0 of {limits.total}</span>
                <span className="limit-t">experiments ran in Moon or Mars gravity.</span>
                <Dots filled={limits.flight} total={limits.total} />
                <span className="muted">
                  {limits.flight} flew in microgravity (solid dots), {limits.ground} are ground tests or computer models.
                </span>
              </li>
              <li className="limit">
                <span className="limit-n">{limits.noO2} of {limits.total}</span>
                <span className="limit-t">do not say what oxygen level they tested.</span>
                <Dots filled={limits.total - limits.noO2} total={limits.total} />
                <span className="muted">Solid dots state it.</span>
              </li>
              <li className="limit">
                <span className="limit-n">{limits.noPressure} of {limits.total}</span>
                <span className="limit-t">do not say what air pressure they tested.</span>
                <Dots filled={limits.total - limits.noPressure} total={limits.total} />
                <span className="muted">Solid dots state it.</span>
              </li>
            </ul>
          )}
          <p className="limit-note">
            Results from weightlessness and from Earth gravity bracket Moon gravity. They do not replace a test there.
          </p>
        </aside>
      </main>
      <footer className="foot">
        <p>Data: NASA Physical Sciences Informatics (PSI).</p>
        <p className="muted">Summaries are written by SI from quoted sources. Each one shows its source on request.</p>
        {isFixture && <span className="badge">sample data</span>}
      </footer>
      <Evidence />
    </>
  );
}
