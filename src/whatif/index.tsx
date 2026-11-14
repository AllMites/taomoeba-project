import { useEffect, useId, useState } from "react";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import {
  describe,
  effects,
  GAS_LABEL,
  gasOf,
  habitatPoint,
  isMoonLike,
  LEVEL_LABEL,
  mixesOf,
  nearest,
  o2Curve,
  parseDoc,
  pct,
  predict,
  pressureLabel,
  signed,
  support,
  type Gas,
  type Prediction,
  type Sel,
  type WhatIfDoc,
} from "./logic.ts";
import { WatchBurn } from "./Burn.tsx";
import "./whatif.css";

/** Air at sea level with a 2 mm methanol droplet: the plainest starting point. */
export function startSel(doc: WhatIfDoc): Sel {
  const a = doc.axes;
  return { fuel: 0, mix: Math.max(0, mixesOf(doc, "n2")[0] ?? 0), o2: nearest(a.o2, 0.21), p: nearest(a.p_mmHg, 760), d0: nearest(a.d0, 2.0) };
}

type State = { phase: "loading" } | { phase: "error" } | { phase: "ready"; doc: WhatIfDoc };

export default function WhatIf() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [sel, setSel] = useState<Sel | null>(null);
  const [pinned, setPinned] = useState<Sel | null>(null);
  const habitatId = useStore((s) => s.habitat);
  const habitats = useDataset("habitats");

  useEffect(() => {
    let live = true;
    fetch("/data/whatif.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const doc = parseDoc(j);
        if (!live) return;
        setState(doc ? { phase: "ready", doc } : { phase: "error" });
        if (doc) setSel(startSel(doc));
      })
      .catch(() => live && setState({ phase: "error" }));
    return () => {
      live = false;
    };
  }, []);

  if (state.phase !== "ready" || !sel) {
    return (
      <section className="whatif" aria-labelledby="whatif-h">
        <Heading />
        <p className="muted" role="status">
          {state.phase === "error" ? "The model predictions could not be loaded." : "Loading the model predictions"}
        </p>
      </section>
    );
  }
  const h = habitats.status === "ready" ? habitats.data.find((x) => x.id === habitatId) : undefined;
  const hp = h ? habitatPoint(state.doc, h.o2Percent, h.pressureKPa) : null;
  const habitat = h ? { label: h.label, apply: hp ? () => setSel({ ...sel, ...hp }) : null } : undefined;
  return <WhatIfView doc={state.doc} sel={sel} onChange={setSel} habitat={habitat} pinned={pinned} onPin={setPinned} />;
}

function Heading() {
  return (
    <div className="sec-label">
      <p className="sec-word t-readout">Team models</p>
      <h2 id="whatif-h" className="sec-h">
        What if you change the air?
      </h2>
    </div>
  );
}

