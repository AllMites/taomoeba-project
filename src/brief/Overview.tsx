import { useEffect, useState } from "react";
import type { Claim, HabitatPreset, Investigation, Source } from "../contracts/index.ts";
import HowWeKnow from "./HowWeKnow.tsx";
import { BEHAVIOUR, overviewFor, resolveRef, SIDE_BY_SIDE, type CitedRecord, type OverviewDb, type Ref, type Statement } from "./overview.ts";

type Extra = Pick<OverviewDb, "facts" | "solids" | "earth">;

/** facts.json, solids.json and earth.json are not typed datasets; read them once for "How we know". */
function useExtra(): Extra | null {
  const [extra, setExtra] = useState<Extra | null>(null);
  useEffect(() => {
    let live = true;
    const get = (name: string) =>
      fetch(`/data/${name}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    Promise.all([get("facts"), get("solids"), get("earth")]).then(([facts, solids, earth]) => {
      if (!live) return;
      setExtra({
        facts: Array.isArray(facts) ? facts : [],
        solids: solids && typeof solids === "object" && "saffire" in solids ? solids : null,
        earth: earth && Array.isArray(earth.items) ? earth.items : [],
      });
    });
    return () => {
      live = false;
    };
  }, []);
  return extra;
}

function Cite({ refs, resolve }: { refs: Ref[]; resolve: (r: Ref) => CitedRecord | null }) {
  const records = refs.flatMap((r) => resolve(r) ?? []);
  return <HowWeKnow records={records} />;
}

function Statements({ items, resolve, kind }: { items: Statement[]; resolve: (r: Ref) => CitedRecord | null; kind: "known" | "unknown" }) {
  return (
    <ul className={`ov-list ov-${kind}`}>
      {items.map((s) => (
        <li key={s.id} className="ov-item">
          {s.label && <p className="ov-label t-readout">{s.label}</p>}
          <p className="ov-text">{s.text}</p>
          <Cite refs={s.refs} resolve={resolve} />
        </li>
      ))}
    </ul>
  );
}

export default function Overview(p: {
  habitat: HabitatPreset["id"];
  claims: Claim[];
  sources: Source[];
  habitats: HabitatPreset[];
  investigations: Investigation[];
}) {
  const extra = useExtra();
  const base = overviewFor(p.habitat);
  const db: OverviewDb = {
    claims: p.claims,
    sources: p.sources,
    habitats: p.habitats,
    investigations: p.investigations,
    facts: extra?.facts ?? [],
    solids: extra?.solids ?? null,
    earth: extra?.earth ?? [],
  };
  const resolve = (r: Ref) => resolveRef(r, db);
  const preset = p.habitats.find((h) => h.id === p.habitat);

  return (
    <div className="ov">
      {base && (
        <div className="ov-lead-wrap">
          <p className="ov-lead t-statement">{base.lead.text}</p>
          <Cite refs={base.lead.refs} resolve={resolve} />
        </div>
      )}

      <div className="ov-grid">
        <section className="ov-block" aria-labelledby="ov-behave">
          <h3 id="ov-behave" className="ov-h">How a flame behaves without gravity</h3>
          <Statements items={BEHAVIOUR} resolve={resolve} kind="known" />
        </section>

        <section className="ov-block" aria-labelledby="ov-side">
          <h3 id="ov-side" className="ov-h">Space and Earth, side by side</h3>
          <table className="ov-table">
            <thead>
              <tr>
                <th scope="col" className="t-readout">
                  <span className="sr-only">Topic</span>
                </th>
                <th scope="col" className="t-readout">In orbit</th>
                <th scope="col" className="t-readout">On Earth</th>
              </tr>
            </thead>
            <tbody>
              {SIDE_BY_SIDE.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <span className="ov-topic">{r.topic}</span>
                    <Cite refs={r.refs} resolve={resolve} />
                  </th>
                  <td data-label="In orbit">{r.space}</td>
                  <td data-label="On Earth">{r.earth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {base && (
          <section className="ov-block" aria-labelledby="ov-air">
            <h3 id="ov-air" className="ov-h">{base.heading}</h3>
            {preset && (
              <p className="ov-air t-readout">
                {preset.o2Percent}% oxygen <span aria-hidden="true">/</span> {preset.pressureKPa} kPa
              </p>
            )}
            <Statements items={base.air} resolve={resolve} kind="known" />
          </section>
        )}

        {base && (
          <section className="ov-block" aria-labelledby="ov-limits">
            <h3 id="ov-limits" className="ov-h">What the data cannot tell you</h3>
            <Statements items={base.limits} resolve={resolve} kind="unknown" />
          </section>
        )}
      </div>
    </div>
  );
}
