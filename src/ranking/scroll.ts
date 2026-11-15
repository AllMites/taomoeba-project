// Scrolling a card into view inside the one-screen console. scrollIntoView also scrolls every ancestor that can
// scroll, including the document, so the whole console moved. These scroll only the list that holds the card.

export interface Box {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** The list's top edge on screen. */
  top: number;
}

/** The list's scrollTop that centres the card (its on-screen top and height), kept inside the list's range. */
export function centredScrollTop(list: Box, card: { top: number; height: number }): number {
  const want = list.scrollTop + (card.top - list.top) - (list.clientHeight - card.height) / 2;
  return Math.max(0, Math.min(list.scrollHeight - list.clientHeight, Math.round(want)));
}

/** Centre `el` in its nearest scrolling ancestor (the Rank sheet's body), and scroll nothing else. */
export function revealInList(el: HTMLElement | null, smooth: boolean) {
  let list = el?.parentElement ?? null;
  while (list && !/auto|scroll/.test(getComputedStyle(list).overflowY)) list = list.parentElement;
  if (!el || !list) return;
  const l = list.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const top = centredScrollTop({ scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, top: l.top }, b);
  list.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}
