import { useId, useState } from "react";
import { useStore } from "../app/store.ts";
import type { Investigation } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import { compareRows, families } from "./logic.ts";
import "./compare.css";

/** Two experiments side by side: what is the same and what differs. A baseline the design team can restyle. */
export default function Compare() {
  const investigations = useDataset("investigations");
  if (investigations.status !== "ready") return null;
  return <CompareView investigations={investigations.data} onOpen={(id) => useStore.getState().setSelectedInvestigationId(id)} />;
}

export function CompareView({ investigations, onOpen, start = ["PSI-69", "PSI-159"] }: { investigations: Investigation[]; onOpen?: (id: string) => void; start?: [string, string] }) {
  const all = investigations.filter((i) => i.pds !== "Other");
  const fams = families(all);
  const [family, setFamily] = useState("all");
  const pool = family === "all" ? all : all.filter((i) => i.hardwareGroup === family);
  const pick = (id: string, fallback: number) => (pool.some((i) => i.id === id) ? id : (pool[Math.min(fallback, pool.length - 1)]?.id ?? ""));
  const [aId, setA] = useState(start[0]);
  const [bId, setB] = useState(start[1]);
  const a = pool.find((i) => i.id === pick(aId, 0));
  const b = pool.find((i) => i.id === pick(bId, 1));
  const uid = useId();
  const rows = a && b ? compareRows(a, b) : [];
  const same = rows.filter((r) => r.same).length;
  const opt = (i: Investigation) => (
    <option key={i.id} value={i.id}>
      {i.title} ({i.id})
    </option>
  );
  return (
    <section className="cmp" aria-labelledby="cmp-h">
      <div className="sec-label">
        <p className="sec-word t-readout">Side by side</p>
        <h2 id="cmp-h" className="sec-h">
          Compare two experiments
        </h2>
      </div>
      <p className="cmp-intro">How two investigations were set up: what they share and where they differ, straight from their PSI records.</p>
      <div className="cmp-controls">
        <label htmlFor={`${uid}-f`}>
          Hardware
          <select id={`${uid}-f`} value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="all">All hardware</option>
            {fams.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${uid}-a`}>
          First
          <select id={`${uid}-a`} value={a?.id ?? ""} onChange={(e) => setA(e.target.value)}>
            {pool.map(opt)}
          </select>
        </label>
        <label htmlFor={`${uid}-b`}>
          Second
          <select id={`${uid}-b`} value={b?.id ?? ""} onChange={(e) => setB(e.target.value)}>
            {pool.map(opt)}
          </select>
        </label>
      </div>
      {pool.length < 2 ? (
        <p className="muted">This hardware family has only one experiment on record; pick another family to compare.</p>
      ) : a && b ? (
        <>
          <p className="cmp-summary">
            {a.id === b.id ? "The same experiment is picked twice." : `Same in ${same} of ${rows.length} attributes; different in ${rows.length - same}.`}
          </p>
          <div className="cmp-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col">Attribute</th>
                  <th scope="col">
                    {onOpen ? (
                      <button type="button" className="cmp-open" onClick={() => onOpen(a.id)}>
                        {a.title}
                      </button>
                    ) : (
                      a.title
                    )}
                  </th>
                  <th scope="col">
                    {onOpen ? (
                      <button type="button" className="cmp-open" onClick={() => onOpen(b.id)}>
                        {b.title}
                      </button>
                    ) : (
                      b.title
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={r.same ? "cmp-same" : "cmp-diff"}>
                    <th scope="row">
                      {r.label}
                      <span className="cmp-tag">{r.same ? "Same" : "Differs"}</span>
                    </th>
                    <td>{r.a}</td>
                    <td>
                      {r.b}
                      {r.shared && <span className="cmp-shared">In both: {r.shared.join(", ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
