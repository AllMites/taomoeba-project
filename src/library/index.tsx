// Library (docs/RESKIN_PRD.md, section 3): the records behind every answer, made visible in the left panel.
import { useState } from "react";
import NewTabLink from "../app/NewTabLink.tsx";
import { askAbout, dragProps } from "../app/console.ts";
import { useStore } from "../app/store.ts";
import { safeHref } from "../brief/brief.ts";
import { useDataset } from "../data/useDataset.ts";
import { AskIcon } from "../top/index.tsx";
import { filterExperiments, filterSources, FILTERS, PIPELINE, sourceKind, SOURCES_SHOWN, type LibraryFilter } from "./logic.ts";
import "./library.css";

/** Left panel: sources and experiments, search, Prevention / Detection / Suppression filter, pipeline steps. */
export default function Library() {
  const open = useStore((s) => s.setSelectedInvestigationId);
  const inv = useDataset("investigations");
  const src = useDataset("sources");
  // Local on purpose: the Rank sheet has its own filter in the store, and browsing here must not move it.
  const [pds, setPds] = useState<LibraryFilter>("all");
  const [search, setSearch] = useState("");
  const [allSources, setAllSources] = useState(false);

  const failed = inv.status === "error" || src.status === "error";
  const ready = inv.status === "ready" && src.status === "ready";
  const experiments = ready ? filterExperiments(inv.data, pds, search) : [];
  const sources = ready ? filterSources(src.data, inv.data, pds, search) : [];
  const filtering = pds !== "all" || search.trim() !== "";
  const shownSources = filtering || allSources ? sources : sources.slice(0, SOURCES_SHOWN);

  return (
    <section className="lib" aria-labelledby="lib-h">
      <h2 id="lib-h" className="lib-h t-readout">
        Library
      </h2>
      <label className="lib-search">
        <span className="sr-only">Search the library</span>
        <input type="search" value={search} placeholder="Search name, id, fuel or hardware" onChange={(e) => setSearch(e.target.value)} />
      </label>
      <div className="lib-seg" role="group" aria-label="Kind of experiment">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className="lib-seg-btn" aria-pressed={pds === f.value} onClick={() => setPds(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {failed ? (
        <p role="alert" className="lib-note">
          Could not load the library. Reload the page to try again.
        </p>
      ) : !ready ? (
        <p role="status" className="lib-note">
          Loading the library
        </p>
      ) : (
        <>
          <h3 className="lib-sub t-readout">
            Experiments <span className="lib-count">{experiments.length}</span>
          </h3>
          {experiments.length === 0 ? (
            <p className="lib-note">No experiments match.</p>
          ) : (
            <ul className="lib-list">
              {experiments.map((i) => (
                <li key={i.id} className="lib-row">
                  <button type="button" className="lib-open" aria-haspopup="dialog" onClick={() => open(i.id)} {...dragProps(i.id)}>
                    <span className="lib-name" title={i.title}>{i.title}</span>
                    <span className="lib-meta">
                      <span className="t-readout">{i.id}</span> {i.pds}
                    </span>
                  </button>
                  <button type="button" className="lib-ask" aria-label={`Ask about ${i.title}`} title="Ask about this" onClick={() => askAbout(i.id)}>
                    <AskIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="lib-sub t-readout">
            Sources <span className="lib-count">{sources.length}</span>
          </h3>
          {sources.length === 0 ? (
            <p className="lib-note">No sources match.</p>
          ) : (
            <ul className="lib-list">
              {shownSources.map((s) => {
                const href = safeHref(s.url);
                return (
                  <li key={s.id} className="lib-row lib-source">
                    {href ? <NewTabLink href={href}>{s.title}</NewTabLink> : <span>{s.title}</span>}
                    <span className="lib-meta t-readout">{sourceKind(s.id)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {shownSources.length < sources.length && (
            <button type="button" className="quiet lib-more" onClick={() => setAllSources(true)}>
              Show all {sources.length} sources
            </button>
          )}
        </>
      )}

      <h3 className="lib-sub t-readout">How an answer is made</h3>
      <ol className="lib-steps">
        {PIPELINE.map((p, n) => (
          <li key={p.name} className="lib-step">
            <span className="lib-step-n t-readout" aria-hidden="true">
              {n + 1}
            </span>
            <span className="lib-step-body">
              <span className="lib-step-name">
                {p.name} <span className="lib-meta t-readout">{p.tool}</span>
              </span>
              <span className="lib-step-text">{p.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
