/** Container width (CSS px) below which the scene uses its phone framing and overlay layout (lunar.css: 40rem). */
export const NARROW_PX = 640;

/**
 * Still image for the no-WebGL / lost-context fallback. A narrow box gets a portrait capture with the phone framing
 * (subject low, sky above for the readouts); cropping the wide poster put the habitat under the readouts there.
 * The station pick is a flat dark backdrop, so one file serves both.
 */
export function posterFor(shot: "moon" | "rover" | "iss", width: number, base = "/"): string {
  const narrow = shot !== "iss" && width > 0 && width < NARROW_PX;
  return `${base}img/scenes/lunar-${shot}${narrow ? "-narrow" : ""}.webp`;
}
