import { useEffect, useState } from "react";
import type { WhatIfDoc } from "../whatif/logic.ts";
import { loadWhatIf } from "../whatif/load.ts";
import { evalLines, KINDS, parseEval, type AskEval } from "./logic.ts";
import "./trust.css";

/** "How we know": measured accuracy of every part of the page, what each kind of number is, and what is not covered. */
export default function Trust() {
  const [ev, setEv] = useState<AskEval | null | "none">(null);
  const [doc, setDoc] = useState<WhatIfDoc | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/data/ask-eval.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setEv(parseEval(j) ?? "none"))
      .catch(() => live && setEv("none"));
    void loadWhatIf().then((d) => live && setDoc(d));
    return () => {
      live = false;
    };
  }, []);
  return <TrustView ev={ev} doc={doc} />;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function TrustView({ ev, doc }: { ev: AskEval | null | "none"; doc: WhatIfDoc | null }) {
  const m = doc?.models;
  const t = doc?.theory;
  const agreeAll = t ? Object.values(t.direction_agreement).every((v) => v === 1) : false;
  return (
    <section className="trust" aria-labelledby="trust-h">
      <div className="sec-label">
        <p className="sec-word t-readout">Checked</p>
        <h2 id="trust-h" className="sec-h">
          How we know
        </h2>
      </div>
      <p className="trust-intro">Every part of this page was tested, and every number says what kind of number it is.</p>

      <div className="trust-grid">
        <article className="trust-card">
          <h3 className="trust-h3">Ask the records, measured</h3>
          {ev === null && <p className="muted">Loading the scores</p>}
          {ev === "none" && <p className="muted">Not measured on this copy of the site yet.</p>}
          {ev && ev !== "none" && (
            <>
              <ul className="trust-scores">
                {evalLines(ev).map((l) => (
                  <li key={l.text}>
                    <span className="trust-big t-display">{l.big}</span> <span>{l.text}</span>
                  </li>
                ))}
              </ul>
              <p className="muted trust-small">
                {ev.questions} questions labelled by the team before the test, asked fresh, one at a time, with the same code and library as this site, on {ev.date.slice(0, 10)}. Median
                answer time {(ev.latency_ms.median / 1000).toFixed(1)} s.
              </p>
            </>
          )}
        </article>

        <article className="trust-card">
          <h3 className="trust-h3">Team models, tested on days they never saw</h3>
          {m ? (
            <ul className="trust-list">
              <li>
                Flame-out size: error {m.ext_diameter.rmse_mm.toFixed(2)} mm; its range covered {pct(m.ext_diameter.band_coverage)} of real runs on
                held-out test days.
              </li>
              <li>Chance of break-up: AUC {m.disruption.auc.toFixed(2)} (0.5 is guessing, 1 is perfect), and its average matches the real rate.</li>
              <li>
                Burning rate: error {m.burning_rate.rmse} {m.burning_rate.unit.replace("mm2/s", "mm²/s")}.
              </li>
              {m.d2law && (
                <li>
                  The burn animation's d²-law matched measured burn times with correlation {m.d2law.corr} on {m.d2law.runs} runs.
                </li>
              )}
            </ul>
          ) : (
            <p className="muted">Loading the model scores</p>
          )}
          {doc && (
            <p className="muted trust-small">
              {doc.tested.runs} FLEX droplet runs over {doc.tested.test_dates} test dates; whole days are held out, so runs from the same day
              never sit in both training and testing.
            </p>
          )}
        </article>

        {t && (
          <article className="trust-card">
            <h3 className="trust-h3">Physics cross-check</h3>
            <ul className="trust-list">
              {agreeAll && <li>On every FLEX run, the burning-rate model moves the same way as textbook theory for oxygen, helium and CO₂.</li>}
              <li>
                Adding the theory did not make the model more accurate (error {t.rmse.ridge_plus_theory} vs {t.rmse.ridge} mm²/s), so theory stays
                a cross-check, not an input.
              </li>
              <li>
                Real FLEX droplets burned at about {Object.entries(t.measured_over_theory)
                  .map(([f, v]) => `${pct(v)} (${f})`)
                  .join(" and ")}{" "}
                of the textbook rate.
              </li>
            </ul>
          </article>
        )}

        <article className="trust-card">
          <h3 className="trust-h3">What each kind of number is</h3>
          <dl className="trust-kinds">
            {KINDS.map((k) => (
              <div key={k.name}>
                <dt>{k.name}</dt>
                <dd>{k.text}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="trust-card">
          <h3 className="trust-h3">Not covered</h3>
          <ul className="trust-list">
            <li>
              No experiment here ran in Moon or Mars gravity; gravity effects are a labelled theory estimate only. ACME&apos;s E-FIELD Flames
              imitated partial gravity on the ISS with an electric field, which is the closest stand-in on record.
            </li>
            <li>No Mars-base atmosphere is on record, so Mars appears only in the gravity estimate.</li>
            <li>The team models cover FLEX fuel droplets (methanol, heptane), not solid materials or other fuels.</li>
            <li>Some NASA reports allow short quotes only: the page shows at most 15 words from them and links the full report.</li>
            <li>The Ask box answers from the library it has; a question outside it is refused, not guessed.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
