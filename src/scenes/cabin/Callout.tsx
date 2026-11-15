// Object details in the scene (PRD 17.5): a glass card joined to the object by a hairline with a dot at the object
// end. Hover shows a preview; a press pins the full details; pressing again, an empty spot of the scene, the close
// button or Escape unpins. The card follows the object as the camera moves, stays upright at a fixed size, and keeps
// out of the stage's glass (callout.ts).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import type { SolidsDoc } from "../../solids/logic.ts";
import { usePlayback } from "../playback.ts";
import { OBJECTS, type CabinObject, type Fabric, type Gravity } from "../spread/spread.ts";
import type { Rect } from "../zone.ts";
import { calloutState, placeCard } from "./callout.ts";
import { project, type V3 } from "./layout.ts";
import { propParts } from "./props.ts";
import { ObjectCard } from "./SpreadPanel.tsx";

type Els = Map<string, { card: HTMLElement; line: SVGLineElement; dot: SVGCircleElement }>;

/** Where the line meets an object: the top middle of its shape. */
export function anchorOf(o: CabinObject): V3 {
  const p = propParts(o);
  const bb = p.body.boundingBox!;
  return [(o.x0 + o.x1) / 2 + p.center[0], bb.max.y, o.z + p.center[2]];
}

/** The first sentence of how an object behaves, for the preview. */
const firstLine = (s: string) => s.match(/^[^.]*\./)?.[0] ?? s;

/** Glass laid over the replay, as rectangles in the cabin's own pixels: the card keeps out of them. */
function keepOut(box: DOMRect, host: HTMLElement): Rect[] {
  const root = host.closest(".stage")?.parentElement ?? document.body;
  const out: Rect[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(".glass")) {
    if (el.closest(".callouts, .scene-chips") || el.closest("details:not([open]) > :not(summary)")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === "hidden") continue;
    out.push({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
  }
  return out;
}

const W = new Vector3();

/** Inside the canvas: moves each callout's card and line to its object's place on screen, every frame. */
export function CalloutTracker({ els }: { els: React.RefObject<Els> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    if (!els.current.size) return;
    const host = gl.domElement.parentElement?.closest<HTMLElement>(".cabin");
    if (!host) return;
    const box = host.getBoundingClientRect();
    const ko = keepOut(box, host);
    camera.getWorldDirection(W);
    const pos = camera.position.toArray() as V3;
    const pose = { pos, target: [pos[0] + W.x, pos[1] + W.y, pos[2] + W.z] as V3, fov: camera.fov };
    const view = camera.view?.enabled ? camera.view : null;
    // The pinned card first: a preview keeps out of it too.
    const order = [...els.current].sort(([, a], [, b]) => (a.card.dataset.kind === "pinned" ? 0 : 1) - (b.card.dataset.kind === "pinned" ? 0 : 1));
    for (const [id, e] of order) {
      const o = OBJECTS.find((x) => x.id === id);
      if (!o) continue;
      const p = project(pose, box.width, box.height, anchorOf(o));
      const at = { x: p.x - (view?.offsetX ?? 0), y: p.y - (view?.offsetY ?? 0), inFront: p.inFront };
      const preview = e.card.dataset.kind === "preview";
      const onStage = at.inFront && at.x >= 0 && at.x <= box.width && at.y >= 0 && at.y <= box.height;
      // A preview of an object off screen hides; a pinned card docks at the edge.
      const hide = preview && !onStage;
      e.card.style.visibility = hide ? "hidden" : "visible";
      e.line.style.visibility = hide ? "hidden" : "visible";
      e.dot.style.visibility = hide || !onStage ? "hidden" : "visible";
      if (hide) continue;
      const placed = placeCard(at, { w: e.card.offsetWidth, h: e.card.offsetHeight }, { w: box.width, h: box.height }, ko, box.width < 600 ? 48 : 56);
      e.card.style.transform = `translate(${Math.round(placed.x)}px, ${Math.round(placed.y)}px)`;
      ko.push({ x: placed.x, y: placed.y, w: e.card.offsetWidth, h: e.card.offsetHeight });
      const [x1, y1, x2, y2] = placed.line;
      e.line.setAttribute("x1", `${x1}`);
      e.line.setAttribute("y1", `${y1}`);
      e.line.setAttribute("x2", `${x2}`);
      e.line.setAttribute("y2", `${y2}`);
      e.dot.setAttribute("cx", `${x1}`);
      e.dot.setAttribute("cy", `${y1}`);
    }
  });
  return null;
}

/** Outside the canvas: the pinned callout (full details) and a hover preview, each a card with its line. */
export function CalloutLayer({ els, g, doc, fabric, start }: { els: React.RefObject<Els>; g: Gravity; doc: SolidsDoc | null; fabric: Fabric; start: string }) {
  const hovered = usePlayback((s) => s.hovered);
  const picked = usePlayback((s) => s.picked);
  const { pinned, preview } = calloutState(hovered, picked);
  const parts = useRef(new Map<string, Partial<Record<"card" | "line" | "dot", HTMLElement | SVGElement>>>());
  // Escape unpins.
  useEffect(() => {
    if (!pinned) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && usePlayback.getState().pick(null);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [pinned]);
  const shown = [pinned && { id: pinned, kind: "pinned" as const }, preview && { id: preview, kind: "preview" as const }].filter((x): x is { id: string; kind: "pinned" | "preview" } => !!x);
  return (
    <div className="callouts">
      {shown.map(({ id, kind }) => {
        const o = OBJECTS.find((x) => x.id === id);
        if (!o) return null;
        // The three parts mount one by one: collected here, handed to the tracker once all three are in.
        const set = (part: "card" | "line" | "dot") => (el: HTMLElement | SVGElement | null) => {
          const cur = parts.current.get(id) ?? {};
          if (el) cur[part] = el;
          else delete cur[part];
          parts.current.set(id, cur);
          if (cur.card && cur.line && cur.dot) els.current.set(id, cur as { card: HTMLElement; line: SVGLineElement; dot: SVGCircleElement });
          else els.current.delete(id);
        };
        const burns = o.burns(g);
        return (
          <div key={kind} className="callout" data-kind={kind}>
            <svg className="callout-wire" aria-hidden="true">
              <line ref={set("line")} />
              <circle ref={set("dot")} r="3" />
            </svg>
            <div ref={set("card")} className="callout-card glass" data-kind={kind}>
              {kind === "preview" ? (
                <div className="callout-preview">
                  <p className="callout-name">{o.name}</p>
                  <p className="spread-burns">
                    <span className="burn-mark" data-mark={burns ? "solid" : "dashed"} aria-hidden="true" />
                    <b>{burns ? "Combustible" : "Does not burn"}</b>
                    {g === "earth" ? " at 1 g" : " here"}
                  </p>
                  <p className="spread-text">{firstLine(o.behaviour)}</p>
                </div>
              ) : (
                <>
                  <button type="button" className="callout-close" aria-label={`Close the details of the ${o.name.toLowerCase()}`} onClick={() => usePlayback.getState().pick(null)}>
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                  <ObjectCard o={o} g={g} doc={doc} fabric={fabric} start={start} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
