import { useEffect, useId, useRef, useState } from "react";
import { askAbout, useConsole } from "../../app/console.ts";
import { useStore } from "../../app/store.ts";
import { useDataset } from "../../data/useDataset.ts";
import { OUTCOME, type SolidsDoc } from "../../solids/logic.ts";
import { usePlayback } from "../playback.ts";
import HowWeKnow from "../../brief/HowWeKnow.tsx";
import { AftermathCard } from "./Aftermath.tsx";
import { nextPick } from "./callout.ts";
import { useCited } from "../cite.ts";
import { evidenceFor, OBJECTS, type CabinObject, type Fabric, type Gravity } from "../spread/spread.ts";
import { GRAVITIES, gravityName, MOON_ESTIMATE, RESPONSES, responseLines, STARTS, type Outcome, type Response, type Story } from "../spread/story.ts";

/** More of a scroll box is below its visible part (2 px of slack for rounding). */
export const moreBelow = (el: { scrollHeight: number; scrollTop: number; clientHeight: number }) => el.scrollHeight - el.scrollTop - el.clientHeight > 2;

/** What the chosen response does here, in words the viewer reads first. */
export const OUTCOME_WORDS: Record<Outcome, string> = {
  out: "The flame goes out",
  burns: "The flame keeps burning",
  weaker: "Not tested: drawn as a weaker flame",
};

/** A new response replays from the detector trip, so the viewer sees what it does without waiting for the spread. */
function respond(st: Story, id: Response) {
  if (id === st.input.response) return;
  const un = usePlayback.subscribe((s, p) => {
    if (s.timeline === p.timeline) return;
    un();
    usePlayback.getState().seek(Math.max(0, st.detect - 1));
  });
  usePlayback.getState().setScenario({ response: id });
}

/** The scenario: where the fire starts, the crew's response, and what the records say that response does. */
function Scenario({ st, kPa }: { st: Story; kPa: number | undefined }) {
  const lines = responseLines(st);
  const cited = useCited(lines.evidence.refs);
  return (
    <>
      <label className="spread-field">
        <span className="spread-legend">Where it starts</span>
        <select value={st.input.start} onChange={(e) => usePlayback.getState().setScenario({ start: e.target.value as Story["input"]["start"] })}>
          {STARTS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="spread-set spread-grav">
        <legend className="spread-legend">Gravity</legend>
        {GRAVITIES.map((x) => {
          const [where, how] = gravityName(x.id, st.input.o2, kPa).replace(")", "").split(" (");
          return (
            <button key={x.id} type="button" className="spread-obj spread-resp" aria-pressed={st.input.g === x.id} onClick={() => usePlayback.getState().setScenario({ grav: x.id })}>
              <span>
                {where}
                <span className="spread-how">{how}</span>
              </span>
            </button>
          );
        })}
      </fieldset>
      {st.input.g === "partial" && <p className="spread-text spread-estimate">{MOON_ESTIMATE}. Drawn between orbit and Earth.</p>}
      <fieldset className="spread-set">
        <legend className="spread-legend">Response when the detector trips</legend>
        {RESPONSES.map((x) => (
          <button key={x.id} type="button" className="spread-obj spread-resp" aria-pressed={st.input.response === x.id} onClick={() => respond(st, x.id)}>
            {x.name}
          </button>
        ))}
      </fieldset>
      <section className="spread-outcome" aria-label="What the response does" aria-live="polite">
        <p className="spread-outcome-h" data-outcome={st.outcome}>
          <span className="burn-mark" data-mark={st.outcome === "out" ? "dashed" : st.outcome === "weaker" ? "half" : "solid"} aria-hidden="true" />
          {OUTCOME_WORDS[st.outcome]}
        </p>
        <p className="spread-text">
          {lines.evidence.text}
          {lines.evidence.refs.length === 0 && !/Illustration/.test(lines.evidence.text) ? " Illustration." : ""}
        </p>
        {cited.length > 0 && <HowWeKnow records={cited} />}
        <p className="spread-text spread-src">{lines.unknown}</p>
      </section>
    </>
  );
}

/** The details of one object, pinned in its callout in the scene: what it is, whether it burns, how it behaves, and the real test that matches. */
export function ObjectCard({ o, g, doc, fabric, start }: { o: CabinObject; g: Gravity; doc: SolidsDoc | null; fabric: Fabric; start: string }) {
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
      {STARTS.some((x) => x.id === o.id) && start !== o.id && (
        <div className="spread-actions">
          <button type="button" className="spread-btn spread-btn-main" onClick={() => usePlayback.getState().setScenario({ start: o.id as Story["input"]["start"] })}>
            Start a fire here
          </button>
        </div>
      )}
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
 * The fire scenario's panel at the stage's left edge: every object as a button, and the picked object's card.
 */
export function SpreadPanel({ air, kPa, g, doc, fabric, st, where = "" }: { air: string; kPa: number | undefined; g: Gravity; doc: SolidsDoc | null; fabric: Fabric; st: Story; where?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const picked = usePlayback((s) => s.picked);
  const o = OBJECTS.find((x) => x.id === picked);
  const form = useRef<HTMLFormElement>(null);
  // Escape closes the open panel.
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  // While more is below, the panel's bottom edge fades (the "On Earth" card's cue), so the last line is not missed.
  const [more, setMore] = useState(false);
  useEffect(() => {
    const f = form.current;
    if (!f) return;
    const sync = () => setMore(moreBelow(f));
    sync();
    f.addEventListener("scroll", sync, { passive: true });
    f.addEventListener("toggle", sync, true);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    ro?.observe(f);
    for (const c of f.children) ro?.observe(c);
    return () => {
      f.removeEventListener("scroll", sync);
      f.removeEventListener("toggle", sync, true);
      ro?.disconnect();
    };
  });
  return (
    <div className="burn" data-open={open || undefined}>
      <button type="button" className="burn-toggle glass" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((v) => !v)}>
        Scenario
      </button>
      <form ref={form} id={`${id}-panel`} className="burn-panel glass" data-more={more || undefined} aria-label="Fire spread settings" onSubmit={(e) => e.preventDefault()}>
        <p className="burn-h">Fire in this base, {air}</p>
        <p className="burn-support">Illustrative times, scaled by oxygen.</p>
        <AftermathCard st={st} where={where} inline />
        <Scenario st={st} kPa={kPa} />
        {/* The pinned object's details show in the scene; here they are read out for a screen reader. */}
        <p className="sr-only" aria-live="polite">
          {o ? `${o.name}: ${o.burns(g) ? "combustible" : "does not burn"}${g === "earth" ? " at 1 g" : " here"}. ${o.behaviour}` : ""}
        </p>
        <details className="spread-objs">
          <summary className="spread-legend">Objects in the cabin ({OBJECTS.length})</summary>
          <div className="spread-list" role="group" aria-label="Objects in the cabin">
            {OBJECTS.map((x) => (
              <button
                key={x.id}
                type="button"
                className="spread-obj"
                aria-pressed={picked === x.id}
                onClick={() => usePlayback.getState().pick(nextPick(picked, x.id))}
              >
                <span className="burn-mark" data-mark={x.burns(g) ? "solid" : "dashed"} aria-hidden="true" />
                {x.name}
              </button>
            ))}
          </div>
        </details>
      </form>
    </div>
  );
}
