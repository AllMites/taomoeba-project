import { useEffect, useState } from "react";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import { counts, parseEarth, STATUS, STATUS_ORDER, type EarthDoc } from "./logic.ts";
import "./earth.css";

/**
 * "On Earth": what NASA fire research gives people on the ground, with how far each benefit has come and its sources.
 * A compact glass card: it takes the place of the top 3 over the replay when the Earth base is picked.
 */
export default function Earth() {
  const [doc, setDoc] = useState<EarthDoc | null | "error">(null);
  const investigations = useDataset("investigations");
  useEffect(() => {
    let live = true;
    fetch("/data/earth.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setDoc(parseEarth(j) ?? "error"))
      .catch(() => live && setDoc("error"));
    return () => {
      live = false;
    };
  }, []);
  const titles = investigations.status === "ready" ? Object.fromEntries(investigations.data.map((i) => [i.id, i.title])) : {};
  return (
    <EarthView
      doc={doc}
      titleOf={(id) => titles[id] ?? id}
      onOpen={(id) => useStore.getState().setSelectedInvestigationId(id)}
      onAsk={(q) => useStore.getState().requestAsk?.(q)}
    />
  );
}

/** Long study titles become their PSI id on the button (the full title shows on hover and in the drawer). */
const short = (title: string, id: string) => (title.length <= 28 ? title : `${id} (study)`);

export function EarthView(p: {
  doc: EarthDoc | null | "error";
  titleOf: (id: string) => string;
  onOpen?: (id: string) => void;
  onAsk?: (q: string) => void;
}) {
  const { doc } = p;
  return (
    <section className="earth glass" aria-labelledby="earth-h">
      <h2 id="earth-h" className="earth-h t-readout">
        On Earth
      </h2>
      <p className="earth-intro">Fire research in orbit also protects people on the ground. Each item links its NASA source.</p>
      {doc === null && <p className="muted">Loading</p>}
      {doc === "error" && <p className="muted">The Earth benefits could not be loaded.</p>}
      {doc && doc !== "error" && (
        <>
          <details className="earth-key">
            <summary>What the labels mean</summary>
            <ul className="earth-legend">
              {STATUS_ORDER.map((s) => (
                <li key={s}>
                  <span className={`earth-badge earth-${s}`}>{STATUS[s].label}</span> <span className="muted">{STATUS[s].text}</span>{" "}
                  <span className="muted">({counts(doc)[s]})</span>
                </li>
              ))}
            </ul>
          </details>
          <ul className="earth-cards">
            {[...doc.items]
              .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
              .map((it) => (
                <li key={it.id} className="earth-card">
                  <span className={`earth-badge earth-${it.status}`}>{STATUS[it.status].label}</span>
                  <h3 className="earth-h3">{it.title}</h3>
                  <p className="earth-text">{it.summary}</p>
                  {it.note && <p className="muted earth-small">{it.note}</p>}
                  {it.experiments.length > 0 && (
                    <div className="earth-exps">
                      <span className="muted earth-small">From these experiments:</span>
                      <ul>
                        {it.experiments.map((id) => (
                          <li key={id}>
                            {p.onOpen ? (
                              <button type="button" className="earth-exp" title={p.titleOf(id)} onClick={() => p.onOpen!(id)}>
                                {short(p.titleOf(id), id)}
                              </button>
                            ) : (
                              p.titleOf(id)
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ul className="earth-sources" aria-label={`Sources for ${it.title}`}>
                    {it.sources.map((s) => (
                      <li key={s.id + s.url}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {it.ask && p.onAsk && (
                    <button type="button" className="quiet earth-ask" onClick={() => p.onAsk!(it.ask!)}>
                      Ask: {it.ask}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
