import { useEffect, useState } from "react";
import { useStore } from "../app/store.ts";
import type { HabitatPreset, Investigation } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import type { WhatIfDoc } from "../whatif/logic.ts";
import { loadWhatIf } from "../whatif/load.ts";
import { coverage, flexNear, nextTests, PLANNED } from "./logic.ts";
import "./gaps.css";

/** "What to test next": where the record runs out for the habitat picked at the top of the page. */
export default function Gaps() {
  const habitatId = useStore((s) => s.habitat);
  const habitats = useDataset("habitats");
  const investigations = useDataset("investigations");
  const [doc, setDoc] = useState<WhatIfDoc | null>(null);
  useEffect(() => {
    let live = true;
    void loadWhatIf().then((d) => live && setDoc(d));
    return () => {
      live = false;
    };
  }, []);
  const h = habitats.status === "ready" ? habitats.data.find((x) => x.id === habitatId) : undefined;
  if (!h || investigations.status !== "ready") return null;
  return <GapsView habitat={h} investigations={investigations.data} doc={doc} onOpen={(id) => useStore.getState().setSelectedInvestigationId(id)} />;
}

export function GapsView(p: { habitat: HabitatPreset; investigations: Investigation[]; doc: WhatIfDoc | null; onOpen?: (id: string) => void }) {
  const { habitat: h } = p;
  const c = coverage(h, p.investigations);
  const near = flexNear(p.doc, h);
  const next = nextTests(h, c, near);
  const fire = p.investigations.filter((i) => i.pds !== "Other").length;
  const exp = (i: Investigation) =>
    p.onOpen ? (
      <button type="button" className="gaps-exp" onClick={() => p.onOpen!(i.id)}>
        {i.title.length <= 28 ? i.title : `${i.id} (study)`}
      </button>
    ) : (
      i.title
    );
  return (
    <section className="gaps" aria-labelledby="gaps-h">
      <div className="sec-label">
        <p className="sec-word t-readout">Where the data runs out</p>
        <h2 id="gaps-h" className="sec-h">
          What to test next
        </h2>
      </div>
      <p className="gaps-intro">
        For {h.label} air ({h.o2Percent}% oxygen, {h.pressureKPa} kPa): what the {fire} fire experiments on record cover, and what they do not.
        Change the habitat at the top of the page to see another.
      </p>
      <div className="gaps-grid">
        <article className="gaps-card">
          <h3 className="gaps-h3">What the record covers</h3>
          <ul className="gaps-list">
            <li>
              <b>{c.both.length}</b> experiments tested both this oxygen level and this pressure
              {c.both.length > 0 && ":"}
              {c.both.length > 0 && (
                <ul className="gaps-exps">
                  {c.both.map((i) => (
                    <li key={i.id}>{exp(i)}</li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              <b>{c.o2Only.length}</b> more tested this oxygen level, but their pressure is not on record or was different.
            </li>
            <li>
              <b>{c.solidsCovering.length}</b> of {c.solidsWithO2} solid-material experiments with an oxygen level on record reached this air
              {c.maxSolidO2 !== null && ` (highest: ${c.maxSolidO2}%)`}.
            </li>
            <li>
              <b>{c.notOnRecord}</b> experiments have no oxygen level on record, so they cannot be placed.
            </li>
            {near && (
              <li>
                FLEX droplet runs close to this air (2 mm droplet, oxygen and nitrogen):{" "}
                {near.map((x) => `${x.similar} ${x.fuel} (${x.nearby} in the wider area)`).join(", ")}.
              </li>
            )}
          </ul>
          <p className="muted gaps-small">
            Counted from each experiment&apos;s tested ranges: oxygen within 1 point, pressure within 5%. FLEX counts come from the team&apos;s
            model grid.
          </p>
        </article>
        <article className="gaps-card">
          <h3 className="gaps-h3">Suggested next tests</h3>
          {next.length === 0 ? (
            <p className="muted">No clear gap for this air in the record.</p>
          ) : (
            <ol className="gaps-next">
              {next.map((n) => (
                <li key={n.title}>
                  <b>{n.title}</b>
                  <span className="gaps-why">{n.why}</span>
                  {n.planned.length > 0 && (
                    <span className="gaps-planned">
                      Planned by NASA:{" "}
                      {n.planned.map((k, j) => (
                        <span key={k}>
                          {j > 0 && ", "}
                          {PLANNED[k].url ? (
                            <a href={PLANNED[k].url!} target="_blank" rel="noreferrer">
                              {PLANNED[k].name}
                            </a>
                          ) : (
                            PLANNED[k].name
                          )}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className="muted gaps-small">
            Suggestions by the team, each following from a gap on the left. NASA&apos;s planned experiments are the ones named in the
            challenge brief.
          </p>
        </article>
      </div>
    </section>
  );
}
