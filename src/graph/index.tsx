import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";
import { coverage } from "../gaps/logic.ts";
import { revealInList } from "../ranking/scroll.ts";
import {
  find,
  focusIn,
  KIND_LABEL,
  linkGroups,
  LINKS,
  LIST_KINDS,
  neighbours,
  PAGE_LABEL,
  parseGraph,
  radius,
  shortTitle,
  timeline,
  visibleEdges,
  visibleNodes,
  type GNode,
  type GraphDoc,
  type Tone,
} from "./logic.ts";
import { createSim, drift, placeLabels, reheat, step, type Sim } from "./sim.ts";
import "./graph.css";

/** The research graph: experiments, NASA reports and pages, linked by why they belong together (like a notes graph). */
export default function Graph() {
  const [doc, setDoc] = useState<GraphDoc | null | "error">(null);
  useEffect(() => {
    let live = true;
    fetch("/data/graph.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setDoc(parseGraph(j) ?? "error"))
      .catch(() => live && setDoc("error"));
    return () => {
      live = false;
    };
  }, []);
  const graphFocus = useStore((s) => s.graphFocus);
  const habitatId = useStore((s) => s.habitat);
  const habitats = useDataset("habitats");
  const investigations = useDataset("investigations");
  const h = habitats.status === "ready" ? habitats.data.find((x) => x.id === habitatId) : undefined;
  const habitat = useMemo(() => {
    if (!h || investigations.status !== "ready") return undefined;
    const c = coverage(h, investigations.data);
    const tones = new Map<string, Tone>(investigations.data.map((i) => [i.id, "none"]));
    for (const i of c.o2Only) tones.set(i.id, "o2");
    for (const i of c.both) tones.set(i.id, "both");
    return { label: h.label, o2: h.o2Percent, kPa: h.pressureKPa, tones, both: c.both.length, o2Only: c.o2Only.length };
  }, [h, investigations]);
  return (
    <GraphView
      doc={doc}
      focus={graphFocus ?? null}
      habitat={habitat}
      onClearFocus={() => useStore.getState().setGraphFocus?.([])}
      onOpen={(id) => useStore.getState().setSelectedInvestigationId(id)}
      onAsk={(q) => useStore.getState().requestAsk?.(q)}
    />
  );
}

/** The habitat at the top of the page, as the graph uses it: how each experiment's tested air relates to it. */
export type GraphHabitat = { label: string; o2: number; kPa: number; tones: Map<string, Tone>; both: number; o2Only: number };
type Mode = "map" | "timeline" | "list";
const MODES: { id: Mode; label: string }[] = [
  { id: "map", label: "Network" },
  { id: "timeline", label: "Timeline" },
  { id: "list", label: "List" },
];
const TONE_TEXT: Record<Tone, string> = { both: "tested this oxygen and pressure", o2: "tested this oxygen only", none: "not tested in this air" };

const SIZE = 1040;
const START_ON = Object.fromEntries(Object.entries(LINKS).map(([k, v]) => [k, v.on]));

export function GraphView({
  doc,
  onOpen,
  onAsk,
  initialSelected = null,
  initialMode = "map",
  focus: askFocus = null,
  habitat,
  onClearFocus,
}: {
  doc: GraphDoc | null | "error";
  onOpen?: (id: string) => void;
  onAsk?: (q: string) => void;
  initialSelected?: string | null;
  initialMode?: Mode;
  focus?: { ids: string[]; n: number } | null;
  habitat?: GraphHabitat;
  onClearFocus?: () => void;
}) {
  const [on, setOn] = useState<Record<string, boolean>>(START_ON);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fadeOn, setFadeOn] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [, setFrame] = useState(0);
  const [query, setQuery] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "pan" | "node"; id?: string; sx: number; sy: number; moved: boolean } | null>(null);
  const held = useRef<{ id: string; x: number; y: number } | null>(null);
  const clock = useRef(0);

  const ready = doc && doc !== "error" ? doc : null;
  const still = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const makeSim = (d: GraphDoc) =>
    createSim(
      d.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, r: radius(n) })),
      d.edges,
      !still && typeof window !== "undefined",
    );
  const simRef = useRef<Sim | null>(null);
  if (ready && !simRef.current) simRef.current = makeSim(ready);
  const edges = useMemo(() => (ready ? visibleEdges(ready, on) : []), [ready, on]);
  const nodes = useMemo(() => (ready ? visibleNodes(ready, on) : []), [ready, on]);
  const byId = useMemo(() => new Map((ready?.nodes ?? []).map((n) => [n.id, n])), [ready]);
  const focus = hover ?? selected;
  const ask = useMemo(() => (ready && askFocus ? focusIn(ready, askFocus.ids) : { lit: new Set<string>(), missing: 0 }), [ready, askFocus]);
  const askLit = ask.lit.size > 0;
  const toneOf = (n: GNode): Tone | undefined => (fadeOn && habitat && n.kind === "experiment" ? (habitat.tones.get(n.id) ?? "none") : undefined);
  const near = useMemo(() => (focus ? neighbours(edges, focus) : null), [edges, focus]);
  const sel = selected ? byId.get(selected) : undefined;
  const selLinks = useMemo(() => (selected ? neighbours(edges, selected) : new Map()), [edges, selected]);

  // Ctrl/Cmd + wheel zooms around the pointer; a plain wheel keeps scrolling the page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * SIZE - SIZE / 2;
      const py = ((e.clientY - r.top) / r.height) * SIZE - SIZE / 2;
      setView((v) => {
        const k = Math.min(6, Math.max(0.5, v.k * Math.exp(-e.deltaY * 0.002)));
        return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [ready, mode]);

  // A new "Show in the research graph" from Ask: frame the lit dots and drop any old selection.
  useEffect(() => {
    const sim = simRef.current;
    if (!askFocus || !sim || !ask.lit.size) return;
    const pts = [...ask.lit].map((id) => sim.bodies[sim.index.get(id)!]).filter(Boolean);
    const xs = pts.map((b) => b.x);
    const ys = pts.map((b) => b.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const hgt = Math.max(...ys) - Math.min(...ys);
    const k = Math.min(2.4, Math.max(0.8, (SIZE * 0.7) / Math.max(w, hgt, 160)));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    setSelected(null);
    setView({ k, x: -cx * k, y: -cy * k });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askFocus?.n, ready]);

  // Animation: runs only while the graph is on screen; with reduced motion, dots move only while dragged.
  useEffect(() => {
    const svg = svgRef.current;
    const sim = simRef.current;
    if (!svg || !sim) return;
    let raf = 0;
    let visible = false;
    const loop = (t: number) => {
      clock.current = t;
      const moving = step(sim, held.current ?? undefined);
      if (moving || !still) setFrame((f) => (f + 1) % 1_000_000);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(svg);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ready, still, mode]);

  if (!ready)
    return (
      <section className="graph" aria-labelledby="graph-h">
        <Header />
        <p className="muted">{doc === "error" ? "The research graph could not be loaded." : "Loading the research graph"}</p>
      </section>
    );

  const sim = simRef.current!;
  const pos = (n: GNode): [number, number] => {
    const b = sim.bodies[sim.index.get(n.id)!];
    if (still || held.current?.id === n.id) return [b.x, b.y];
    const [dx, dy] = drift(b, clock.current);
    return [b.x + dx, b.y + dy];
  };
  const toGraph = (clientX: number, clientY: number): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * SIZE - SIZE / 2;
    const sy = ((clientY - r.top) / r.height) * SIZE - SIZE / 2;
    return [(sx - view.x) / view.k, (sy - view.y) / view.k];
  };
  const scale = () => SIZE / (svgRef.current?.getBoundingClientRect().width || SIZE);
  const down = (e: RPointerEvent, id?: string) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: id ? "node" : "pan", id, sx: e.clientX, sy: e.clientY, moved: false };
    e.stopPropagation();
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) * scale();
    const dy = (e.clientY - d.sy) * scale();
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    d.sx = e.clientX;
    d.sy = e.clientY;
    if (d.kind === "pan") setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    else if (d.id) {
      const [x, y] = toGraph(e.clientX, e.clientY);
      held.current = { id: d.id, x, y };
      reheat(sim, 0.4);
      if (still) {
        step(sim, held.current);
        setFrame((f) => f + 1);
      }
    }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (held.current) {
      // a pulled dot stays where it was dropped: its home moves there, and its neighbours settle around it
      const b = sim.bodies[sim.index.get(held.current.id)!];
      b.ax = held.current.x;
      b.ay = held.current.y;
      held.current = null;
      reheat(sim, 0.5);
    }
    if (d && !d.moved) setSelected(d.kind === "node" && d.id !== selected ? (d.id ?? null) : null);
  };
  const zoom = (f: number) => setView((v) => ({ k: Math.min(6, Math.max(0.5, v.k * f)), x: v.x * f, y: v.y * f }));
  const goTo = (n: GNode) => {
    setSelected(n.id);
    const [x, y] = pos(n);
    setView((v) => ({ k: Math.max(v.k, 1.6), x: -x * Math.max(v.k, 1.6), y: -y * Math.max(v.k, 1.6) }));
  };
  const showLabel = (n: GNode) =>
    n.kind === "experiment" || n.kind === "area" || n.id === focus || !!near?.has(n.id) || ask.lit.has(n.id) || view.k >= 2.2;
  // Hover or a selection wins; otherwise an Ask answer's sources stay lit and the rest steps back.
  const dim = (id: string) => (focus ? id !== focus && !near?.has(id) : askLit && !ask.lit.has(id));
  const toneClass = (n: GNode) => {
    if (focus || askLit) return "";
    const t = toneOf(n);
    return t === "none" ? " g-fade" : t === "o2" ? " g-half" : "";
  };
  const font = 11 / view.k;
  const dots = nodes.map((n) => {
    const [x, y] = pos(n);
    return { id: n.id, x, y, r: radius(n) / Math.sqrt(view.k) };
  });
  const labels = placeLabels(
    nodes.flatMap((n, i) =>
      showLabel(n)
        ? [
            {
              ...dots[i],
              text: shortTitle(n, 28),
              force: n.id === focus,
              priority: near?.has(n.id) ? 60 : ask.lit.has(n.id) ? 50 : n.kind === "area" ? 40 : n.kind === "experiment" ? 10 + n.degree : 1,
            },
          ]
        : [],
    ),
    dots,
    font,
  );

  return (
    <section className="graph" aria-labelledby="graph-h">
      <Header />
      <div className="graph-modes" role="group" aria-label="How to show the graph">
        {MODES.map((m) => (
          <button key={m.id} type="button" className="quiet" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {askFocus && (
        <p className="graph-banner" role="status">
          {askLit
            ? `Lit: the ${ask.lit.size} ${ask.lit.size === 1 ? "source or experiment" : "sources and experiments"} your Ask answer used.`
            : "None of the sources your Ask answer used are in the graph."}
          {ask.missing > 0 && ` ${ask.missing} more ${ask.missing === 1 ? "is" : "are"} the team's own data, which has no dot.`}{" "}
          {onClearFocus && (
            <button type="button" className="quiet" onClick={onClearFocus}>
              Clear
            </button>
          )}
        </p>
      )}
      {habitat && (
        <label className="graph-habitat">
          <input type="checkbox" checked={fadeOn} onChange={() => setFadeOn((v) => !v)} />
          <span>
            Fade experiments not tested in <b>{habitat.label}</b> air ({habitat.o2}% oxygen, {habitat.kPa} kPa).{" "}
            <span className="muted">
              {habitat.both} tested this oxygen and pressure, {habitat.o2Only} this oxygen only. Change the habitat at the top of the page.
            </span>
          </span>
        </label>
      )}
      {mode === "map" && (
      <div className="graph-tools">
        <form
          className="graph-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const n = find(ready, query);
            if (n) goTo(n);
          }}
        >
          <label htmlFor="graph-q">Find</label>
          <input id="graph-q" list="graph-names" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="FLEX, smoke, Apollo…" />
          <datalist id="graph-names">
            {ready.nodes.map((n) => (
              <option key={n.id} value={n.kind === "experiment" ? n.title : shortTitle(n, 60)} />
            ))}
          </datalist>
          <button type="submit" className="quiet">
            Go
          </button>
        </form>
        <div className="graph-zoom" aria-label="Zoom">
          <button type="button" className="quiet" onClick={() => zoom(1.4)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="quiet" onClick={() => zoom(1 / 1.4)} aria-label="Zoom out">
            −
          </button>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setView({ k: 1, x: 0, y: 0 });
              simRef.current = makeSim(ready);
              setSelected(null);
            }}
          >
            Reset
          </button>
        </div>
      </div>
      )}
      {mode === "list" ? (
        <ListView doc={ready} edges={edges} on={on} byId={byId} lit={ask.lit} toneOf={toneOf} habitat={habitat} onOpen={onOpen} onAsk={onAsk} />
      ) : (
      <div className="graph-body">
        {mode === "timeline" ? (
          <TimelineView doc={ready} lit={ask.lit} toneOf={toneOf} selected={selected} onPick={(n) => setSelected(n.id === selected ? null : n.id)} />
        ) : (
        <div className="graph-canvas">
          <svg
            ref={svgRef}
            viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`Research graph: ${nodes.length} experiments, reports and pages joined by ${edges.length} links. Use Find to pick one.`}
            onPointerDown={(e) => down(e)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={() => setHover(null)}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {edges.map((e) => {
                const a = byId.get(e.s)!;
                const b = byId.get(e.t)!;
                const [x1, y1] = pos(a);
                const [x2, y2] = pos(b);
                const lit = focus ? e.s === focus || e.t === focus : askLit && ask.lit.has(e.s) && ask.lit.has(e.t);
                const off = (focus || askLit) && !lit;
                return <line key={`${e.s}|${e.t}|${e.type}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`g-edge g-${e.type}${lit ? " g-lit" : ""}${off ? " g-dim" : ""}`} strokeWidth={(lit ? 1.6 : 0.8) / view.k} />;
              })}
              {nodes.map((n, i) => {
                const { x, y, r } = dots[i];
                return (
                  <g
                    key={n.id}
                    className={`g-node g-${n.kind}${n.kind === "area" ? ` g-area-${n.id.split(":")[1]}` : ""}${n.restricted ? " g-restricted" : ""}${n.id === selected ? " g-sel" : ""}${ask.lit.has(n.id) ? " g-hit" : ""}${dim(n.id) ? " g-dim" : ""}${toneClass(n)}`}
                    transform={`translate(${x} ${y})`}
                    onPointerDown={(e) => down(e, n.id)}
                    onPointerEnter={() => setHover(n.id)}
                    onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                  >
                    <circle r={r} strokeWidth={1 / view.k} />
                  </g>
                );
              })}
              <g className="g-labels" aria-hidden="true">
                {labels.map((l) => (
                  <text key={l.id} x={l.x} y={l.y} fontSize={font} textAnchor={l.anchor} className={dim(l.id) ? "g-dim" : toneClass(byId.get(l.id)!).trim() || undefined}>
                    {l.text}
                  </text>
                ))}
              </g>
            </g>
          </svg>
          <p className="muted graph-small">
            Drag to move around, drag a dot to pull it and its neighbours, Ctrl + scroll (or the buttons) to zoom, click a dot for details. The List
            view has the same links for keyboards and screen readers.
          </p>
        </div>
        )}
        <aside className="graph-panel" aria-live="polite">
          {sel ? (
            <Details node={sel} links={selLinks} byId={byId} onPick={mode === "map" ? goTo : (n) => setSelected(n.id)} onOpen={onOpen} onAsk={onAsk} />
          ) : (
            <Legend on={on} setOn={setOn} counts={countTypes(ready)} />
          )}
        </aside>
      </div>
      )}
    </section>
  );
}

function Header() {
  return (
    <>
      <div className="sec-label">
        <p className="sec-word t-readout">Connections</p>
        <h2 id="graph-h" className="sec-h">
          Research graph
        </h2>
      </div>
      <p className="graph-intro">
        Every experiment, NASA report and NASA page in this dashboard, joined by research links. Each line says why it is there: a report
        about the experiment, a follow-up flight, a study of its data, or a shared incident.
      </p>
    </>
  );
}

const countTypes = (d: GraphDoc) => d.edges.reduce<Record<string, number>>((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {});

function Legend({ on, setOn, counts }: { on: Record<string, boolean>; setOn: (f: (o: Record<string, boolean>) => Record<string, boolean>) => void; counts: Record<string, number> }) {
  return (
    <div className="graph-legend">
      <h3 className="graph-h3">Dots</h3>
      <ul className="graph-kinds">
        <li>
          <span className="g-key g-key-experiment" /> PSI experiment
        </li>
        <li>
          <span className="g-key g-key-report" /> NASA technical report
        </li>
        <li>
          <span className="g-key g-key-restricted" /> Report allowing short quotes only
        </li>
        <li>
          <span className="g-key g-key-page" /> NASA page (overview, incident review, Spinoff)
        </li>
      </ul>
      <h3 className="graph-h3">Links</h3>
      <ul className="graph-types">
        {Object.entries(LINKS).map(([k, v]) => (
          <li key={k}>
            <label>
              <input type="checkbox" checked={!!on[k]} onChange={() => setOn((o) => ({ ...o, [k]: !o[k] }))} />
              <span className={`g-swatch g-${k}`} aria-hidden="true" /> {v.label} <span className="muted">({counts[k] ?? 0})</span>
            </label>
            <span className="muted graph-small">{v.text}</span>
          </li>
        ))}
      </ul>
      <p className="muted graph-small">Click a dot to see its links and why each exists.</p>
    </div>
  );
}

function Details({
  node,
  links,
  byId,
  onPick,
  onOpen,
  onAsk,
}: {
  node: GNode;
  links: Map<string, { type: string; why: string }[]>;
  byId: Map<string, GNode>;
  onPick: (n: GNode) => void;
  onOpen?: (id: string) => void;
  onAsk?: (q: string) => void;
}) {
  const kind = node.kind === "page" && node.page ? PAGE_LABEL[node.page] ?? KIND_LABEL.page : KIND_LABEL[node.kind];
  const groups = new Map<string, { n: GNode; why: string }[]>();
  for (const [id, es] of links)
    for (const e of es) {
      const n = byId.get(id);
      if (n) groups.set(e.type, [...(groups.get(e.type) ?? []), { n, why: e.why }]);
    }
  return (
    <div className="graph-details">
      <p className="graph-kind">
        {kind}
        {node.restricted && <span className="graph-badge">Short quotes only</span>}
      </p>
      <h3 className="graph-h3">{node.title}</h3>
      {node.kind === "experiment" && (
        <p className="muted graph-small">
          {node.area} · {node.hardware}
        </p>
      )}
      <div className="graph-actions">
        {node.kind === "experiment" && onOpen && (
          <button type="button" className="quiet" onClick={() => onOpen(node.id)}>
            Open experiment details
          </button>
        )}
        {node.kind === "experiment" && onAsk && (
          <button type="button" className="quiet" onClick={() => onAsk(`What did ${node.title} find?`)}>
            Ask what it found
          </button>
        )}
        {node.url && (
          <a href={node.url} target="_blank" rel="noreferrer">
            Open the source
          </a>
        )}
      </div>
      {groups.size === 0 ? (
        <p className="muted graph-small">No links with the link types shown.</p>
      ) : (
        Object.keys(LINKS)
          .filter((t) => groups.has(t))
          .map((t) => (
            <div key={t} className="graph-group">
              <h4 className="graph-h4">
                <span className={`g-swatch g-${t}`} aria-hidden="true" /> {LINKS[t].label} ({groups.get(t)!.length})
              </h4>
              <ul>
                {groups.get(t)!.map(({ n, why }) => (
                  <li key={n.id}>
                    <button type="button" className="graph-link" onClick={() => onPick(n)} title={why}>
                      {shortTitle(n, 60)}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="muted graph-small">{LINKS[t].text} Hover a name to see why that one is linked.</p>
            </div>
          ))
      )}
    </div>
  );
}

/** Reports by year: one row per experiment, a dot per dated report about it. Restricted reports keep their dashed ring. */
function TimelineView({
  doc,
  lit,
  toneOf,
  selected,
  onPick,
}: {
  doc: GraphDoc;
  lit: Set<string>;
  toneOf: (n: GNode) => Tone | undefined;
  selected: string | null;
  onPick: (n: GNode) => void;
}) {
  const t = useMemo(() => timeline(doc), [doc]);
  const W = 760;
  const L = 150;
  const R = 24;
  const ROW = 26;
  const TOP = 30;
  const H = TOP + t.rows.length * ROW + 10;
  const from = t.from - 1;
  const to = t.to + 1;
  const x = (y: number) => L + ((y - from) / (to - from)) * (W - L - R);
  const ticks: number[] = [];
  for (let y = Math.ceil(from / 5) * 5; y <= to; y += 5) ticks.push(y);
  const askLit = lit.size > 0;
  const key = (n: GNode) => (e: RKeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(n);
    }
  };
  return (
    <div className="graph-canvas graph-timeline">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Timeline: ${t.rows.length} experiments and the dated NASA reports about them, ${t.from} to ${t.to}. The List view has the same reports.`}>
        {ticks.map((y) => (
          <g key={y}>
            <line className="gt-grid" x1={x(y)} x2={x(y)} y1={TOP - 8} y2={H - 6} />
            <text className="gt-year" x={x(y)} y={TOP - 14} textAnchor="middle">
              {y}
            </text>
          </g>
        ))}
        {t.rows.map((row, i) => {
          const cy = TOP + i * ROW + ROW / 2;
          const tone = toneOf(row.node);
          const rowDim = askLit ? !lit.has(row.node.id) && !row.reports.some((r) => lit.has(r.id)) : tone === "none";
          const seen = new Map<number, number>();
          return (
            <g key={row.node.id} className={`gt-row${rowDim ? " g-fade" : tone === "o2" && !askLit ? " g-half" : ""}`}>
              <line className="gt-lane" x1={L} x2={W - R} y1={cy} y2={cy} />
              <text
                className={`gt-label${lit.has(row.node.id) ? " gt-hit" : ""}${selected === row.node.id ? " gt-sel" : ""}`}
                x={L - 10}
                y={cy + 4}
                textAnchor="end"
                tabIndex={0}
                role="button"
                aria-label={`${row.node.title}: ${row.reports.length} dated ${row.reports.length === 1 ? "report" : "reports"}`}
                onClick={() => onPick(row.node)}
                onKeyDown={key(row.node)}
              >
                {shortTitle(row.node, 24)}
              </text>
              {row.reports.map((r) => {
                const k = seen.get(r.year!) ?? 0;
                seen.set(r.year!, k + 1);
                const cx = x(r.year!) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 9;
                return (
                  <g
                    key={r.id}
                    className={`g-node g-report${r.restricted ? " g-restricted" : ""}${r.id === selected ? " g-sel" : ""}${lit.has(r.id) ? " g-hit" : ""}${askLit && !lit.has(r.id) ? " g-dim" : ""}`}
                    transform={`translate(${cx} ${cy})`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${r.title} (${r.year})`}
                    onClick={() => onPick(r)}
                    onKeyDown={key(r)}
                  >
                    <title>{`${r.title} (${r.year})`}</title>
                    <circle r={5.5} strokeWidth={1} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <p className="muted graph-small">
        Each dot is a NASA report about that experiment, placed at the year its record gives. Click one for its links.{" "}
        {t.noReports.length > 0 && `${t.noReports.length} experiments have no dated report in the library. `}
        {t.undated.length > 0 && `${t.undated.length} ${t.undated.length === 1 ? "report has" : "reports have"} no year on record and ${t.undated.length === 1 ? "is" : "are"} left off.`}
      </p>
    </div>
  );
}

/** The whole graph as headings and lists: the keyboard and screen-reader way in, with the same links and reasons. */
function ListView({
  doc,
  edges,
  on,
  byId,
  lit,
  toneOf,
  habitat,
  onOpen,
  onAsk,
}: {
  doc: GraphDoc;
  edges: ReturnType<typeof visibleEdges>;
  on: Record<string, boolean>;
  byId: Map<string, GNode>;
  lit: Set<string>;
  toneOf: (n: GNode) => Tone | undefined;
  habitat?: GraphHabitat;
  onOpen?: (id: string) => void;
  onAsk?: (q: string) => void;
}) {
  const jump = (id: string) => {
    const d = document.getElementById(`gl-${id}`) as HTMLDetailsElement | null;
    if (!d) return;
    d.open = true;
    d.querySelector("summary")?.focus({ preventScroll: true });
    revealInList(d, !matchMedia("(prefers-reduced-motion: reduce)").matches); // only the sheet's own list scrolls
  };
  const nodes = visibleNodes(doc, on);
  return (
    <div className="graph-list">
      <p className="muted graph-small">
        Every dot in the graph, with its links and why each exists. Open an item to see its links; pick a linked name to go to it.
        {lit.size > 0 && " Items your Ask answer used are listed first."}
      </p>
      {LIST_KINDS.map(({ kind, label }) => {
        const list = nodes
          .filter((n) => n.kind === kind)
          .sort((a, b) => Number(lit.has(b.id)) - Number(lit.has(a.id)) || a.title.localeCompare(b.title));
        if (!list.length) return null;
        return (
          <section key={kind} aria-label={label}>
            <h3 className="graph-h3">
              {label} ({list.length})
            </h3>
            <ul className="graph-list-items">
              {list.map((n) => {
                const tone = toneOf(n);
                const groups = linkGroups(edges, byId, n.id);
                return (
                  <li key={n.id} className={lit.has(n.id) ? "gl-hit" : undefined}>
                    <details id={`gl-${n.id}`}>
                      <summary>
                        {n.title}
                        {n.year !== undefined && <span className="muted"> ({n.year})</span>}
                        {n.restricted && <span className="muted"> · short quotes only</span>}
                        {lit.has(n.id) && <span className="graph-badge">Used in your answer</span>}
                        {tone && habitat && <span className="muted"> · {TONE_TEXT[tone]}</span>}
                        <span className="muted"> · {groups.reduce((a, g) => a + g.items.length, 0)} links shown</span>
                      </summary>
                      <div className="graph-actions">
                        {n.kind === "experiment" && onOpen && (
                          <button type="button" className="quiet" onClick={() => onOpen(n.id)}>
                            Open experiment details
                          </button>
                        )}
                        {n.kind === "experiment" && onAsk && (
                          <button type="button" className="quiet" onClick={() => onAsk(`What did ${n.title} find?`)}>
                            Ask what it found
                          </button>
                        )}
                        {n.url && (
                          <a href={n.url} target="_blank" rel="noreferrer">
                            Open the source
                          </a>
                        )}
                      </div>
                      {groups.map((g) => (
                        <div key={g.type} className="graph-group">
                          <h4 className="graph-h4">
                            {LINKS[g.type].label} ({g.items.length})
                          </h4>
                          <ul>
                            {g.items.map(({ n: m, why }) => (
                              <li key={m.id}>
                                <button type="button" className="graph-link" onClick={() => jump(m.id)}>
                                  {shortTitle(m, 70)}
                                </button>{" "}
                                <span className="muted graph-small">{why}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
