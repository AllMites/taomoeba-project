/** id of the sticky bar's habitat select. */
export const STICKY_SELECT_ID = "sticky-habitat";

/**
 * When the hero scrolls back in, the sticky bar goes away. If its select had keyboard focus, focus would
 * drop to the page; return the hero picker's checked radio to move it to instead (null: leave focus alone).
 */
export function heroReturnFocus(doc: Pick<Document, "activeElement" | "querySelector">): HTMLElement | null {
  if (doc.activeElement?.id !== STICKY_SELECT_ID) return null;
  return doc.querySelector<HTMLElement>('.picker input[name="habitat"]:checked');
}
