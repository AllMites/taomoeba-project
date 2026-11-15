import { Canvas } from "@react-three/fiber";
import { FirstFrame } from "../FirstFrame.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Claim, SceneProps, Source } from "../../contracts/index.ts";
import { useDataset } from "../../data/useDataset.ts";
import { frameAt, loopSpan, midBurn, statusLine, type ReplayFrame, type SaffireRecord } from "./timeline.ts";
import { World, type LeaderRefs } from "./World.tsx";
import "./saffire.css";
import { usePlayback } from "../playback.ts";
import { saffireTimeline } from "../timelines.ts";

const POSTER = "/img/scenes/saffire.webp";
const NARROW_PX = 640;

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl != null;
  } catch {
    return false;
  }
}

function useRecord(): SaffireRecord | null | "error" {
  const [rec, setRec] = useState<SaffireRecord | null | "error">(null);
  useEffect(() => {
    let alive = true;
    fetch("/data/scenes/saffire.json")
      .then((r) => (r.ok ? (r.json() as Promise<SaffireRecord>) : Promise.reject(new Error(String(r.status)))))
      .then(
        (d) => alive && setRec(d),
        () => alive && setRec("error"),
      );
    return () => {
      alive = false;
    };
  }, []);
  return rec;
}

type Callout = { anchor: "box" | "silicone"; claim: Claim; source: Source | undefined };

function useCallouts(rec: SaffireRecord | null, habitatId: string | undefined): Callout[] {
  const claims = useDataset("claims");
  const sources = useDataset("sources");
  return useMemo(() => {
    if (!rec || claims.status !== "ready" || sources.status !== "ready") return [];
    const out: Callout[] = [];
    for (const c of rec.callouts.slice(0, 2)) {
      const id = "claimId" in c ? c.claimId : (c.claimIdByHabitat[habitatId ?? "iss"] ?? c.claimIdByHabitat.iss);
      const claim = claims.data.find((x) => x.id === id);
      if (!claim) continue;
      const source = sources.data.find((s) => s.id === claim.sourceIds[0]);
      out.push({ anchor: c.anchor === "silicone" ? "silicone" : "box", claim, source });
    }
    return out;
  }, [rec, claims, sources, habitatId]);
}

const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function phaseLine(rec: SaffireRecord, f: ReplayFrame): string {
  const v = rec.values;
  if (f.phase === "igniting") return `Igniter on: ${fmt(v.ignitionPowerW.value ?? 0)} W for ${fmt(v.ignitionTimeS.value ?? 0, 1)} s`;
  if (f.phase === "burning") return "Flame spreading with the air flow";
  return `Out at ${fmt(v.burnTimeS.value ?? 0)} s, ${fmt(v.burnLengthCm.value ?? 0)} cm burned`;
}

function Readout({ label, value, unit, of }: { label: string; value: number | string | null; unit: string; of?: number | null }) {
  return (
    <div className="sf-ro">
      <dt>{label}</dt>
      {value == null ? (
        <dd className="sf-missing">Not on record</dd>
      ) : (
        <dd className="t-readout">
          {value}
          {of != null && <span className="sf-of"> / {of}</span>}
          {" "}
          {unit}
        </dd>
      )}
    </div>
  );
}

