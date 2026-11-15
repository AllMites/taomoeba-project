import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { usePlayback } from "./playback.ts";

/** Put inside a scene's <Canvas>: marks the scene live when the canvas has drawn its first frame, and not live when it goes. */
export function FirstFrame() {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    usePlayback.getState().setLive(true);
  });
  useEffect(() => () => usePlayback.getState().setLive(false), []);
  return null;
}
