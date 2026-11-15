import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { usePlayback } from "./playback.ts";

/** Put inside a scene's <Canvas>: marks the scene live when the canvas has drawn its first frame, and not live when it goes. */
export function FirstFrame() {
  const done = useRef(false);
  const get = useThree((s) => s.get);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    // Dev only: the renderer and the first frame's time, for the draw-call and start-up checks.
    if (import.meta.env.DEV) Object.assign(window, { __r3f: get, __playback: usePlayback, __firstFrameMs: performance.now() });
    usePlayback.getState().setLive(true);
  });
  useEffect(() => () => usePlayback.getState().setLive(false), []);
  return null;
}
