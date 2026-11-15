# Lane S2: side panels (minimize, peek, pin)

Branch `claude/rs-s`. Gate: `npx tsc --noEmit && npx vitest run && npx vite build` passes (434 tests).

## Done
- `src/shell/SidePanel.tsx`: one frame for Library and Ask SI. 340px panel, 48px strip, shared `PanelHead` (title in `.t-readout`, panel actions, Pin; 48px, same padding and hairline). One background and one hairline per panel: the box owns them; `.glass` only while peeking (over the replay). Ask's section lost its own `.glass`, header and Close.
- States: minimized (strip button, `aria-expanded`), peek (hover 150ms or keyboard focus; overlay over the replay, center does not resize; closes 300ms after the pointer leaves unless focus is inside; Esc closes and returns focus to the strip), pinned (Pin `aria-pressed`, or pressing the strip; docks and resizes the center). Unpin returns to minimized with focus on the strip.
- Store API kept: `leftOpen`/`askOpen` = pinned; `askAbout`, the Ask SI pill, `lib=1`/`ask=1` pin. Peek is local (`src/shell/peek.ts`, pure, with fake-timer tests in `peek.test.tsx`).
- `<Ask />` stays mounted in every state; a minimized box is `inert`, never unmounted. Ask's section no longer carries `hidden` (it carries `data-open`); `thread.test.tsx` updated for that and for the shared header.
- Rail keeps Replay only; the strips are the one control per panel.
- Touch: pointerenter from touch never peeks; a tap on the strip pins. Mid widths (761 to 1100px): a pinned panel stays a drawer over the center under the carousel. Phone: bottom sheets, nav Library button and pill unchanged; the header shows Close instead of Pin.
- Motion: 180ms opacity and translate on the overlay only when motion is allowed; no width animation.
- Sheets: the header label is gone; the close button (accessible name "Close <view>") sits in the top corner.

## Screens (`docs/lane-reports/rs-s2/`, own Chrome on CDP port 9447, `shots.mjs`)
1440 both minimized, left peek, right peek (typing, pointer away: stays open), both pinned, pinned with Rank sheet; 1700 both pinned; 1024 left pinned (drawer); 390 stage, Library, Ask, Rank.

## Not done
- Dropping an experiment card on a minimized Ask strip does nothing (the box is inert); drop on a peeked or pinned panel works as before.
