import { useEffect, useMemo, useRef, useState } from "react";
import Ask from "../ask/index.tsx";
import Brief from "../brief/index.tsx";
import type { HabitatPreset, Investigation } from "../contracts/index.ts";
import { pickerHabitats } from "../data/select.ts";
import { useDataset } from "../data/useDataset.ts";
import Evidence from "../evidence/index.tsx";
import Ranking from "../ranking/index.tsx";
import Stage from "../scenes/Stage.tsx";
import "./app.css";
import { FLAME_O2, flameVars } from "./flame.ts";
import { heroReturnFocus, STICKY_SELECT_ID } from "./focus.ts";
import { pickHabitat, prefersCalm } from "./motion.ts";
import { useStore } from "./store.ts";
import { displayClass } from "./type.ts";

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

const num = (n: number) => `${Math.round(n * 10) / 10}`;

function Dots({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? "dot on" : "dot"} />
      ))}
    </span>
  );
}

/**
 * Decorative scene per habitat, generated with Higgsfield (GPT Image 2). Space Apps requires a visible mark on
 * SI-generated images: each file has one baked into its corner, and SiMark repeats it where a crop could hide that.
 */
const SCENES: Record<string, { src: string; alt: string } | undefined> = {
  iss: { src: "/img/iss.webp", alt: "Illustration: inside a space station module, seen through a round window." },
  moon: { src: "/img/moon.webp", alt: "Illustration: a small habitat on the lunar surface, seen through a window." },
  rover: { src: "/img/rover.webp", alt: "Illustration: a rover cabin with two seats facing the lunar surface." },
};

function SiMark() {
  return <span className="si-mark t-readout">SI-generated image</span>;
}

function Picker({ habitats }: { habitats: HabitatPreset[] }) {
  const habitat = useStore((s) => s.habitat);
  return (
    <fieldset className="picker">
      <legend className="t-readout">Pick your habitat</legend>
      <div className="choices">
        {pickerHabitats(habitats).map((h) => (
          <label key={h.id} className="choice">
            {SCENES[h.id] && (
              <span className="choice-view">
                <img src={SCENES[h.id]!.src} alt={SCENES[h.id]!.alt} width={1920} height={1086} decoding="async" />
                <SiMark />
              </span>
            )}
            <input type="radio" name="habitat" value={h.id} checked={habitat === h.id} onChange={() => pickHabitat(h.id)} />
            <span className="choice-top">
              <span className="choice-dot" aria-hidden="true" />
              <span className={`choice-name ${displayClass(h.label)}`}>{h.label}</span>
              {/* Always rendered so its width is reserved; CSS shows it on the checked card only. */}
              <span className="choice-check t-readout" aria-hidden="true">
                Picked
              </span>
            </span>
            <span className="choice-stat t-readout">
              <span>
                <b>{num(h.o2Percent)}%</b> oxygen
              </span>
              <span>
                <b>{num(h.pressureKPa)}</b> kPa
              </span>
            </span>
            <span className="choice-note">{h.note}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The porthole: a thick raised frame around dark glass holding the flame sphere, with one leader line
 * to the picked habitat's air. The sphere's size and glow follow the habitat's oxygen (flame.ts).
 */
function Porthole({ picked }: { picked: HabitatPreset | undefined }) {
  return (
    <div className="porthole">
      <div className="porthole-glass">
        <div className="hero-copy">
          <h1 className="brand t-display t-upper">
            Flame in <span className="brand-line">Freefall</span>
          </h1>
          <p className="lede t-statement">Pick where your crew will live, and see which NASA fire experiments match its air.</p>
        </div>
        <SiMark />
        <div className="hero-stage" aria-hidden="true">
          <div className="sphere-drift">
            <div className="sphere" />
          </div>
          <span className="leader" />
          {picked && (
            <span className="readout t-readout">
              <span className="readout-name">{picked.label}</span>
              <span>
                O₂ <b>{num(picked.o2Percent)}%</b>
              </span>
              <span>
                <b>{num(picked.pressureKPa)}</b> kPa
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Sections below the fold rise and fade in once as they enter view. Sections already in view are never
 * hidden; nothing is hidden at all under reduced motion or without IntersectionObserver.
 */
function useReveal() {
  useEffect(() => {
    if (prefersCalm() || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = "done";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of document.querySelectorAll<HTMLElement>("main > section, main > aside")) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      el.dataset.reveal = "pending";
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
}

function StickyBar({ habitats }: { habitats: HabitatPreset[] }) {
  const habitat = useStore((s) => s.habitat);
  return (
    <div className="sticky">
      <label htmlFor={STICKY_SELECT_ID} className="t-readout">
        Your habitat
      </label>
      <select id={STICKY_SELECT_ID} value={habitat} onChange={(e) => pickHabitat(e.target.value as typeof habitat)}>
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
  const habitatId = useStore((s) => s.habitat);
  const picked = habitats.status === "ready" ? habitats.data.find((h) => h.id === habitatId) : undefined;
  const isFixture = (habitats.status === "ready" && habitats.isFixture) || (inv.status === "ready" && inv.isFixture);

  const heroRef = useRef<HTMLElement>(null);
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      const past = !!e && !e.isIntersecting;
      // The bar is about to go away: keep keyboard focus by moving it to the picker's checked radio.
      if (!past) heroReturnFocus(document)?.focus({ preventScroll: true });
      setPastHero(past);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useReveal();

  const limits = useMemo(() => (inv.status === "ready" ? limitsFrom(inv.data) : null), [inv]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {habitats.status === "ready" && pastHero && !drawerOpen && <StickyBar habitats={habitats.data} />}
      <header className="hero" ref={heroRef} style={flameVars(picked?.o2Percent ?? FLAME_O2.soft)}>
        <Porthole picked={picked} />
        {habitats.status === "ready" ? <Picker habitats={habitats.data} /> : <div className="picker-wait" aria-hidden="true" />}
      </header>
      <main id="main" tabIndex={-1}>
        <Ask />
        <Brief />
        <Stage />
        <Ranking />
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
      </main>
      <footer className="foot">
        <p>Data: NASA Physical Sciences Informatics (PSI).</p>
        <p className="muted">Summaries are written by SI from quoted sources. Each one shows its source on request.</p>
        <p className="muted">The flame and the three habitat views are SI-generated illustrations, not NASA photographs.</p>
        {isFixture && <span className="badge">sample data</span>}
      </footer>
      <Evidence />
    </>
  );
}
