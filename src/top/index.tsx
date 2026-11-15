// "Top for this base" (docs/RESKIN_PRD.md, section 3): the required summarize, rank and interpret results,
// drawn from data alone so they are on screen before any 3D loads.
import NewTabLink from "../app/NewTabLink.tsx";
import { askAbout, dragProps, useConsole } from "../app/console.ts";
import { useStore } from "../app/store.ts";
import { safeHref } from "../brief/brief.ts";
import { useDataset } from "../data/useDataset.ts";
import { rankNumeral } from "../ranking/logic.ts";
import { leadTakeaway, sameAirAs, sameAirLine, sameRows, scoreText, TOP_N, topThree } from "./logic.ts";
import "./top.css";

/** Lucide "message-circle", 1.5px stroke. */
export function AskIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

/** Glass card over the replay: top 3 ranked experiments for the picked base, with "See all". */
export default function TopForBase() {
  const habitatId = useStore((s) => s.habitat);
  const open = useStore((s) => s.setSelectedInvestigationId);
  const rank = useDataset("rank");
  const inv = useDataset("investigations");
  const claims = useDataset("claims");
  const habitats = useDataset("habitats");

  const failed = [rank, inv, claims].some((d) => d.status === "error");
  const ready = rank.status === "ready" && inv.status === "ready" && claims.status === "ready";
  const label = habitats.status === "ready" ? habitats.data.find((h) => h.id === habitatId)?.label : undefined;
  const rows = ready ? topThree(rank.data, inv.data, claims.data, habitatId) : [];
  const same =
    ready && habitats.status === "ready"
      ? sameAirLine(sameAirAs(habitats.data, habitatId, (other) => sameRows(rows, topThree(rank.data, inv.data, claims.data, other))))
      : null;

  return (
    <section className="top glass" aria-labelledby="top-h">
      <h2 id="top-h" className="top-h t-readout">
        Top for {label ?? "this base"}
      </h2>
      {same && !failed && <p className="top-same">{same}</p>}
      {failed ? (
        <p role="alert" className="top-note">
          Could not load the experiments. Reload the page to try again.
        </p>
      ) : ready && rows.length === 0 ? (
        <p className="top-note">No ranked experiments for this base yet.</p>
      ) : (
        <ol className="top-list" aria-busy={!ready}>
          {ready
            ? rows.map((r) => (
                <li key={r.inv.id} className="top-row">
                  <button
                    type="button"
                    className="top-open"
                    aria-haspopup="dialog"
                    aria-label={`Rank ${r.position}: ${r.inv.title}, score ${scoreText(r.item.score)} out of 100. Open the evidence.`}
                    onClick={() => open(r.inv.id)}
                    {...dragProps(r.inv.id)}
                  >
                    <span className="top-num t-readout" aria-hidden="true">
                      {rankNumeral(r.position)}
                    </span>
                    <span className="top-text">
                      <span className="top-name" title={r.inv.title}>
                        {r.inv.title}
                      </span>
                      <span className="top-sum">{r.summary ?? r.item.rationale}</span>
                    </span>
                    <span className="top-score t-readout" aria-hidden="true">
                      {scoreText(r.item.score)}
                    </span>
                  </button>
                  <button type="button" className="top-ask" aria-label={`Ask about ${r.inv.title}`} title="Ask about this" onClick={() => askAbout(r.inv.id)}>
                    <AskIcon />
                  </button>
                </li>
              ))
            : Array.from({ length: TOP_N }, (_, i) => <li key={i} className="top-row top-wait" aria-hidden="true" />)}
        </ol>
      )}
      <div className="top-foot">
        <span className="top-scale t-readout">Score / 100</span>
        <button type="button" className="pill top-all" onClick={() => useConsole.getState().setView("rank")}>
          See all
        </button>
      </div>
    </section>
  );
}

/** One-line interpretation with its source, bottom-left of the replay. */
export function BriefLine() {
  const habitatId = useStore((s) => s.habitat);
  const claims = useDataset("claims");
  const sources = useDataset("sources");
  if (claims.status !== "ready" || sources.status !== "ready") return <div className="briefline briefline-wait glass" aria-hidden="true" />;
  const lead = leadTakeaway(claims.data, sources.data, habitatId);
  if (!lead) return null;
  const first = lead.cited[0];
  const href = first ? safeHref(first.url) : null;
  const rest = lead.cited.length - 1;
  return (
    <section className="briefline glass" aria-label="What the evidence says">
      <p className="briefline-text">{lead.claim.text}</p>
      <p className="briefline-foot">
        {first && (
          <span className="briefline-src">
            <span className="t-readout">Source</span>
            {href ? <NewTabLink href={href}>{first.title}</NewTabLink> : <span>{first.title}</span>}
            {rest > 0 && <span className="briefline-rest">and {rest} more</span>}
          </span>
        )}
        <button type="button" className="quiet briefline-more" onClick={() => useConsole.getState().setView("interpret")}>
          More
        </button>
      </p>
    </section>
  );
}
