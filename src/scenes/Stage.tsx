import { Component, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useConsole } from "../app/console.ts";
import { prefersCalm } from "../app/motion.ts";
import type { SceneId, SceneModule } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import { scenes } from "./registry.ts";
import { advance, clock, phaseAt, usePlayback } from "./playback.ts";
import { replayFor } from "./replay.ts";
import { MODES } from "./timelines.ts";
import { freeZone, type FlameLayout, type Rect } from "./zone.ts";
import "./stage.css";


/** Keyboard navigation on the focused stage: [orbit, tilt, zoom factor]. */
const NAV_KEYS: Record<string, [number, number, number]> = {
  ArrowLeft: [0.2, 0, 1],
  ArrowRight: [-0.2, 0, 1],
  ArrowUp: [0, -0.12, 1],
  ArrowDown: [0, 0.12, 1],
  "+": [0, 0, 0.85],
  "=": [0, 0, 0.85],
  "-": [0, 0, 1.18],
  _: [0, 0, 1.18],
};

/** The old scene fades out for this long before the new one is handed its base (stage.css uses the same time). */
const FADE_OUT_MS = 160;

/** A scene that throws (no WebGL, a model that will not load) leaves the still picture under it on screen. */
class SceneGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The scene shows `shown`, which lags the pick by one fade-out: the old scene fades to the new still picture,
 * then the new scene fades in over it. Under reduced motion the swap is instant.
 */
function useCrossfade<T>(value: T, calm: boolean) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (shown === value) return;
    if (calm) {
      setShown(value);
      return;
    }
    const t = setTimeout(() => setShown(value), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [value, shown, calm]);
  return { shown, fading: shown !== value };
}

const idle = (run: () => void) => {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 1500 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 200);
  return () => clearTimeout(id);
};

/** Glass the console lays over the replay (layout contract class names), besides the stage's own chips. */
const OVER_REPLAY = ".console-carousel, .console-brief, .console-overlay";

/**
 * The clear part of the replay where the flames go, kept up to date as panels open and cards change size. The
 * scene reads it as CSS custom properties (--fz-*), so a scene module needs no new props.
 */
function useFlameZone(stage: React.RefObject<HTMLElement | null>, flames: number, key: string) {
  const [zone, setZone] = useState<(Rect & FlameLayout) | null>(null);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el || !flames) return;
    const own = () => [...el.querySelectorAll<HTMLElement>(".stage-caption-text, .stage-pick-btn, .stage-play")];
    const others = () => [...(el.parentElement?.querySelectorAll<HTMLElement>(OVER_REPLAY) ?? [])];
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        const rects = [...own(), ...others()].map((o) => {
          const r = o.getBoundingClientRect();
          return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
        });
        const next = freeZone({ w: box.width, h: box.height }, rects, flames);
        setZone((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(frame);
    const ro = new ResizeObserver(measure);
    for (const o of [el, ...own(), ...others()]) ro.observe(o);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [stage, flames, key]);
  // The scene measures its flame slots on resize; a zone that only moves does not resize it, so say so.
  useEffect(() => {
    if (zone) window.dispatchEvent(new Event("replay-zone"));
  }, [zone]);
  return flames ? zone : null;
}

const zoneStyle = (z: (Rect & FlameLayout) | null): CSSProperties | undefined =>
  z && z.s > 0
    ? ({ "--fz-x": `${z.x}px`, "--fz-y": `${z.y}px`, "--fz-w": `${z.w}px`, "--fz-h": `${z.h}px`, "--fz-s": `${z.s}px`, "--fz-dir": z.dir } as CSSProperties)
    : undefined;

