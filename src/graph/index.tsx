import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useStore } from "../app/store.ts";
import { find, KIND_LABEL, LINKS, neighbours, PAGE_LABEL, parseGraph, radius, shortTitle, visibleEdges, visibleNodes, type GNode, type GraphDoc } from "./logic.ts";
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
  return (
    <GraphView
      doc={doc}
      onOpen={(id) => useStore.getState().setSelectedInvestigationId(id)}
      onAsk={(q) => useStore.getState().requestAsk?.(q)}
    />
  );
}

const SIZE = 1040;
const START_ON = Object.fromEntries(Object.entries(LINKS).map(([k, v]) => [k, v.on]));

export function GraphView({ doc, onOpen, onAsk, initialSelected = null }: { doc: GraphDoc | null | "error"; onOpen?: (id: string) => void; onAsk?: (q: string) => void; initialSelected?: string | null }) {
  const [on, setOn] = useState<Record<string, boolean>>(START_ON);
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
  }, [ready]);

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
  }, [ready, still]);

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
  const showLabel = (n: GNode) => n.kind === "experiment" || n.kind === "area" || n.id === focus || !!near?.has(n.id) || view.k >= 2.2;
  const dim = (id: string) => !!focus && id !== focus && !near?.has(id);
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
              priority: near?.has(n.id) ? 60 : n.kind === "area" ? 40 : n.kind === "experiment" ? 10 + n.degree : 1,
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
      <div className="graph-body">
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
                const lit = !!focus && (e.s === focus || e.t === focus);
                return <line key={`${e.s}|${e.t}|${e.type}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`g-edge g-${e.type}${lit ? " g-lit" : ""}${focus && !lit ? " g-dim" : ""}`} strokeWidth={(lit ? 1.6 : 0.8) / view.k} />;
              })}
              {nodes.map((n, i) => {
                const { x, y, r } = dots[i];
                return (
                  <g
                    key={n.id}
                    className={`g-node g-${n.kind}${n.kind === "area" ? ` g-area-${n.id.split(":")[1]}` : ""}${n.restricted ? " g-restricted" : ""}${n.id === selected ? " g-sel" : ""}${dim(n.id) ? " g-dim" : ""}`}
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
                  <text key={l.id} x={l.x} y={l.y} fontSize={font} textAnchor={l.anchor} className={dim(l.id) ? "g-dim" : undefined}>
                    {l.text}
                  </text>
                ))}
              </g>
            </g>
          </svg>
          <p className="muted graph-small">Drag to move around, drag a dot to pull it and its neighbours, Ctrl + scroll (or the buttons) to zoom, click a dot for details.</p>
        </div>
        <aside className="graph-panel" aria-live="polite">
          {sel ? (
            <Details node={sel} links={selLinks} byId={byId} onPick={goTo} onOpen={onOpen} onAsk={onAsk} />
          ) : (
            <Legend on={on} setOn={setOn} counts={countTypes(ready)} />
          )}
        </aside>
      </div>
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
