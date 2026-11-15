// What the center replay shows for a picked base and scene. Pure, so the mapping is tested without a browser.
import { habitatOf, type BaseId } from "../app/console.ts";
import type { HabitatId, SceneId } from "../contracts/index.ts";
import { compareLine, EARTH_LINE, LIMITS } from "./lunar/copy.ts";
import type { Mode } from "./playback.ts";
import { sceneFor } from "./timelines.ts";

export type Replay = {
  scene: SceneId;
  /** The habitat preset handed to the scene. Earth has none of its own: its air is the station's. */
  habitat: HabitatId;
  /** Still picture shown first, and for good where the 3D cannot run. None yet for the cabin scenes. */
  poster?: string;
  /** Portrait crop of the poster for a phone, where one exists. */
  posterNarrow?: string;
  /** One line on the glass chip. Says "illustration" wherever the flame is drawn, not filmed or replayed. */
  caption: string;
  /** The longer note behind the chip's "About" disclosure. */
  notes: string[];
};

const ILLUSTRATION = LIMITS[0];

export function replayFor(base: BaseId, mode: Mode, label?: string): Replay {
  const habitat = habitatOf(base);
  const scene = sceneFor(mode);
  if (scene === "saffire") {
    return {
      scene,
      habitat,
      poster: "/img/scenes/saffire.webp",
      caption: "A real fire: SAFFIRE-II, a fabric strip burning inside a cargo ship. Timing from the run table.",
      notes: [],
    };
  }
  const where = base === "earth" ? "a cabin on Earth, at 1 g" : base === "iss" ? "a station module" : `the ${label ?? "base"} cabin`;
  return {
    scene,
    habitat,
    caption: mode === "spread" ? `Fire spreading in ${where}. ${ILLUSTRATION}` : `A fuel droplet burning in ${where}. ${ILLUSTRATION}`,
    notes: base === "earth" ? [EARTH_LINE] : base === "iss" ? [compareLine(true, true)] : [LIMITS[1]],
  };
}
