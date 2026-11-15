# Lane A (reskin): Ask SI panel and question scope

Branch `claude/rs-a`. Files: `src/ask/`, `server/app.ts`, `server/ask.ts`, tests.

## What changed

- `<Ask />` is now one glass panel that fills its parent box (`aside.console-right`). The in-page form, the floating
  launcher and the `<dialog>` are gone. Open state is `useConsole(s => s.askOpen)`; Close and Escape call `setAskOpen(false)`.
- Layout: header ("Ask SI", New chat, Close, writer line), scrolling thread, composer pinned at the bottom.
- Scope chips above the composer from `useConsole(s => s.askAbout)`: "About: BASS-II" with a 44px remove button.
  The chips stay after sending. A sent question shows "About: ..." under it. New chat clears them.
- Drop target: the whole panel takes a drop of `DRAG_TYPE` and calls `askAbout(id)`. While a card is held over it,
  the panel shows "Drop to ask about this" inside a dashed outline.
- The what-if "Ask about this" path (`askRequest`) opens the panel, then sends.
- Empty state: three suggested questions for the picked habitat (`suggestionsFor`), then the "How an answer is made" steps.
- Follow-up suggestions moved from the composer to the end of the thread, so the composer stays short at 360px.
- "Show the N experiments" lights the cards and opens the Rank sheet (`setView("rank")`).
- Server: `POST /ask` takes optional `about` (at most 5 ids, each 1 to 40 characters of `A-Z a-z 0-9 . _ : -`).
  Bad input is a 400. Passages of those experiments go first in retrieval (quoting mode and live mode), each named
  experiment keeps one passage even when the question shares no word with it, and the off-topic gate is skipped
  for them. Unknown ids are ignored. Ids never reach a prompt. A scoped question is not answered from a saved answer.
  The cache key includes `about`.

## Tests

- New: `server/ask.about.test.ts` (7 tests). Four of them fail when the boost is switched off (checked by mutation).
- `src/ask/thread.test.tsx`: the launcher test and the phone scroll-lock test described features this lane removed.
  They are replaced by tests of what took their place (panel is a section hidden while closed, no dialog or launcher,
  panel fills its box and never uses `position: fixed`). Added tests for chips, `about` in the request, the drop
  check and the suggestions.
- `src/ask/controls.test.tsx`: the page form is gone; the same two checks now run against the panel composer.

## For the shell lane (S) and the integrator

- Keep `<Ask />` mounted when the panel is closed (hide the aside; do not unmount it). The thread and the
  what-if "Ask about this" path live in the component.
- The panel root carries `.glass` and one hairline (left edge; top edge at 760px and below). If the aside also has
  `.glass` or a border, remove one of the two.
- Phone breakpoint assumed: `max-width: 760px`. At that width "See experiment" and "Show the N experiments" close the panel.
- The Library panel (lane L) also lists "How an answer is made". The Ask empty state lists it too. One could go.

## Not done

- Not seen inside the real shell (lane S builds it in parallel). Checked in a temporary 360px wrapper over a bright
  fake replay, and in a 390px frame for the phone sheet.
- Drag was checked with script-made drag events, not a real mouse drag from a card.

## Screenshots (`docs/lane-reports/rs-a/`)

`1440-empty`, `1440-answer`, `1440-chip`, `1440-scoped-answer`, `1440-drop`, `1440-dropped`,
`390-empty`, `390-answer`, `390-chip`, `390-drop`.
