import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../app/store.ts";
import type { Claim, HabitatPreset, Investigation, RankItem, Source } from "../contracts/index.ts";
import { claimsFor, loadRuns, rankedFor, runUrls, type RunTable } from "../data/select.ts";
import { useDataset } from "../data/useDataset.ts";
import { displayClass } from "../app/type.ts";
import type { HabitatId } from "../contracts/index.ts";
import { rankNumeral } from "../ranking/logic.ts";
import PdsTag from "../ranking/PdsTag.tsx";
import "./evidence.css";
import { columnHeader, conditionRows, factorWord, isSwitch, NOT_ON_RECORD, rationaleFor, safeHref, scoreText, visibleBlocks } from "./logic.ts";
import NewTabLink from "../app/NewTabLink.tsx";

type SourceMap = Map<string, Source>;

function SourceNote({ excerpt, sourceIds, sources }: { excerpt: string; sourceIds: string[]; sources: SourceMap }) {
  if (!excerpt && sourceIds.length === 0) return null;
  return (
    <details className="ev-source">
      <summary>Source</summary>
      {excerpt && <blockquote>{excerpt}</blockquote>}
      <ul>
        {sourceIds.map((id) => {
          const s = sources.get(id);
          const href = safeHref(s?.url);
          return (
            <li key={id}>
              {s && href ? (
                <NewTabLink href={href}>{s.title}</NewTabLink>
              ) : (
                <span>{s?.title ?? id}</span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function Sentence({ c, sources }: { c: Claim; sources: SourceMap }) {
  return (
    <li>
      <p>{c.text}</p>
      <SourceNote excerpt={c.excerpt} sourceIds={c.sourceIds} sources={sources} />
    </li>
  );
}

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="ev-block" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="ev-chips">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

function RunPreview({ path }: { path: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "error" } | { status: "ready"; table: RunTable }>({ status: "idle" });
  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open || state.status !== "idle") return;
    setState({ status: "loading" });
    loadRuns(path).then(
      (table) => setState({ status: "ready", table }),
      () => setState({ status: "error" }),
    );
  };
  return (
    <details className="ev-preview" onToggle={onToggle}>
      <summary>Preview</summary>
      {state.status === "loading" && <p className="ev-muted">Loading the first rows…</p>}
      {state.status === "error" && <p className="ev-muted">Could not load the run table. Use a download link above.</p>}
      {state.status === "ready" && (
        <>
          <div className="ev-scroll" tabIndex={0} role="region" aria-label="First 5 runs, scrolls sideways">
            <table>
              <thead>
                <tr>
                  {state.table.columns.map((c) => (
                    <th key={c.name} scope="col">
                      {columnHeader(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.table.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {state.table.columns.map((c) => {
                      const v = r[c.name];
                      return v === null || v === undefined || v === "" ? (
                        <td key={c.name} className="ev-muted" title={NOT_ON_RECORD}>
                          <span aria-hidden="true">–</span>
                          <span className="ev-sr">{NOT_ON_RECORD}</span>
                        </td>
                      ) : (
                        <td key={c.name}>{String(v)}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.table.notes.length > 0 && (
            <>
              <h4>Notes from the source table</h4>
              <ul className="ev-notes">
                {state.table.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </details>
  );
}

function Detail(props: {
  inv: Investigation;
  all: Investigation[];
  claims: Claim[];
  rank: RankItem[];
  sources: SourceMap;
  habitat: HabitatPreset | undefined;
  habitatId: string;
  open: (id: string) => void;
}) {
  const { inv, all, claims, rank, sources, habitat, habitatId, open } = props;
  const summary = claimsFor(claims, "summary", inv.id);
  const findings = claimsFor(claims, "finding", inv.id);
  const rationale = rationaleFor(claims, inv.id, habitatId);
  const item = rank.find((r) => r.investigationId === inv.id && r.habitat === habitatId);
  const factors = item?.factors ?? [];
  const changing = inv.variables.filter((v) => v.varies);
  const related = inv.related ?? [];
  const show = visibleBlocks({
    summary: summary.length,
    findings: findings.length,
    rationale: rationale.length,
    factors: factors.length,
    sensors: inv.sensors.length,
    measurements: inv.measurements.length,
    changing: changing.length,
    related: related.length,
  });
  const where = habitat?.label ?? "this habitat";
  // Same position the card shows: place in the habitat's ranked list, counting only items with an experiment.
  const known = new Set(all.map((x) => x.id));
  const position = rankedFor(rank, habitatId as HabitatId).filter((r) => known.has(r.investigationId)).findIndex((r) => r.investigationId === inv.id) + 1;
  const urls = inv.runs ? runUrls(inv.runs.path) : null;

  return (
    <div className="ev-body">
      <header className="ev-head">
        <div className="ev-headline">
          {position > 0 && (
            <span className="ev-num t-display" aria-label={`Rank ${position}`}>
              {rankNumeral(position)}
            </span>
          )}
          <h2 id="ev-title" className={`ev-title ${displayClass(inv.title)}`} tabIndex={-1}>
            {inv.title}
          </h2>
        </div>
        <p className="ev-id t-readout">{inv.id}</p>
        <p className="ev-tags">
          <PdsTag pds={inv.pds} />
          <span className="ev-tag ev-tag-alt">
            {inv.evidence === "flight" ? "Flown in microgravity" : inv.evidence === "ground" ? "Ground study" : "Test type not on record"}
          </span>
        </p>
        <p>{inv.pdsBasis}</p>
      </header>

      {show.summarize && (
        <Block id="ev-sum" title="Summarize">
          {summary.length > 0 && <ul className="ev-claims">{summary.map((c) => <Sentence key={c.id} c={c} sources={sources} />)}</ul>}
          {findings.length > 0 && (
            <>
              <h4>What it found</h4>
              <ul className="ev-claims">{findings.map((c) => <Sentence key={c.id} c={c} sources={sources} />)}</ul>
            </>
          )}
          {rationale.length > 0 && (
            <>
              <h4>Why it matters for {where}</h4>
              <ul className="ev-claims">{rationale.map((c) => <Sentence key={c.id} c={c} sources={sources} />)}</ul>
            </>
          )}
        </Block>
      )}

      {show.why && item && (
        <Block id="ev-why" title="Why it ranks here">
          <ul className="ev-factors">
            {factors.map((f) => {
              const word = factorWord(f);
              return (
                <li key={f.key}>
                  <div className="ev-factor-top">
                    <span className="ev-factor-label">{f.label}</span>
                    <span className={f.value === null ? "ev-muted" : "ev-word"}>{word}</span>
                  </div>
                  <div
                    className={`ev-meter${f.value === null ? " ev-meter-unknown" : ""}`}
                    role="img"
                    aria-label={f.value === null ? NOT_ON_RECORD : `${word}, ${Math.round(f.value * 100)} percent`}
                  >
                    <span style={{ width: `${f.value === null ? 0 : Math.round(f.value * 100)}%` }} />
                  </div>
                  <p>{f.reason}</p>
                  {f.key === "goalFit" && f.excerpt && (
                    <SourceNote excerpt={f.excerpt} sourceIds={f.sourceId ? [f.sourceId] : []} sources={sources} />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="ev-score">{scoreText(item.score)}</p>
        </Block>
      )}

      <Block id="ev-cond" title="Test conditions">
        <dl className="ev-cond">
          {conditionRows(inv).map((r) => (
            <div key={r.key}>
              <dt>{r.label}</dt>
              <dd>
                {r.value ?? <span className="ev-muted">{NOT_ON_RECORD}</span>}
                {r.fromTable && <span className="ev-muted"> from the experiment's data table</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Block>

      {show.measured && (
        <Block id="ev-meas" title="What was measured">
          {inv.sensors.length > 0 && (
            <>
              <h4>Sensors</h4>
              <Chips items={inv.sensors} />
            </>
          )}
          {inv.measurements.length > 0 && (
            <>
              <h4>Measurements</h4>
              <Chips items={inv.measurements} />
            </>
          )}
        </Block>
      )}

      {show.changed && (
        <Block id="ev-var" title="What changed between runs">
          <Chips items={changing.map((v) => v.name)} />
        </Block>
      )}

      {show.related && (
        <Block id="ev-rel" title="Related experiments">
          <ul className="ev-related">
            {related.map((r) => {
              const t = all.find((x) => x.id === r.id);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => open(r.id)}>
                    {t?.title ?? r.id} <span className="ev-id">{r.id}</span>
                  </button>
                  <p className="ev-muted">{r.reason}</p>
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      <Block id="ev-dl" title="Download runs">
        {inv.runs && urls ? (
          <>
            <p>
              {inv.runs.rows} runs, {inv.runs.columns.length} columns.
            </p>
            <p className="ev-links">
              <a className="pill" href={urls.csv} download>Download CSV</a>
              <a className="quiet" href={urls.json} download>Download JSON</a>
            </p>
            <RunPreview key={inv.id} path={inv.runs.path} />
          </>
        ) : (
          <p className="ev-muted">No run table on record</p>
        )}
      </Block>
    </div>
  );
}

export default function Evidence() {
  const id = useStore((s) => s.selectedInvestigationId);
  const habitatId = useStore((s) => s.habitat);
  const setId = useStore((s) => s.setSelectedInvestigationId);
  const invD = useDataset("investigations");
  const rankD = useDataset("rank");
  const claimsD = useDataset("claims");
  const srcD = useDataset("sources");
  const habD = useDataset("habitats");
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Open/close the native dialog to follow the store. Native close() returns focus to the opener.
  // A layout effect, so the dialog is open inside the same commit a view transition captures.
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id !== null && !d.open) d.showModal();
    if (id === null && d.open) d.close();
  }, [id]);
  // Switching to a related experiment: scroll back to the top, and move focus to the new title
  // (the Related button that had focus is gone, which would drop focus to the page body).
  const prevId = useRef<string | null>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    if (isSwitch(prevId.current, id)) document.getElementById("ev-title")?.focus();
    prevId.current = id;
  }, [id]);

  const ready = invD.status === "ready" && rankD.status === "ready" && claimsD.status === "ready" && srcD.status === "ready" && habD.status === "ready";
  const inv = ready && id ? invD.data.find((i) => i.id === id) : undefined;
  const sources: SourceMap = new Map(srcD.status === "ready" ? srcD.data.map((s) => [s.id, s]) : []);
  const failed = [invD, rankD, claimsD, srcD, habD].some((d) => d.status === "error");

  return (
    <dialog
      ref={ref}
      className="ev-dialog"
      aria-labelledby={inv ? "ev-title" : undefined}
      aria-label={inv ? undefined : "Experiment detail"}
      onClose={() => setId(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {id !== null && (
        <div className="ev-panel">
          <div className="ev-bar">
            <button type="button" className="quiet ev-close" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
          <div className="ev-scroller" ref={bodyRef}>
            {failed ? (
              <p className="ev-pad">Could not load this experiment. Reload the page and try again.</p>
            ) : !ready ? (
              <p className="ev-pad ev-muted">Loading…</p>
            ) : !inv ? (
              <p className="ev-pad">This experiment is not on record.</p>
            ) : (
              <Detail
                inv={inv}
                all={invD.status === "ready" ? invD.data : []}
                claims={claimsD.status === "ready" ? claimsD.data : []}
                rank={rankD.status === "ready" ? rankD.data : []}
                sources={sources}
                habitat={habD.status === "ready" ? habD.data.find((h) => h.id === habitatId) : undefined}
                habitatId={habitatId}
                open={setId}
              />
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
