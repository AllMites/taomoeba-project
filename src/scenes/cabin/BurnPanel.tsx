import { useId, useState } from "react";
import { GAS_LABEL, gasOf, mixesOf, pct, type Gas, type WhatIfDoc } from "../../whatif/logic.ts";
import { dropletAt, SUPPORT_WORD, type BurnCase, type BurnPick } from "../burn/model.ts";
import { usePlayback } from "../playback.ts";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const mm = (x: number) => `${x.toFixed(2)} mm`;

/** Live readouts at the seeker's time: diameter now, rate, extinction size, time to extinction, support. */
function Readouts({ c, d0 }: { c: BurnCase; d0: number }) {
  const t = usePlayback((s) => s.t);
  if (c.kind === "none") return <p className="burn-none">{c.text}</p>;
  const now = dropletAt(c, t, d0);
  const sup = SUPPORT_WORD[c.level];
  return (
    <>
      <dl className="burn-ro t-readout">
        <div>
          <dt>Droplet now</dt>
          <dd>{mm(now.d)}</dd>
        </div>
        <div>
          <dt>Predicted rate</dt>
          <dd>{c.rate.toFixed(2)} mm²/s</dd>
        </div>
        <div>
          <dt>Predicted flame-out</dt>
          <dd>{c.plan.ends === "flame-out" ? mm(c.extMm) : "Burns away"}</dd>
        </div>
        <div>
          <dt>Time to {c.plan.ends === "flame-out" ? "flame-out" : "burn away"}</dt>
          <dd>{c.plan.tEnd.toFixed(1)} s</dd>
        </div>
      </dl>
      <p className="burn-support">
        <span className="burn-mark" data-mark={sup.mark} aria-hidden="true" />
        <b>{sup.word}</b> {c.levelText}
      </p>
    </>
  );
}

/**
 * The team's model, live in the scene: fuel, diluent gas and amount, start diameter (the Team models sheet's option
 * lists). Oxygen and pressure are the base's. A change re-renders the burn at once.
 */
export function BurnPanel({ doc, pick, c, air, compare }: { doc: WhatIfDoc; pick: BurnPick; c: BurnCase | null; air: string; compare: boolean | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const a = doc.axes;
  const gas = gasOf(doc, pick.mix);
  const amounts = mixesOf(doc, gas);
  const set = (next: Partial<BurnPick>) => usePlayback.getState().setSel({ ...pick, ...next });
  const pickGas = (g: Gas) => set({ mix: mixesOf(doc, g)[0] });
  return (
    <div className="burn" data-open={open || undefined}>
      <button type="button" className="burn-toggle glass" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((o) => !o)}>
        Model
      </button>
      <form id={`${id}-panel`} className="burn-panel glass" aria-label="Model burn settings" onSubmit={(e) => e.preventDefault()}>
        <p className="burn-h">Team model, in {air}</p>
        <label className="burn-field">
          <span>Fuel</span>
          <select value={pick.fuel} onChange={(e) => set({ fuel: Number(e.target.value) })}>
            {a.fuel.map((f, i) => (
              <option key={f} value={i}>
                {cap(f)}
              </option>
            ))}
          </select>
        </label>
        <label className="burn-field">
          <span>Gas mix</span>
          <select value={gas} onChange={(e) => pickGas(e.target.value as Gas)}>
            {(["n2", "co2", "he"] as Gas[]).map((g) => (
              <option key={g} value={g}>
                {GAS_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
        {gas !== "n2" && (
          <label className="burn-field">
            <span>{gas === "co2" ? "Carbon dioxide" : "Helium"}</span>
            <select value={pick.mix} onChange={(e) => set({ mix: Number(e.target.value) })}>
              {amounts.map((i) => (
                <option key={i} value={i}>
                  {pct(a.mix[i].amount)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="burn-field">
          <span>Start diameter</span>
          <select value={pick.d0} onChange={(e) => set({ d0: Number(e.target.value) })}>
            {a.d0.map((d, i) => (
              <option key={d} value={i}>
                {d} mm
              </option>
            ))}
          </select>
        </label>
        {c && <Readouts c={c} d0={a.d0[pick.d0]} />}
        {compare !== null && (
          <label className="burn-check">
            <input type="checkbox" checked={compare} onChange={(e) => usePlayback.getState().setCompare(e.target.checked)} />
            <span>Compare with station air</span>
          </label>
        )}
      </form>
    </div>
  );
}
