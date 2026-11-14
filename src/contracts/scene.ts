import type { ComponentType } from "react";
import type { HabitatPreset } from "./habitat.ts";

export type SceneId = "saffire" | "lunar";

/** What the page hands every 3D scene. A scene reads nothing else from the app. */
export type SceneProps = {
  /** The habitat picked in the hero. Undefined while habitats load. */
  habitat: HabitatPreset | undefined;
  /** True under prefers-reduced-motion: render one still frame, no camera moves, no loop. */
  calm: boolean;
};

/**
 * One 3D scene. The default export of src/scenes/<id>/index.tsx.
 * Component fills its parent box (the page sets the size) and owns its own <Canvas>.
 */
export interface SceneModule {
  id: SceneId;
  /** Section heading on the page, plain language. */
  title: string;
  /** One sentence under the heading: what the viewer is looking at and which record drives it. */
  caption: string;
  Component: ComponentType<SceneProps>;
}
