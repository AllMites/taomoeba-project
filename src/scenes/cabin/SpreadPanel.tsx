import { useId, useState } from "react";
import { askAbout, useConsole } from "../../app/console.ts";
import { useStore } from "../../app/store.ts";
import { useDataset } from "../../data/useDataset.ts";
import { OUTCOME, type SolidsDoc } from "../../solids/logic.ts";
import { usePlayback } from "../playback.ts";
import { evidenceFor, OBJECTS, type CabinObject, type Fabric, type Gravity } from "../spread/spread.ts";

/** Airflow choices, cm/s. The BASS-II fabric flames went out between about 1 and 5 cm/s. */
export const FLOWS = [1, 2, 5, 10, 20];

/** The detail card for one object: what it is, whether it burns, how it behaves, and the real test that matches. */
function Card({ o, g, doc, fabric }: { o: CabinObject; g: Gravity; doc: SolidsDoc | null; fabric: Fabric }) {
  const inv = useDataset("investigations");
  const known = new Set(inv.status === "ready" ? inv.data.map((i) => i.id) : []);
  const ev = evidenceFor(o, doc, known);
  const id = ev.ids[0];
  const title = id && inv.status === "ready" ? inv.data.find((i) => i.id === id)?.title : undefined;
  const burns = o.burns(g);
  return (
    <section className="spread-card" aria-label={o.name}>
      <h3 className="spread-card-h">{o.name}</h3>
      <p className="spread-burns">
        <span className="burn-mark" data-mark={burns ? "solid" : "dashed"} aria-hidden="true" />
        <b>{burns ? "Combustible" : "Does not burn"}</b>
        {g === "earth" ? " at 1 g" : " here"}
      </p>
      <p className="spread-text">{o.behaviour}</p>
      {o.fabric && fabric.test && (
        <p className="spread-text">
          Nearest BASS-II test, {fabric.test.test}: {fabric.test.o2}% oxygen, airflow {fabric.test.flowTo} cm/s.{" "}
          <b>{OUTCOME[fabric.test.outcome].label}.</b>
        </p>
      )}
      {o.fabric && fabric.beyond && <p className="spread-text">This air has more oxygen than any BASS-II test: drawn burning, beyond the tests.</p>}
      {ev.sample && doc && (
        <p className="spread-text">
          SAFFIRE-II sample {ev.sample.sample} ({ev.sample.material}): in space, {ev.sample.space.text.toLowerCase()}; on Earth,{" "}
          {ev.sample.earth.text.toLowerCase()}. <span className="spread-src">Source: {doc.saffire.source.title}</span>
        </p>
      )}
      {id && (
        <>
          <p className="spread-text">
            Experiment: <b>{id}</b>
            {title ? ` ${title}` : ""}
          </p>
          <div className="spread-actions">
            <button type="button" className="spread-btn" onClick={() => useStore.getState().setSelectedInvestigationId(id)}>
              Open the evidence
            </button>
            <button type="button" className="spread-btn" onClick={() => askAbout(id)}>
              Ask about this
            </button>
            <button type="button" className="spread-btn" onClick={() => useConsole.getState().setView("materials")}>
              Open Materials
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Fire spread controls at the stage's left edge: the cabin airflow (which decides, from the BASS-II tests, whether
 * the cloth's flame lives), every object as a button, and the picked object's card.
 */
export function SpreadPanel({ air, g, doc, fabric }: { air: string; g: Gravity; doc: SolidsDoc | null; fabric: Fabric }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const flow = usePlayback((s) => s.flow);
  const picked = usePlayback((s) => s.picked);
  const o = OBJECTS.find((x) => x.id === picked);
  return (
    <div className="burn" data-open={open || undefined}>
      <button type="button" className="burn-toggle glass" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((v) => !v)}>
        Objects
      </button>
      <form id={`${id}-panel`} className="burn-panel glass" aria-label="Fire spread settings" onSubmit={(e) => e.preventDefault()}>
        <p className="burn-h">Fire spread, in {air}</p>
        <label className="burn-field">
          <span>Cabin airflow</span>
          <select value={flow} onChange={(e) => usePlayback.getState().setFlow(Number(e.target.value))}>
            {FLOWS.map((f) => (
              <option key={f} value={f}>
                {f} cm/s
              </option>
            ))}
          </select>
        </label>
        <p className="burn-support">
          {g === "earth"
            ? "At 1 g rising hot gas feeds the flame whatever the fan does."
            : fabric.lives
              ? "At this airflow the cloth's flame lives, as in the nearest real test."
              : "At this airflow the cloth's flame goes out, as in the nearest real test."}{" "}
          Spread speed is illustrative, scaled by oxygen.
        </p>
        <div className="spread-list" role="group" aria-label="Objects in the cabin">
          {OBJECTS.map((x) => (
            <button
              key={x.id}
              type="button"
              className="spread-obj"
              aria-pressed={picked === x.id}
              onClick={() => usePlayback.getState().pick(picked === x.id ? null : x.id)}
            >
              <span className="burn-mark" data-mark={x.burns(g) ? "solid" : "dashed"} aria-hidden="true" />
              {x.name}
            </button>
          ))}
        </div>
        {o && <Card o={o} g={g} doc={doc} fabric={fabric} />}
      </form>
    </div>
  );
}