/** Moves the one timeline on while it plays; stops at the end. */
function useTicker() {
  const playing = usePlayback((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let id = requestAnimationFrame(function step(now) {
      const st = usePlayback.getState();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (st.timeline) {
        const r = advance(st.timeline, st.t, dt);
        st.seek(r.t);
        if (r.ended) return st.setPlaying(false);
      }
      id = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(id);
  }, [playing]);
}

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor" />
  </svg>
);

/** Play and pause, the seeker, elapsed and total time, and the phase on screen. One bar for every scene. */
function PlayBar() {
  const tl = usePlayback((s) => s.timeline);
  const t = usePlayback((s) => s.t);
  const playing = usePlayback((s) => s.playing);
  if (!tl) return null;
  const { seek, setPlaying } = usePlayback.getState();
  const phase = phaseAt(tl, t);
  const span = tl.end - tl.start;
  const toggle = () => {
    if (!playing && t >= tl.end) seek(tl.start);
    setPlaying(!playing);
  };
  return (
    <div className="stage-play glass" role="group" aria-label="Playback">
      <button type="button" className="stage-play-btn" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <input
        type="range"
        className="stage-seek"
        aria-label="Time"
        min={tl.start}
        max={tl.end}
        step={span / 200}
        value={t}
        aria-valuetext={`${clock(t - tl.start)} of ${clock(span)}. ${phase}`}
        onChange={(e) => {
          setPlaying(false);
          seek(Number(e.target.value));
        }}
      />
      <span className="stage-time t-readout">
        {clock(t - tl.start)} / {clock(span)}
        {tl.rate > 1 && <span className="stage-rate"> · {tl.rate}×</span>}
      </span>
      <span className="stage-phase" aria-live="polite">
        {phase}
      </span>
    </div>
  );
}

/** Which scene: a disclosure with the three named scenes, each with its one-line description. */
function ScenePicker() {
  const mode = usePlayback((s) => s.mode);
  const ref = useRef<HTMLDetailsElement>(null);
  const current = MODES.find((m) => m.id === mode)!;
  return (
    <details className="stage-pick" ref={ref}>
      <summary className="stage-pick-btn glass">
        <span className="stage-pick-label t-readout">Scene</span>
        <span className="stage-pick-name">{current.name}</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      <fieldset className="stage-pick-list glass">
        <legend className="sr-only">Which scene</legend>
        {MODES.map((m) => (
          <label key={m.id} className="stage-pick-opt">
            <input
              type="radio"
              name="replay-scene"
              className="sr-only"
              checked={mode === m.id}
              onChange={() => {
                usePlayback.getState().setMode(m.id);
                if (ref.current) ref.current.open = false;
              }}
            />
            <span className="stage-pick-opt-name">{m.name}</span>
            <span className="stage-pick-opt-line">{m.line}</span>
          </label>
        ))}
      </fieldset>
    </details>
  );
}

/**
 * The center replay. It fills main.console-center and always runs: the still picture is in the first frame, and
 * the 3D code and models load after first paint, so nothing the judges need waits for them. Where WebGL is off
 * or a scene fails, the still picture stays.
 */
export default function Stage() {
  const habitats = useDataset("habitats");
  const base = useConsole((s) => s.base);
  const mode = usePlayback((s) => s.mode);
  const [calm] = useState(prefersCalm);
  const [loaded, setLoaded] = useState<Partial<Record<SceneId, SceneModule>>>({});

  const { shown, fading } = useCrossfade(`${base}|${mode}`, calm);
  const [shownBase, shownMode] = shown.split("|") as [typeof base, typeof mode];
  const label = (id: string) => (habitats.status === "ready" ? habitats.data.find((h) => h.id === id)?.label : undefined);
  const target = replayFor(base, mode, label(base));
  const current = replayFor(shownBase, shownMode, label(shownBase));
  const habitat = habitats.status === "ready" ? habitats.data.find((h) => h.id === current.habitat) : undefined;
  const mod = loaded[current.scene];
  const section = useRef<HTMLElement>(null);
  const zone = useFlameZone(section, current.scene === "lunar" ? 1 : 0, shown);
  useTicker();
  // A new timeline (another scene, base or setting) plays from its start, except under reduced motion.
  const tlKey = usePlayback((s) => s.timeline?.key);
  useEffect(() => {
    if (tlKey) usePlayback.getState().setPlaying(!calm);
  }, [tlKey, calm]);

  // After first paint, and again when the other view is first asked for. A failed load keeps the still picture.
  const wanted = target.scene;
  useEffect(() => {
    if (loaded[wanted]) return;
    let live = true;
    const cancel = idle(() => {
      scenes[wanted]().then(
        (m) => live && setLoaded((l) => ({ ...l, [wanted]: m.default })),
        () => {},
      );
    });
    return () => {
      live = false;
      cancel();
    };
  }, [wanted, loaded]);

  const drifted = usePlayback((s) => s.drifted);
  const steered = usePlayback((s) => s.steered);
  // Arrow keys orbit and plus / minus zoom while the stage itself has focus (not a control inside it).
  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const k = NAV_KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    usePlayback.getState().push(...k);
  };

  return (
    <section className="stage" aria-label="Replay. Arrow keys look around, plus and minus zoom." data-mode={mode} ref={section} tabIndex={0} onKeyDown={onKey}>
      <picture>
        {target.posterNarrow && <source media="(max-width: 600px)" srcSet={target.posterNarrow} />}
        <img className="stage-poster" src={target.poster} alt="" />
      </picture>
      {mod && (
        <SceneGuard key={current.scene}>
          <div className="stage-scene" data-fading={fading || undefined} style={zoneStyle(zone)}>
            <mod.Component habitat={habitat} calm={calm} />
          </div>
        </SceneGuard>
      )}
      <div className="stage-ticks" aria-hidden="true" />
      <div className="stage-caption">
        <div className="stage-caption-text glass">
          <p>{target.caption}</p>
          {target.notes.length > 0 && (
            <details className="stage-info">
              <summary aria-label="About this replay">
                <span aria-hidden="true">i</span>
              </summary>
              <div className="stage-info-body glass">
                {target.notes.map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
      <ScenePicker />
      <div className="stage-nav">
        {!drifted && (
          <p className="stage-hint glass" role="note">
            <span className="stage-hint-fine">Drag to look around, scroll to zoom</span>
            <span className="stage-hint-touch">Drag to look around, pinch to zoom</span>
          </p>
        )}
        {steered && (
          <button type="button" className="stage-reset glass" onClick={() => usePlayback.getState().resetView()}>
            Reset view
          </button>
        )}
      </div>
      <PlayBar />
    </section>
  );
}