/** The tool itself, without loading: pure, so it renders the same in tests. */
export function WhatIfView(p: {
  doc: WhatIfDoc;
  sel: Sel;
  onChange: (s: Sel) => void;
  habitat?: { label: string; apply: (() => void) | null };
  pinned?: Sel | null;
  onPin?: (s: Sel | null) => void;
}) {
  const { doc, sel, onChange } = p;
  const a = doc.axes;
  const id = useId();
  const pr = predict(doc, sel);
  const sup = support(pr);
  const moon = isMoonLike(doc, sel);
  const set = (k: keyof Sel) => (v: number) => onChange({ ...sel, [k]: v });
  const m = doc.models;
  const gas = gasOf(doc, sel.mix);
  const amounts = mixesOf(doc, gas);
  const pickGas = (g: Gas) => {
    const list = mixesOf(doc, g);
    // keep a similar amount when switching between CO2 and helium; start at the smallest amount otherwise
    const cur = a.mix[sel.mix].amount;
    const best = list.reduce((b, i) => (Math.abs(a.mix[i].amount - cur) < Math.abs(a.mix[b].amount - cur) ? i : b), list[0]);
    onChange({ ...sel, mix: g === gas ? sel.mix : gas === "n2" ? list[0] : best });
  };

  return (
    <section className="whatif" aria-labelledby="whatif-h">
      <Heading />
      <p className="whatif-intro">
        Set the conditions of a burning fuel droplet and see what the team's models predict. They were trained on{" "}
        {doc.tested.runs} NASA FLEX droplet tests from {doc.tested.test_dates} test days aboard the ISS. These are predictions, not
        measurements.
      </p>

      <div className="whatif-grid">
        <form className="whatif-controls" onSubmit={(e) => e.preventDefault()} aria-label="Test conditions">
          <fieldset className="whatif-seg">
            <legend>Fuel</legend>
            {a.fuel.map((f, i) => (
              <label key={f}>
                <input type="radio" name={`${id}-fuel`} checked={sel.fuel === i} onChange={() => set("fuel")(i)} />
                <span>{f[0].toUpperCase() + f.slice(1)}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="whatif-seg">
            <legend>Gas mix</legend>
            {(["n2", "co2", "he"] as Gas[]).map((g) => (
              <label key={g}>
                <input type="radio" name={`${id}-gas`} checked={gas === g} onChange={() => pickGas(g)} />
                <span>{GAS_LABEL[g]}</span>
              </label>
            ))}
          </fieldset>

          {gas !== "n2" && (
            <label className="whatif-field">
              <span>
                {gas === "co2" ? "Carbon dioxide" : "Helium"} <b className="t-readout">{pct(a.mix[sel.mix].amount)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={amounts.length - 1}
                step={1}
                value={amounts.indexOf(sel.mix)}
                aria-valuetext={`${pct(a.mix[sel.mix].amount)} ${gas === "co2" ? "carbon dioxide" : "helium"}`}
                onChange={(e) => set("mix")(amounts[Number(e.target.value)])}
              />
            </label>
          )}

          <label className="whatif-field">
            <span>
              Oxygen <b className="t-readout">{pct(a.o2[sel.o2])}</b>
            </span>
            <input
              type="range"
              min={0}
              max={a.o2.length - 1}
              step={1}
              value={sel.o2}
              aria-valuetext={`${pct(a.o2[sel.o2])} oxygen`}
              onChange={(e) => set("o2")(Number(e.target.value))}
            />
          </label>

          <label className="whatif-field">
            <span>Pressure</span>
            <select value={sel.p} onChange={(e) => set("p")(Number(e.target.value))}>
              {a.p_mmHg.map((v, i) => (
                <option key={v} value={i}>
                  {pressureLabel(v)}
                </option>
              ))}
            </select>
          </label>

          <label className="whatif-field">
            <span>
              Droplet size <b className="t-readout">{a.d0[sel.d0]} mm</b>
            </span>
            <input
              type="range"
              min={0}
              max={a.d0.length - 1}
              step={1}
              value={sel.d0}
              aria-valuetext={`${a.d0[sel.d0]} millimetres`}
              onChange={(e) => set("d0")(Number(e.target.value))}
            />
          </label>

          <div className="whatif-actions">
            {p.habitat &&
              (p.habitat.apply ? (
                <button type="button" className="quiet" onClick={p.habitat.apply}>
                  Use {p.habitat.label} air
                </button>
              ) : (
                <span className="muted">{p.habitat.label} air is outside what FLEX tested, so the models cannot be used for it.</span>
              ))}
            {p.onPin &&
              (p.pinned ? (
                <button type="button" className="quiet" onClick={() => p.onPin!(null)}>
                  Stop comparing
                </button>
              ) : (
                <button type="button" className="quiet" onClick={() => p.onPin!(sel)}>
                  Pin to compare
                </button>
              ))}
          </div>
        </form>

        <div className="whatif-results" aria-live="polite">
          <p className={`whatif-support whatif-support-${sup.level}`}>{sup.text}</p>
          {pr.possible && (
            <>
              <ul className="whatif-cards">
                <li className="whatif-card">
                  <span className="whatif-label">Flame goes out when the droplet is</span>
                  <span className={moon ? "whatif-value t-display whatif-dim" : "whatif-value t-display"}>{pr.extDiameterMm.toFixed(2)} mm</span>
                  <span className="muted">
                    likely between {pr.bandMm[0].toFixed(2)} and {pr.bandMm[1].toFixed(2)} mm. A range this wide covered{" "}
                    {pct(m.ext_diameter.band_coverage)} of real runs on test days the model never saw.
                  </span>
                  {moon && <span className="whatif-warn">Moon-Base-like air: the team's report says this prediction is not valid here.</span>}
                </li>
                <li className="whatif-card">
                  <span className="whatif-label">Chance the droplet breaks apart</span>
                  <span className="whatif-value t-display">{pct(pr.pDisruption)}</span>
                  <span className="muted">Across all FLEX runs, {pct(m.disruption.typical_rate)} broke apart.</span>
                  <Trend doc={doc} sel={sel} />
                </li>
                <li className="whatif-card">
                  <span className="whatif-label">Burning rate</span>
                  <span className="whatif-value t-display">
                    {pr.burningRate.toFixed(2)} <small>mm²/s</small>
                  </span>
                  <span className="muted">How fast the square of the droplet's diameter shrinks. Typical model error {m.burning_rate.rmse} mm²/s.</span>
                </li>
              </ul>
              <WatchBurn
                doc={doc}
                fuel={a.fuel[sel.fuel]}
                d0={a.d0[sel.d0]}
                burningRate={pr.burningRate}
                extMm={pr.extDiameterMm}
                pDisruption={pr.pDisruption}
                moon={moon}
                level={sup.level}
              />
              <Effects doc={doc} sel={sel} onGo={onChange} />
            </>
          )}
          {p.pinned && <Compare doc={doc} a={p.pinned} b={sel} />}
          <p className="whatif-foot muted">
            How these were tested: every score comes from test days held out of training. Models: {m.ext_diameter.name};{" "}
            {m.disruption.name}; {m.burning_rate.name}. Nothing here covers solid materials, other fuels or Moon gravity.
          </p>
        </div>
      </div>
    </section>
  );
}

/** What matters most here: one step in each input, with the change it makes. Each row can be applied. */
function Effects({ doc, sel, onGo }: { doc: WhatIfDoc; sel: Sel; onGo: (s: Sel) => void }) {
  const rows = effects(doc, sel);
  return (
    <div className="whatif-effects">
      <h3 className="whatif-h3">What matters most here</h3>
      <div className="whatif-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">If you change</th>
              <th scope="col">Chance of break-up</th>
              <th scope="col">Flame goes out at</th>
              <th scope="col">Burning rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.change}>
                <th scope="row">
                  <button type="button" className="whatif-try" onClick={() => onGo(r.to)}>
                    {r.change}
                  </button>
                  {r.note && <span className="whatif-note">{r.note}</span>}
                </th>
                <td>{signed(r.dChance, "pts")}</td>
                <td>{signed(r.dExt, "mm", 2)}</td>
                <td>{signed(r.dBurn, "mm²/s", 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted whatif-small">Read from the same model predictions. Click a change to try it.</p>
    </div>
  );
}

/** Pinned setting next to the current one, with the differences. */
function Compare({ doc, a, b }: { doc: WhatIfDoc; a: Sel; b: Sel }) {
  const pa = predict(doc, a);
  const pb = predict(doc, b);
  const val = (p: Prediction, f: (q: Extract<Prediction, { possible: true }>) => string) => (p.possible ? f(p) : "not possible");
  const diff = (f: (q: Extract<Prediction, { possible: true }>) => number, unit: string, digits: number) =>
    pa.possible && pb.possible ? signed(f(pb) - f(pa), unit, digits) : "–";
  return (
    <div className="whatif-compare">
      <h3 className="whatif-h3">Pinned vs now</h3>
      <div className="whatif-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Pinned</th>
              <th scope="col">Now</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Conditions</th>
              <td>{describe(doc, a)}</td>
              <td>{describe(doc, b)}</td>
              <td />
            </tr>
            <tr>
              <th scope="row">Chance of break-up</th>
              <td>{val(pa, (q) => pct(q.pDisruption))}</td>
              <td>{val(pb, (q) => pct(q.pDisruption))}</td>
              <td>{diff((q) => q.pDisruption * 100, "pts", 0)}</td>
            </tr>
            <tr>
              <th scope="row">Flame goes out at</th>
              <td>{val(pa, (q) => `${q.extDiameterMm.toFixed(2)} mm`)}</td>
              <td>{val(pb, (q) => `${q.extDiameterMm.toFixed(2)} mm`)}</td>
              <td>{diff((q) => q.extDiameterMm, "mm", 2)}</td>
            </tr>
            <tr>
              <th scope="row">Burning rate</th>
              <td>{val(pa, (q) => `${q.burningRate.toFixed(2)} mm²/s`)}</td>
              <td>{val(pb, (q) => `${q.burningRate.toFixed(2)} mm²/s`)}</td>
              <td>{diff((q) => q.burningRate, "mm²/s", 2)}</td>
            </tr>
            <tr>
              <th scope="row">Data support</th>
              <td>{LEVEL_LABEL[support(pa).level]}</td>
              <td>{LEVEL_LABEL[support(pb).level]}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Chance of break-up across the oxygen range for the other settings, with the current point and the typical rate. */
function Trend({ doc, sel }: { doc: WhatIfDoc; sel: Sel }) {
  const pts = o2Curve(doc, sel);
  const W = 240;
  const H = 64;
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (W - 8);
  const y = (p: number) => H - 6 - p * (H - 12);
  // break the line where a mix is impossible
  let line = "";
  let pen = false;
  pts.forEach((q, i) => {
    if (q.p === null) {
      pen = false;
      return;
    }
    line += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(q.p).toFixed(1)} `;
    pen = true;
  });
  const typical = doc.models.disruption.typical_rate;
  const ok = pts.filter((q) => q.p !== null) as { o2: number; p: number }[];
  const lo = ok[0];
  const hi = ok[ok.length - 1];
  const cur = pts[sel.o2].p;
  return (
    <svg
      className="whatif-trend"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={lo && hi ? `Chance of break-up from ${pct(lo.o2)} to ${pct(hi.o2)} oxygen: ${pct(lo.p)} to ${pct(hi.p)}.` : "No possible mix to chart."}
    >
      <line className="whatif-trend-typical" x1={4} x2={W - 4} y1={y(typical)} y2={y(typical)} />
      <path className="whatif-trend-line" d={line.trim()} />
      {cur !== null && <circle className="whatif-trend-dot" cx={x(sel.o2)} cy={y(cur)} r={4} />}
      <text className="whatif-trend-axis" x={4} y={H - 0.5}>
        {pct(doc.axes.o2[0])} O₂
      </text>
      <text className="whatif-trend-axis" x={W - 4} y={H - 0.5} textAnchor="end">
        {pct(doc.axes.o2[doc.axes.o2.length - 1])}
      </text>
    </svg>
  );
}
