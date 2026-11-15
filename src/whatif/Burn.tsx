import { useEffect, useRef, useState } from "react";
import { useStore } from "../app/store.ts";
import { burnPlan, diameterAt, gravityFactor, pct, playbackSpeed, type Burn, type Level, type Sel, type WhatIfDoc } from "./logic.ts";

const calm = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const fmt = (x: number, d = 1) => x.toFixed(d);

/**
 * Watch the predicted burn. The droplet shrinks by the d^2-law at the predicted burning rate and the flame goes out at
 * the predicted extinction diameter; both come from the model grid. The flame's size and colour are only illustrative.
 */
export function WatchBurn(p: {
  doc: WhatIfDoc;
  sel: Sel;
  fuel: string;
  d0: number;
  burningRate: number;
  extMm: number;
  pDisruption: number;
  moon: boolean;
  level: Level;
}) {
  const plan = burnPlan(p.d0, p.burningRate, p.extMm);
  const law = p.doc.models.d2law;
  return (
    <div className="whatif-burn">
      <h3 className="whatif-h3">Watch the predicted burn</h3>
      <div className="burn-grid">
        {p.moon ? (
          <p className="whatif-warn burn-none">
            Not shown for Moon-Base-like air: the team's report says the extinction-diameter prediction is not valid there, so the burn
            cannot be drawn honestly.
          </p>
        ) : plan ? (
          <BurnPlayer plan={plan} fuel={p.fuel} rough={p.level === "far" || p.level === "out"} />
        ) : (
          <p className="muted burn-none">No burn to show for this setting.</p>
        )}
        <GravityPanel />
        <GravityEstimate doc={p.doc} sel={p.sel} burningRate={p.burningRate} rough={p.level === "far" || p.level === "out"} />
      </div>
      <p className="muted whatif-small">
        The droplet's size and the timing come from the model predictions: by the d²-law, the square of the diameter falls at the
        burning rate until the flame goes out at the predicted size.
        {law &&
          ` On ${law.runs} FLEX runs that ended in flame-out, this law gave the measured burn time with correlation ${law.corr} (median error ${pct(law.median_rel_err)}).`}{" "}
        The flame's size and colour are drawn for illustration only.
        {!p.moon && p.pDisruption >= 0.3 && ` This droplet has a ${pct(p.pDisruption)} chance of breaking apart first; the animation shows the run where it does not.`}
      </p>
    </div>
  );
}

