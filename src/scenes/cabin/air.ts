// The picked base's air, as the cabin scene names and draws it. Earth has no preset of its own: its air is the
// station's (sea-level air), burning at 1 g.
import type { BaseId } from "../../app/console.ts";
import type { HabitatPreset } from "../../contracts/index.ts";
import { airSide } from "../lunar/copy.ts";

export type Air = { name: string; readout: string; o2Percent?: number; pressureKPa?: number; gravity: "micro" | "earth" };

export function airOf(base: BaseId, h: HabitatPreset | undefined): Air {
  const side = airSide(h, base === "earth" ? "Earth" : "Base");
  return {
    name: base === "earth" ? "air on Earth" : side.name.replace(/^ISS/, "station"),
    readout: `${side.oxygen} · ${side.pressure}`,
    o2Percent: side.o2Percent,
    pressureKPa: side.pressureKPa,
    gravity: base === "earth" ? "earth" : "micro",
  };
}
