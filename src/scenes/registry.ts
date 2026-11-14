import type { SceneId, SceneModule } from "../contracts/index.ts";

/** Scenes load on demand, so the 2D page never pays for three.js until a scene is opened. Integrator only. */
export const scenes: Record<SceneId, () => Promise<{ default: SceneModule }>> = {
  saffire: () => import("./saffire/index.tsx"),
  lunar: () => import("./lunar/index.tsx"),
};
