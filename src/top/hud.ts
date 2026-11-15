// Logic for the collapsed HUD bar (docs/RESKIN_PRD.md, section 3): which card is open, and what closes it.
// Markup lives in Hud.tsx; the collapse itself is a container query in app.css.
export type HudCard = "top" | "brief";

/** Pressing a bar button opens its card, closes it when it is the open one, and swaps when the other is open. */
export const toggleCard = (open: HudCard | null, pressed: HudCard): HudCard | null => (open === pressed ? null : pressed);

/** Esc closes an open card. */
export const closesOnKey = (open: HudCard | null, key: string) => open !== null && key === "Escape";

/** A press closes the open card unless it landed on the card itself or on the bar (the bar's buttons toggle on their own). */
export const closesOnPress = (open: HudCard | null, target: Node | null, inside: (Element | null)[]) =>
  open !== null && !inside.some((el) => el && target && el.contains(target));
