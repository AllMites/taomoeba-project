import Ask from "../ask/index.tsx";
import Brief from "../brief/index.tsx";
import { pickerHabitats } from "../data/select.ts";
import { useDataset } from "../data/useDataset.ts";
import Evidence from "../evidence/index.tsx";
import Ranking from "../ranking/index.tsx";
import { useStore } from "./store.ts";

// One page, top to bottom: hero + habitat picker, ask box, habitat brief, ranked experiments, limits.
// Evidence is the detail drawer; it shows itself when the store has a selected investigation.
export default function App() {
  const habitat = useStore((s) => s.habitat);
  const setHabitat = useStore((s) => s.setHabitat);
  const habitats = useDataset("habitats");
  const inv = useDataset("investigations");
  const isFixture = (habitats.status === "ready" && habitats.isFixture) || (inv.status === "ready" && inv.isFixture);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="hero">
        <h1 className="brand">Flame in Freefall</h1>
        <p>NASA fire experiments, ranked for the habitat you are designing.</p>
        <fieldset className="picker">
          <legend>Pick a habitat</legend>
          {habitats.status === "ready" &&
            pickerHabitats(habitats.data).map((h) => (
              <label key={h.id}>
                <input type="radio" name="habitat" checked={habitat === h.id} onChange={() => setHabitat(h.id)} />
                {h.label} <span className="muted">{h.o2Percent}% oxygen, {h.pressureKPa} kPa</span>
              </label>
            ))}
        </fieldset>
        {isFixture && <span className="badge">sample data</span>}
      </header>
      <main id="main" tabIndex={-1}>
        <Ask />
        <Brief />
        <Ranking />
        <aside className="limits" aria-labelledby="limits-h">
          <h2 id="limits-h">What this data cannot tell you</h2>
          <p>No experiment here ran in Moon or Mars gravity. Many records do not state the oxygen or pressure they tested at.</p>
        </aside>
      </main>
      <Evidence />
    </>
  );
}
