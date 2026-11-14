// Paint for the WebGL flame. These are shader inputs inside the canvas, not page colours: CSS tokens
// cannot reach a fragment shader. The shell blue is the art-direction flame blue (#3D7BFF family).
// DOM text over a scene still takes its colours from src/styles/tokens.css only.
export const FX_PAINT = {
  /** Pale core, faintly blue-white. */
  core: "#eaf1ff",
  /** Blue shell, brightest at the flame's edge. */
  shell: "#3d7bff",
  /** Faint orange soot ring. */
  soot: "#ff9a3d",
  /** Light thrown on nearby surfaces. */
  light: "#5d8fff",
  /** Burnt fabric behind a flame front. */
  char: "#141210",
  /** Glowing edge of the char at the flame front. */
  ember: "#ff7a2e",
} as const;
