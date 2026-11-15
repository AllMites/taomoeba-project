import { useState } from "react";
import { useStore } from "../app/store.ts";
import type { Claim, Source } from "../contracts/index.ts";
import { briefFor } from "../data/select.ts";
import { useDataset } from "../data/useDataset.ts";
import { orderBrief, parseCount, singleExperiment } from "./brief.ts";
import HowWeKnow from "./HowWeKnow.tsx";
import Overview from "./Overview.tsx";
import "./brief.css";

const SHOWN = 5;
const MAX_MARKS = 60;

/** "6 of 24" as a row of marks: filled = counted, hollow = not. Text equivalent for screen readers. */
function Marks({ n, of, label }: { n: number; of: number; label: string }) {
  if (of > MAX_MARKS) return null;
  return (
    <div className="brief-marks" role="img" aria-label={label}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? "mark on" : "mark"} aria-hidden="true" />
      ))}
      <span className="brief-marks-text" aria-hidden="true">
        {label}
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
      <p className="brief-text t-statement">{claim.text}</p>
      {count && <Marks {...count} />}
      <div className="brief-actions">
        {one && (
          <button type="button" className="quiet" onClick={() => open(one)}>
            See experiment
          </button>
        )}
        <HowWeKnow records={[{ quote: claim.excerpt, cited: cited.map((s) => ({ title: s.title, url: s.url })) }]} />
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
        <button type="button" className="quiet brief-more" aria-expanded={all} onClick={() => setAll(!all)}>
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
  const investigations = useDataset("investigations");
  const label = habitats.status === "ready" ? (habitats.data.find((h) => h.id === habitat)?.label ?? habitat) : habitat;

  let body;
  if (claims.status === "error" || sources.status === "error") {
    body = <p role="alert">The brief could not be loaded. Reload the page to try again.</p>;
  } else if (claims.status === "loading" || sources.status === "loading") {
    body = <p role="status">Loading the brief</p>;
  } else {
    const items = orderBrief(briefFor(claims.data, habitat));
    // key resets "Show all" when the habitat changes
    const list = items.length ? (
      <List key={habitat} claims={items} sources={sources.data} />
    ) : (
      <p className="muted">No brief for this habitat yet.</p>
    );
    body = (
      <>
        <Overview
          habitat={habitat}
          claims={claims.data}
          sources={sources.data}
          habitats={habitats.status === "ready" ? habitats.data : []}
          investigations={investigations.status === "ready" ? investigations.data : []}
        />
        <h3 className="brief-sub">The evidence, point by point</h3>
        {list}
      </>
    );
  }

  return (
    <section className="brief" aria-labelledby="brief-h">
      <div className="sec-label">
        <p className="sec-word t-readout">Interpret</p>
        <h2 id="brief-h" className="sec-h">
          What the evidence says for {label}
        </h2>
      </div>
      {body}
    </section>
  );
}