export function SaffireScene({ habitat, calm }: SceneProps) {
  const rec = useRecord();
  const ready = rec && rec !== "error" ? rec : null;
  const callouts = useCallouts(ready, habitat?.id);
  const webgl = useMemo(hasWebGL, []);
  const [lost, setLost] = useState(false);
  // The stage's playback bar owns time: this scene registers its timeline and follows the seeker.
  const playing = usePlayback((s) => s.playing);
  const [visible, setVisible] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const [hud, setHud] = useState<ReplayFrame | null>(null);
  const leaders = useRef<LeaderRefs>({ root: null, lines: [], dots: [], boxes: [], anchors: [] });

  // Start position: mid-burn for a still frame (calm, or the poster when WebGL is off or lost), else the start
  // of ignition, so the HUD always matches what is on screen.
  const still = calm || !webgl || lost;
  useEffect(() => {
    if (!ready) return;
    const pb = usePlayback.getState();
    pb.setTimeline(saffireTimeline(ready));
    if (still) pb.seek(midBurn(ready));
    clock.current = usePlayback.getState().t;
    setHud(frameAt(ready, clock.current));
  }, [ready, still]);
  useEffect(
    () =>
      usePlayback.subscribe((s) => {
        clock.current = s.t;
      }),
    [],
  );

  // Size class and on-screen state.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    leaders.current.root = el;
    const ro = new ResizeObserver(([e]) => setNarrow((e?.contentRect.width ?? 1000) < NARROW_PX));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => setVisible(e?.isIntersecting ?? true));
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const shown = narrow ? callouts.filter((_, i) => i === active) : callouts;
  leaders.current.anchors = shown.map((c) => c.anchor);

  // HUD refresh: only when a shown number changes (whole seconds, tenths of a centimetre).
  const last = useRef("");
  const onTick = useCallback((f: ReplayFrame) => {
    const key = `${f.phase}|${Math.floor(f.burnS)}|${f.frontCm == null ? "-" : f.frontCm.toFixed(1)}`;
    if (key !== last.current) {
      last.current = key;
      setHud(f);
    }
  }, []);
  const onEnd = useCallback(() => {}, []);

  if (rec === "error") {
    return (
      <div className="sf-root" ref={rootRef}>
        <p className="sf-error">The replay data could not load.</p>
      </div>
    );
  }

  const v = ready?.values;
  const useCanvas = webgl && !lost;
  const label = ready
    ? `Replay of ${ready.experiment.name} sample ${ready.run.sample}: a flame spreads along a fabric strip inside the SAFFIRE box.`
    : "Replay loading";

  return (
    <div className={`sf-root${narrow ? " sf-narrow" : ""}`} ref={rootRef}>
      {useCanvas && ready ? (
        <Canvas
          className="sf-canvas"
          role="img"
          aria-label={label}
          dpr={[1, 1.5]}
          frameloop={visible && playing ? "always" : visible ? "demand" : "never"}
          camera={{ position: [-0.14, 0.36, 0.5], fov: 38, near: 0.02, far: 12 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setLost(true);
            });
          }}
        >
          <FirstFrame />
          <World
            rec={ready}
            calm={calm}
            playing={false}
            loop={false}
            clock={clock}
            onTick={onTick}
            onEnd={onEnd}
            leaders={leaders}
            leaderKey={shown.map((c) => c.claim.id).join("|")}
          />
        </Canvas>
      ) : (
        <img className="sf-poster" src={POSTER} alt={ready ? `Still of the replay at mid-burn. ${label}` : ""} />
      )}

      {useCanvas && (
        <svg className="sf-leaders" aria-hidden="true">
          {shown.map((c, i) => (
            <g key={c.claim.id}>
              <line
                ref={(el) => {
                  leaders.current.lines[i] = el;
                }}
              />
              <circle
                r="4"
                ref={(el) => {
                  leaders.current.dots[i] = el;
                }}
              />
            </g>
          ))}
        </svg>
      )}

      {ready && v && hud && (
        <div className="sf-hud glass">
          <p className="sf-head">
            <span className="sf-name">{ready.experiment.name}</span>
            <span className="t-readout sf-small">Sample {ready.run.sample}</span>
          </p>
          <dl className="sf-readouts">
            <Readout label="Oxygen" value={v.o2Percent.value} unit="%" />
            <Readout label="Air flow" value={v.airflowCmS.value} unit="cm/s" />
            <Readout label="Pressure" value={v.pressureKPa.value} unit="kPa" />
            <Readout label="Time" value={Math.floor(hud.burnS)} unit="s" of={v.burnTimeS.value} />
            <Readout label="Flame front" value={hud.frontCm == null ? null : hud.frontCm.toFixed(1)} unit="cm" of={v.burnLengthCm.value} />
          </dl>
          <p className="sf-phase">{phaseLine(ready, hud)}</p>
          <p className="t-readout sf-speed">{statusLine(ready, hud, playing)}</p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="sf-callouts">
          {shown.map((c, i) => (
            <figure
              key={c.claim.id}
              className={`sf-callout glass sf-at-${c.anchor}`}
              ref={(el) => {
                leaders.current.boxes[i] = el;
              }}
            >
              <p>{c.claim.text}</p>
              {c.source && (
                <figcaption className="sf-chip">
                  <span className="sf-chip-title">{c.source.title}</span>
                  <span className="t-readout sf-small">{c.source.id}</span>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {ready && (
        <div className="sf-controls">
          {narrow && callouts.length > 1 && (
            <div className="sf-pager" role="group" aria-label="Notes">
              {callouts.map((c, i) => (
                <button
                  key={c.claim.id}
                  type="button"
                  className="sf-btn glass sf-page"
                  aria-pressed={i === active}
                  aria-label={`Note ${i + 1} of ${callouts.length}`}
                  onClick={() => setActive(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
