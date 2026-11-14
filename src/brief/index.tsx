import { useState } from "react";
import { useStore } from "../app/store.ts";
import type { Claim, Source } from "../contracts/index.ts";
import { briefFor } from "../data/select.ts";
import { useDataset } from "../data/useDataset.ts";
import { orderBrief, parseCount, singleExperiment } from "./brief.ts";
import "./brief.css";

const SHOWN = 5;
const MAX_MARKS = 60;

/** "6 of 24" as a row of marks: filled = counted, hollow = not. Text equivalent for screen readers. */
function Marks({ n, of }: { n: number; of: number }) {
  if (of > MAX_MARKS) return null;
  return (
    <div className="brief-marks" role="img" aria-label={`${n} of ${of} experiments`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? "mark on" : "mark"} aria-hidden="true" />
      ))}
      <span className="brief-marks-text" aria-hidden="true">
        {n} of {of} experiments
      </span>
    </div>
  );
}

function TakeawayCard({ claim, sources }: { claim: Claim; sources: Source[] }) {
  const open = useStore((s) => s.setSelectedInvestigationId);
  const count = parseCount(claim.text);
  const one = singleExperiment(claim);
  const cited = claim.sourceIds.flatMap((id) => sources.filter((s) => s.id === id));
  return (
    <li className="brief-card">
      <p className="brief-text">{claim.text}</p>
      {count && <Marks n={count.n} of={count.of} />}
      <div className="brief-actions">
        {one && (
          <button type="button" className="brief-btn" onClick={() => open(one)}>
            See experiment
          </button>
        )}
        <details className="brief-how">
          <summary>How we know</summary>
          <p className="brief-excerpt">{claim.excerpt}</p>
          {cited.length > 0 && (
            <ul className="brief-sources">
              {cited.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </li>
  );
}

function List({ claims, sources }: { claims: Claim[]; sources: Source[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? claims : claims.slice(0, SHOWN);
  return (
    <>
      <ul className="brief-list">
        {shown.map((c) => (
          <TakeawayCard key={c.id} claim={c} sources={sources} />
        ))}
      </ul>
      {claims.length > SHOWN && (
        <button type="button" className="brief-btn brief-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${claims.length}`}
        </button>
      )}
    </>
  );
}

export default function Brief() {
  const habitat = useStore((s) => s.habitat);
  const claims = useDataset("claims");
  const sources = useDataset("sources");
  const habitats = useDataset("habitats");
  const label = habitats.status === "ready" ? (habitats.data.find((h) => h.id === habitat)?.label ?? habitat) : habitat;

  let body;
  if (claims.status === "error" || sources.status === "error") {
    body = <p role="alert">The brief could not be loaded. Reload the page to try again.</p>;
  } else if (claims.status === "loading" || sources.status === "loading") {
    body = <p role="status">Loading the brief</p>;
  } else {
    const items = orderBrief(briefFor(claims.data, habitat));
    // key resets "Show all" when the habitat changes
    body = items.length ? (
      <List key={habitat} claims={items} sources={sources.data} />
    ) : (
      <p className="muted">No brief for this habitat yet.</p>
    );
  }

  return (
    <section className="brief" aria-labelledby="brief-h">
      <h2 id="brief-h">Interpret</h2>
      <p className="brief-sub">What the evidence says for {label}</p>
      {body}
    </section>
  );
}
