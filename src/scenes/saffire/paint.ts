// Paint for the WebGL set. Vertex colours inside the canvas, not page colours: CSS tokens cannot reach
// a shader. Dark stylized interior; orange only for placards and floor strips. The HUD over the canvas
// takes its colours from src/styles/tokens.css only.
export const SET_PAINT = {
  background: "#06080b",
  hull: "#2a2e35",
  structure: "#101215",
  deck: "#2c3036",
  panel: "#2a2e34",
  bagA: "#3a3c3f",
  bagB: "#2f3235",
  bagC: "#45443f",
  strap: "#08090a",
  box: "#5c616a",
  boxInner: "#141619",
  card: "#5d6168",
  fabric: "#857e70",
  silicone: "#6c767e",
  pmma: "#55606a",
  led: "#dfe8f2",
  orange: "#ff6a2a",
  skyLight: "#9fb2c8",
  groundLight: "#0a0b0d",
  ledLight: "#dfe8f2",
  fillLight: "#b8c6d6",
} as const;
