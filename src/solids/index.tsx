import { useEffect, useState } from "react";
import { useStore } from "../app/store.ts";
import type { HabitatPreset } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import { downloadText } from "../whatif/csv.ts";
import {
  BOX,
  habitatGap,
  LEVEL,
  OUTCOME,
  OUTCOME_ORDER,
  parseSolids,
  saffireSummary,
  testsCsv,
  X,
  xPx,
  yPx,
  yRange,
  type FabricTest,
  type Outcome,
  type SolidsDoc,
} from "./logic.ts";
import "./solids.css";

/** "Solid materials": where real fabric flames lived or died in orbit, and the same samples in space vs on Earth. */
export default function Solids() {
  const [doc, setDoc] = useState<SolidsDoc | null | "error">(null);
  const habitatId = useStore((s) => s.habitat);
  const habitats = useDataset("habitats");
  useEffect(() => {
    let live = true;
    fetch("/data/solids.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setDoc(parseSolids(j) ?? "error"))
      .catch(() => live && setDoc("error"));
    return () => {
      live = false;
    };
  }, []);
  const h =
    habitats.status === "ready"
      ? habitats.data.find((x) => x.id === habitatId)
      : undefined;
  return (
    <SolidsView
      doc={doc}
      habitat={h}
      onOpen={(id) => useStore.getState().setSelectedInvestigationId(id)}
      onAsk={(q) => useStore.getState().requestAsk?.(q)}
    />
  );
}

export const SOLIDS_ASK = [
  "What oxygen levels have fabrics been burned at in microgravity?",
  "Why did silicone burn on Earth but not in space in SAFFIRE-II?",
];

type Hab = Pick<HabitatPreset, "label" | "o2Percent">;

export function SolidsView(p: {
  doc: SolidsDoc | null | "error";
  habitat?: Hab;
  onOpen?: (id: string) => void;
  onAsk?: (q: string) => void;
}) {
  const { doc } = p;
  return (
    <section className="solids" aria-labelledby="solids-h">
      <div className="sec-label">
        <p className="sec-word t-readout">What actually burns in a cabin</p>
        <h2 id="solids-h" className="sec-h">
          Solid materials in microgravity
        </h2>
      </div>
      <p className="solids-intro">
        Fabrics, plastics and silicone are what would burn in a real cabin.
        These are two NASA test tables, drawn as recorded: nothing here is a
        model or a guess.
      </p>
      {doc === null && <p className="muted">Loading</p>}
      {doc === "error" && (
        <p className="muted">The solid-material tables could not be loaded.</p>
      )}
      {doc && doc !== "error" && (
        <>
          <FlammabilityMap doc={doc} habitat={p.habitat} onOpen={p.onOpen} />
          <SpaceVsEarth doc={doc} onOpen={p.onOpen} />
          {p.onAsk && (
            <div className="solids-ask">
              {SOLIDS_ASK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="quiet"
                  onClick={() => p.onAsk!(q)}
                >
                  Ask: {q}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Marker per outcome: shape carries the meaning, so no colour is needed. Narrow 1.2 cm strips are drawn smaller. */
function Mark({
  o,
  x,
  y,
  small,
}: {
  o: Outcome;
  x: number;
  y: number;
  small?: boolean;
}) {
  const r = small ? 4 : 6;
  switch (o) {
    case "burned":
      return <circle className="sm-fill" cx={x} cy={y} r={r} />;
    case "quenched":
      return (
        <path
          className="sm-open"
          d={`M${x - r},${y - r * 0.8}L${x + r},${y - r * 0.8}L${x},${y + r}Z`}
        />
      );
    case "no-blowoff":
      return (
        <rect
          className="sm-open"
          x={x - r}
          y={y - r}
          width={r * 2}
          height={r * 2}
        />
      );
    case "blowoff":
      return (
        <rect
          className="sm-fill"
          x={x - r}
          y={y - r}
          width={r * 2}
          height={r * 2}
        />
      );
    case "no-ignition":
      return (
        <path
          className="sm-cross"
          d={`M${x - r},${y - r}L${x + r},${y + r}M${x + r},${y - r}L${x - r},${y + r}`}
        />
      );
  }
}

const flowText = (t: FabricTest) =>
  t.flowFrom === t.flowTo
    ? `${t.flowTo} cm/s`
    : `${t.flowFrom} to ${t.flowTo} cm/s`;

function FlammabilityMap({
  doc,
  habitat,
  onOpen,
}: {
  doc: SolidsDoc;
  habitat?: Hab;
  onOpen?: (id: string) => void;
}) {
  const f = doc.flammability;
  const hO2 = habitat?.o2Percent ?? 21;
  const y = yRange(doc, hO2);
  const gap = habitatGap(doc, hO2);
  const iss = 21;
  const plotR = BOX.w - BOX.r;
  const yTicks = Array.from(
    { length: Math.floor((y.max - y.min) / 2) + 1 },
    (_, i) => y.min + i * 2,
  );
  return (
    <article className="solids-card">
      <h3 className="solids-h3">Where fabric flames lived or died</h3>
      <p className="muted solids-small">
        {f.tests.length} tests of {f.material}, {f.flow.toLowerCase()}. Each
        line runs from the airflow the test started at to where it ended; the
        mark shows what happened.
      </p>
      {habitat &&
        (gap ? (
          <p className="solids-callout">
            <b>{habitat.label}</b> air is {hO2}% oxygen: {gap} points above the
            highest fabric test ({f.maxO2}%). Nobody has measured where these
            fabric flames live or die in that air.
          </p>
        ) : (
          <p className="solids-callout">
            <b>{habitat.label}</b> air ({hO2}% oxygen) is inside the tested
            range, which runs from {Math.min(...f.tests.map((t) => t.o2))}% to{" "}
            {f.maxO2}%.
          </p>
        ))}
      <ul className="solids-legend" aria-label="What the marks mean">
        {OUTCOME_ORDER.map((o) => (
          <li key={o}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <Mark o={o} x={8} y={8} />
            </svg>
            {OUTCOME[o].label}{" "}
            <span className="muted">({f.counts[o] ?? 0})</span>
          </li>
        ))}
        <li>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle className="sm-fill" cx="8" cy="8" r="4" />
          </svg>
          Smaller mark: 1.2 cm-wide strip
        </li>
      </ul>
      <div className="solids-chart">
        <svg
          className="solids-svg"
          viewBox={`0 0 ${BOX.w} ${BOX.h}`}
          role="img"
          aria-label={`Oxygen against airflow for ${f.tests.length} fabric tests in microgravity. Tests ran from ${Math.min(...f.tests.map((t) => t.o2))}% to ${f.maxO2}% oxygen.${gap ? ` ${habitat!.label} air at ${hO2}% is above every test.` : ""} The table below the chart lists every test.`}
        >
          {gap && !y.offChart && (
            <g>
              <defs>
                <pattern
                  id="sm-hatch"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="8" className="sm-hatch" />
                </pattern>
              </defs>
              <rect
                x={BOX.l}
                y={yPx(hO2, y)}
                width={plotR - BOX.l}
                height={yPx(f.maxO2, y) - yPx(hO2, y)}
                fill="url(#sm-hatch)"
              />
              <text
                className="sm-gap"
                x={(BOX.l + plotR) / 2}
                y={(yPx(hO2, y) + yPx(f.maxO2, y)) / 2 + 4}
                textAnchor="middle"
              >
                No fabric test between {f.maxO2}% and {hO2}% oxygen
              </text>
            </g>
          )}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                className="sm-grid"
                x1={BOX.l}
                x2={plotR}
                y1={yPx(t, y)}
                y2={yPx(t, y)}
              />
              <text
                className="sm-tick"
                x={BOX.l - 8}
                y={yPx(t, y) + 4}
                textAnchor="end"
              >
                {t}
              </text>
            </g>
          ))}
          {X.ticks.map((t) => (
            <text
              key={t}
              className="sm-tick"
              x={xPx(t)}
              y={BOX.h - BOX.b + 18}
              textAnchor="middle"
            >
              {t}
            </text>
          ))}
          <line
            className="sm-axis"
            x1={BOX.l}
            x2={plotR}
            y1={BOX.h - BOX.b}
            y2={BOX.h - BOX.b}
          />
          <text
            className="sm-title"
            x={(BOX.l + plotR) / 2}
            y={BOX.h - 6}
            textAnchor="middle"
          >
            Airflow past the sample, cm/s (log scale)
          </text>
          <text
            className="sm-title"
            transform={`translate(14 ${(BOX.t + BOX.h - BOX.b) / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            Oxygen, %
          </text>
          <HabLine v={iss} y={y} label="ISS air 21%" plotR={plotR} />
          {habitat && !y.offChart && hO2 !== iss && (
            <HabLine
              v={hO2}
              y={y}
              label={`${habitat.label} air ${hO2}%`}
              plotR={plotR}
              strong
            />
          )}
          {f.tests.map((t) => (
            <g key={t.test} className="sm-test">
              <title>
                {`${t.test} (${t.series}), ${t.widthCm} cm wide, ${flowText(t)}, ${t.o2}% oxygen${t.o2Uncertain ? " (reading may be off)" : ""}: ${OUTCOME[t.outcome].text}`}
              </title>
              {t.flowFrom !== t.flowTo && (
                <line
                  className="sm-path"
                  x1={xPx(t.flowFrom)}
                  x2={xPx(t.flowTo)}
                  y1={yPx(t.o2, y)}
                  y2={yPx(t.o2, y)}
                />
              )}
              <Mark
                o={t.outcome}
                x={xPx(t.flowTo)}
                y={yPx(t.o2, y)}
                small={t.widthCm < 2}
              />
            </g>
          ))}
        </svg>
      </div>
      {y.offChart && habitat && (
        <p className="muted solids-small">
          {habitat.label} air ({hO2}% oxygen) is far above this chart: every
          fabric test was at {f.maxO2}% or less.
        </p>
      )}
      <ul className="solids-findings" aria-label="What the report found">
        {f.findings.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <details className="solids-details">
        <summary>Show every test ({f.tests.length})</summary>
        <div className="solids-scroll">
          <table className="solids-table">
            <caption className="muted">
              {f.source.where}. Left out: {f.excluded.length} reused samples.{" "}
              {f.excludedWhy}
            </caption>
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Width</th>
                <th scope="col">Airflow</th>
                <th scope="col">Oxygen</th>
                <th scope="col">What happened</th>
              </tr>
            </thead>
            <tbody>
              {f.tests.map((t) => (
                <tr key={t.test}>
                  <th scope="row">
                    {t.test} <span className="muted">{t.series}</span>
                  </th>
                  <td>{t.widthCm} cm</td>
                  <td>{flowText(t)}</td>
                  <td>
                    {t.o2}%{t.o2Uncertain ? " *" : ""}
                  </td>
                  <td>{OUTCOME[t.outcome].text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {f.tests.some((t) => t.o2Uncertain) && (
            <p className="muted solids-small">
              * The report notes this oxygen reading might be inaccurate.
            </p>
          )}
        </div>
        <button
          type="button"
          className="quiet"
          onClick={() => downloadText("bass-fabric-tests.csv", testsCsv(doc))}
        >
          Download the table (CSV)
        </button>
      </details>
      <p className="solids-src">
        Source:{" "}
        <a href={f.source.url} target="_blank" rel="noreferrer">
          {f.source.title}
        </a>{" "}
        <span className="muted">({f.source.where})</span>
        {onOpen && (
          <>
            {" "}
            <button
              type="button"
              className="solids-exp"
              onClick={() => onOpen("PSI-25")}
            >
              Open BASS-II
            </button>
          </>
        )}
      </p>
    </article>
  );
}

function HabLine({
  v,
  y,
  label,
  plotR,
  strong,
}: {
  v: number;
  y: { min: number; max: number };
  label: string;
  plotR: number;
  strong?: boolean;
}) {
  if (v < y.min || v > y.max) return null;
  return (
    <g>
      <line
        className={strong ? "sm-hab strong" : "sm-hab"}
        x1={BOX.l}
        x2={plotR}
        y1={yPx(v, y)}
        y2={yPx(v, y)}
      />
      <text
        className="sm-hab-label"
        x={plotR - 4}
        y={yPx(v, y) - 6}
        textAnchor="end"
      >
        {label}
      </text>
    </g>
  );
}

function SpaceVsEarth({
  doc,
  onOpen,
}: {
  doc: SolidsDoc;
  onOpen?: (id: string) => void;
}) {
  const s = doc.saffire;
  const sum = saffireSummary(doc);
  return (
    <article className="solids-card">
      <h3 className="solids-h3">Same material, space vs Earth</h3>
      <p className="muted solids-small">
        SAFFIRE-II burned {s.sampleLengthCm} cm samples in orbit at {s.o2[0]} to{" "}
        {s.o2[1]}% oxygen and {s.flowCmS.join(", ")} cm/s airflow. The same
        table gives the result for each sample type in normal (Earth) gravity.
      </p>
      <p className="solids-callout">
        In {sum.earthWorse} of {sum.total} comparable samples, more of the
        material burned on Earth than in orbit
        {sum.spaceWorse === 0
          ? "; none burned more in orbit"
          : `; ${sum.spaceWorse} burned more in orbit`}
        . On Earth, rising hot gas (buoyancy) keeps pulling fresh air into the
        flame; in orbit only the slow fan flow does.
      </p>
      <div className="solids-scroll">
        <table className="solids-table solids-vs">
          <thead>
            <tr>
              <th scope="col">Sample</th>
              <th scope="col">In orbit (microgravity)</th>
              <th scope="col">On Earth (1 g)</th>
            </tr>
          </thead>
          <tbody>
            {s.samples.map((x) => (
              <tr
                key={x.sample}
                className={x.comparable === false ? "solids-dim" : undefined}
              >
                <th scope="row">
                  {x.material}
                  <span className="muted solids-small">
                    {" "}
                    {x.thickness}, {x.flowDirection} flow, #{x.sample}
                  </span>
                  {x.note && (
                    <span className="muted solids-small solids-block">
                      {x.note}
                    </span>
                  )}
                </th>
                <td data-label="In orbit">
                  <span className={`solids-lvl lvl-${x.space.level}`}>
                    {LEVEL[x.space.level]}
                  </span>{" "}
                  {x.space.text}
                </td>
                <td data-label="On Earth">
                  <span className={`solids-lvl lvl-${x.earth.level}`}>
                    {LEVEL[x.earth.level]}
                  </span>{" "}
                  {x.earth.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted solids-small">
        Not shown: samples {s.skipped.join(" and ")}. {s.skippedWhy}
      </p>
      <p className="solids-src">
        Source:{" "}
        <a href={s.source.url} target="_blank" rel="noreferrer">
          {s.source.title}
        </a>
        {onOpen && (
          <>
            {" "}
            <button
              type="button"
              className="solids-exp"
              onClick={() => onOpen("PSI-99")}
            >
              Open SAFFIRE-II
            </button>
          </>
        )}
      </p>
    </article>
  );
}