function BurnPlayer({ plan, fuel, rough }: { plan: Burn; fuel: string; rough: boolean }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const speed = playbackSpeed(plan);
  const key = `${plan.d0}|${plan.k}|${plan.dEnd}`;

  // A new setting starts from the beginning.
  useEffect(() => {
    setT(0);
    setPlaying(false);
  }, [key]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setT((cur) => {
        const next = Math.min(cur + dt, plan.tEnd);
        if (next >= plan.tEnd) setPlaying(false);
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, plan.tEnd]);

  const d = diameterAt(plan, t);
  const done = t >= plan.tEnd - 1e-6;
  const out = done && plan.ends === "flame-out";
  const play = () => {
    if (done) setT(0);
    if (calm()) {
      setT(plan.tEnd); // no motion: jump to the end state
      return;
    }
    setPlaying(true);
  };

  // drawing scale: a 4 mm droplet is 60 px across the 200 px stage, so the shrinking diameter is easy to see
  const r = (mm: number) => (mm / 4) * 30;
  const heptane = fuel === "heptane";
  // the flame follows the droplet (its size is illustrative; the droplet's size is the prediction)
  const flameR = r(d) * 2.6 + 4;

  return (
    <figure className="burn-stage">
      <svg viewBox="0 0 200 200" role="img" aria-label={`Predicted burn: a ${plan.d0} mm ${fuel} droplet ${plan.ends === "flame-out" ? `whose flame goes out at ${fmt(plan.dEnd, 2)} mm` : "that burns away completely"} after ${fmt(plan.tEnd)} seconds.`}>
        <defs>
          <radialGradient id="burn-flame-m">
            <stop offset="55%" stopColor="var(--burn-flame-inner-m)" stopOpacity="0" />
            <stop offset="85%" stopColor="var(--burn-flame-m)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--burn-flame-m)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="burn-flame-h">
            <stop offset="45%" stopColor="var(--burn-flame-inner-h)" stopOpacity="0.15" />
            <stop offset="82%" stopColor="var(--burn-flame-h)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--burn-flame-h)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect className="burn-glass" x="0" y="0" width="200" height="200" rx="16" />
        {!out && d > 0.01 && <circle cx="100" cy="100" r={flameR} fill={`url(#burn-flame-${heptane ? "h" : "m"})`} className="burn-flame" />}
        {/* guide rings: the droplet's starting size and the predicted size at flame-out */}
        <circle cx="100" cy="100" r={r(plan.d0)} className="burn-guide" />
        {plan.ends === "flame-out" && <circle cx="100" cy="100" r={r(plan.dEnd)} className="burn-guide burn-guide-end" />}
        {d > 0.005 && <circle cx="100" cy="100" r={Math.max(r(d), 0.8)} className="burn-drop" />}
        <text x="10" y="172" className="burn-read burn-key">
          ○ start {fmt(plan.d0, 1)} mm{plan.ends === "flame-out" ? `   ◌ out at ${fmt(plan.dEnd, 2)} mm` : ""}
        </text>
        <text x="10" y="20" className="burn-read">
          t = {fmt(t)} s
        </text>
        <text x="190" y="20" className="burn-read" textAnchor="end">
          d = {fmt(d, 2)} mm
        </text>
        <text x="100" y="188" className="burn-read" textAnchor="middle">
          {out ? `Flame out at ${fmt(plan.dEnd, 2)} mm` : done ? "Burned away" : playing ? (speed > 1 ? `Playing at ${speed}× speed` : "Burning") : t > 0 ? "Paused" : "Ready"}
        </text>
      </svg>
      <div className="burn-controls">
        <button type="button" className="quiet" onClick={() => !playing && play()} aria-disabled={playing}>
          {done ? "Replay" : t > 0 ? "Resume" : "Ignite"}
        </button>
        <label className="burn-scrub">
          <span className="muted">Time</span>
          <input
            type="range"
            min={0}
            max={plan.tEnd}
            step="any"
            value={t}
            aria-valuetext={`${fmt(t)} of ${fmt(plan.tEnd)} seconds, droplet ${fmt(d, 2)} millimetres`}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
          />
        </label>
      </div>
      <figcaption className="muted whatif-small" role="status">
        Predicted: {plan.ends === "flame-out" ? `flame goes out after ${fmt(plan.tEnd)} s` : `droplet burns away after ${fmt(plan.tEnd)} s`}.
        {rough && " Rough guess: no FLEX run is near this setting."}
      </figcaption>
      <D2Chart plan={plan} t={t} />
    </figure>
  );
}

/** d^2 against time: the straight line the d^2-law predicts, solid until flame-out, dashed after. */
function D2Chart({ plan, t }: { plan: Burn; t: number }) {
  const W = 240;
  const H = 112;
  const L = 30; // left edge of the plot (tick numbers sit left of it)
  const TOP = 26; // top of the plot; the axis title sits above it, so the line never crosses the words
  const BASE = H - 20;
  const tFull = (plan.d0 * plan.d0) / plan.k; // time to burn away completely
  const x = (s: number) => L + (s / tFull) * (W - L - 10);
  const y = (d2: number) => BASE - (d2 / (plan.d0 * plan.d0)) * (BASE - TOP);
  const d = diameterAt(plan, t);
  return (
    <svg className="burn-d2" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Diameter squared falls in a straight line from ${fmt(plan.d0 * plan.d0, 2)} to ${fmt(plan.dEnd * plan.dEnd, 2)} square millimetres over ${fmt(plan.tEnd)} seconds.`}>
      <text className="burn-tick" x={L} y={11}>
        d² (mm²)
      </text>
      <line className="burn-axis" x1={L} y1={BASE} x2={W - 10} y2={BASE} />
      <line className="burn-axis" x1={L} y1={TOP - 6} x2={L} y2={BASE} />
      {plan.ends === "flame-out" && <line className="burn-rest" x1={x(plan.tEnd)} y1={y(plan.dEnd ** 2)} x2={x(tFull)} y2={y(0)} />}
      <line className="burn-line" x1={x(0)} y1={y(plan.d0 ** 2)} x2={x(plan.tEnd)} y2={y(plan.dEnd ** 2)} />
      <circle className="burn-dot" cx={x(Math.min(t, plan.tEnd))} cy={y(d * d)} r={3.5} />
      <text className="burn-tick" x={L - 5} y={TOP + 3} textAnchor="end">
        {fmt(plan.d0 * plan.d0, 1)}
      </text>
      <text className="burn-tick" x={L - 5} y={BASE + 3} textAnchor="end">
        0
      </text>
      <text className="burn-tick" x={W - 10} y={H - 4} textAnchor="end">
        time (s) →
      </text>
    </svg>
  );
}

/** Same droplet under gravity: the team model's microgravity rate times the textbook buoyancy factor. Theory, not data. */
export function GravityEstimate({ doc, sel, burningRate, rough }: { doc: WhatIfDoc; sel: Sel; burningRate: number; rough: boolean }) {
  const moon = gravityFactor(doc, sel, "moon");
  const mars = gravityFactor(doc, sel, "mars");
  const earth = gravityFactor(doc, sel, "earth");
  if (moon === null || earth === null || !(burningRate > 0)) return null;
  const row = (where: string, f: number): [string, string, string] => [where, `≈ ${fmt(f, 2)}×`, `≈ ${fmt(burningRate * f, 2)} mm²/s`];
  const rows: [string, string, string][] = [
    ["ISS (microgravity)", "team model", `${fmt(burningRate, 2)} mm²/s`],
    row("Moon (1/6 g)", moon),
    ...(mars !== null ? [row("Mars (3/8 g)", mars)] : []),
    row("Earth (1 g)", earth),
  ];
  return (
    <div className="burn-gravity">
      <h4 className="burn-gravity-h">This droplet under gravity: a theory estimate</h4>
      <table>
        <thead>
          <tr>
            <th scope="col">Where</th>
            <th scope="col">Factor</th>
            <th scope="col">Burning rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([w, f, v]) => (
            <tr key={w}>
              <th scope="row">{w}</th>
              <td>{f}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted whatif-small">
        Rising hot gas brings oxygen in faster, so gravity speeds burning. The factor comes from a textbook convection formula for this
        droplet size, gas mix and pressure; it is not data, because PSI has no Moon-gravity droplet runs to check it against.
        {rough && " The microgravity value it starts from is itself a rough guess at this setting."}
        {mars !== null && " No Mars-base air is on record, so the Mars row uses the air chosen above."}
      </p>
      <p className="muted whatif-small">
        Closest stand-in on record: ACME&apos;s E-FIELD Flames experiment imitated partial gravity on the ISS by pushing on the ions in
        a flame with an electric field.{" "}
        <button type="button" className="burn-link" onClick={() => useStore.getState().setSelectedInvestigationId("PSI-22")}>
          Open E-FIELD Flames
        </button>
      </p>
    </div>
  );
}

/** Illustration, not data: why a flame is a teardrop on Earth and a sphere in microgravity. */
export function GravityPanel() {
  return (
    <aside className="burn-side" aria-label="Illustration: a flame on Earth and in microgravity">
      <div className="burn-side-pair">
        <figure>
          <svg viewBox="0 0 110 130" role="img" aria-label="On Earth: a tall teardrop flame, hot gas rising above it, fresh air drawn in from below.">
            <path className="burn-earth-flame" d="M55 18 C 70 48, 74 72, 70 88 C 66 102, 44 102, 40 88 C 36 72, 40 48, 55 18 Z" />
            <circle cx="55" cy="88" r="4" className="burn-drop" />
            <path className="burn-arrow" d="M55 14 L55 2 M51 6 L55 2 L59 6" />
            <path className="burn-arrow" d="M28 112 L42 98 M36 98 L42 98 L42 104" />
            <path className="burn-arrow" d="M82 112 L68 98 M74 98 L68 98 L68 104" />
          </svg>
          <figcaption>
            <b>Earth</b>: hot gas rises and pulls fresh air in from below, stretching the flame upward.
          </figcaption>
        </figure>
        <figure>
          <svg viewBox="0 0 110 130" role="img" aria-label="In microgravity: a round flame around the droplet, oxygen slowly diffusing in from all sides.">
            <circle cx="55" cy="62" r="30" className="burn-ug-flame" />
            <circle cx="55" cy="62" r="4" className="burn-drop" />
            {[0, 60, 120, 180, 240, 300].map((a) => {
              const rad = (a * Math.PI) / 180;
              const x1 = 55 + Math.cos(rad) * 50;
              const y1 = 62 + Math.sin(rad) * 50;
              const x2 = 55 + Math.cos(rad) * 38;
              const y2 = 62 + Math.sin(rad) * 38;
              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} className="burn-arrow burn-diffuse" />;
            })}
          </svg>
          <figcaption>
            <b>Microgravity</b>: nothing rises, so oxygen only reaches the flame by slow diffusion, and the flame becomes a sphere.
          </figcaption>
        </figure>
      </div>
      <p className="muted whatif-small">Illustration of textbook physics, not data. This is why FLEX droplets burn inside a spherical flame.</p>
    </aside>
  );
}
