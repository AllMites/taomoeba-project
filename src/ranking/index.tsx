import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useStore, type PdsFilter } from "../app/store.ts";
import { HOW_RANKING_WORKS } from "../data/rankRule.ts";
import { rankedFor } from "../data/select.ts";
import { useDataset } from "../data/useDataset.ts";
import ExperimentCard from "./ExperimentCard.tsx";
import { buildRows, firstRevealedId, isFiltering, litHidden, matchRows, visibleRows } from "./logic.ts";
import "./ranking.css";

const FILTERS: { value: PdsFilter; label: string; hint: string }[] = [
  { value: "all", label: "All", hint: "every experiment" },
  { value: "Prevention", label: "Prevention", hint: "stop a fire starting" },
  { value: "Detection", label: "Detection", hint: "spot a fire early" },
  { value: "Suppression", label: "Suppression", hint: "put a fire out" },
];

export default function Ranking() {
  const habitatId = useStore((s) => s.habitat);
  const pds = useStore((s) => s.pds);
  const search = useStore((s) => s.search);
  const setPds = useStore((s) => s.setPds);
  const setSearch = useStore((s) => s.setSearch);
  const highlightIds = useStore((s) => s.highlightIds);
  const [showAll, setShowAll] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const rank = useDataset("rank");
  const inv = useDataset("investigations");
  const claims = useDataset("claims");
  const habitats = useDataset("habitats");

  const loadError = [rank, inv, claims, habitats].find((d) => d.status === "error");
  const ready = rank.status === "ready" && inv.status === "ready" && claims.status === "ready" && habitats.status === "ready";

  const habitat = ready ? habitats.data.find((h) => h.id === habitatId) : undefined;
  const rows = useMemo(
    () => (ready ? buildRows(rankedFor(rank.data, habitatId), inv.data, claims.data) : []),
    [ready, rank, inv, claims, habitatId],
  );

  const shown = visibleRows(rows, { pds, search, showAll, highlightIds });
  const filtering = isFiltering(pds, search);
  const matchCount = filtering ? matchRows(rows, pds, search).length : rows.length;
  const lit = new Set(highlightIds);
  const litKey = highlightIds.join("|");

  // A new answer scrolls its first lit card into view. The list has already opened if the card was hidden.
  useEffect(() => {
    if (!litKey || !ready) return;
    const t = window.setTimeout(() => {
      const el = sectionRef.current?.querySelector<HTMLElement>('[data-lit="true"]');
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [litKey, ready]);

  return (
    <section id="ranking" className="rk" aria-labelledby="ranking-h" ref={sectionRef}>
      <div className="rk-top">
        <h2 id="ranking-h" className="rk-h">Rank</h2>
        <details className="rk-how">
          <summary>How ranking works</summary>
          <p>{HOW_RANKING_WORKS}</p>
        </details>
      </div>
      <p className="rk-intro">
        {habitat
          ? `Best fit first for ${habitat.label}: ${habitat.o2Percent}% oxygen at ${habitat.pressureKPa} kPa.`
          : "Best fit first for the habitat you picked."}
      </p>

      {loadError ? (
        <p role="alert" className="rk-alert">
          Could not load the experiments. Reload the page to try again.
        </p>
      ) : !ready ? (
        <p role="status" className="rk-muted">Loading experiments…</p>
      ) : (
        <>
          <div className="rk-filters">
            <div className="rk-seg" role="group" aria-label="Kind of experiment">
              {FILTERS.map((f) => (
                <button key={f.value} type="button" className="rk-seg-btn" aria-pressed={pds === f.value} onClick={() => setPds(f.value)}>
                  <span className="rk-seg-name">{f.label}</span>
                  <span className="rk-seg-hint">{f.hint}</span>
                </button>
              ))}
            </div>
            <label className="rk-search">
              <span>Search</span>
              <input type="search" value={search} placeholder="Name, id, fuel or hardware" onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
          <p className="rk-count" role="status">
            {matchCount} of {rows.length} experiments
          </p>

          {shown.length === 0 ? (
            <div className="rk-empty">
              <p>No experiments match.</p>
              <button
                type="button"
                className="rk-btn"
                onClick={() => {
                  setPds("all");
                  setSearch("");
                }}
              >
                Clear filter and search
              </button>
            </div>
          ) : (
            <ol className="rk-list">
              {shown.map((r) => (
                <ExperimentCard key={r.inv.id} row={r} habitatO2={habitat?.o2Percent ?? 21} lit={lit.has(r.inv.id)} />
              ))}
            </ol>
          )}

          {!filtering && !showAll && shown.length < rows.length && !litHidden(rows, highlightIds) && (
            <button
              type="button"
              className="rk-btn rk-more"
              onClick={() => {
                // The button goes away, so move focus to the first card it revealed instead of dropping it on the page.
                const id = firstRevealedId(rows);
                flushSync(() => setShowAll(true));
                if (id) sectionRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus();
              }}
            >
              Show all {rows.length} experiments
            </button>
          )}
        </>
      )}
    </section>
  );
}
