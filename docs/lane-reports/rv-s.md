# Review: lanes S (Shell) and M (Sections)

Branch `claude/rs-s`, reviewed against `e646ba8`. Checklist: `LANES.md` "Reskin (one-screen console)", `docs/RESKIN_PRD.md` sections 3, 4, 6, 8, 10 and 12.
The old replay box in the center (heading, past/now tabs, "Load 3D view") belongs to lane K and is not reviewed.

## How it was checked

- Own Vite on port 5181. Static states: headless Chrome `--screenshot` at 1440x900 for every `view`, `base=earth`, `lib=1`, `ask=1`.
- Interactive states and true 390x844: my own headless Chrome over CDP (own port and profile, `Emulation.setDeviceMetricsOverride`), with real key and mouse events. CLI `--window-size=390,844` gives a viewport about 500px wide, so the first phone shots were redone over CDP.
- Measurements per state: scroll offsets of every element, `scrollWidth` against `clientWidth`, `elementFromPoint`, `document.activeElement` after each Tab.
- Gate before each commit: `npx tsc --noEmit && npx vitest run && npx vite build`. Final run: 40 files, 374 passed, 1 skipped; build OK.

## Commits

| Commit | Fix |
|---|---|
| `f7153ae` | The console clips instead of scrolling (P1 x2) |
| `502095c` | Phone: Ask SI over sheets, bottom sheets under the carousel, one scroller for On Earth (P1, P2, P3) |
| `acff189` | What a sheet covers is inert; a click on the dimming returns focus to the nav (P2, P3) |
| `5da6ee0` | Native controls take the bone white, not the browser blue; what-if slider margin (P2, P3) |
| `aa959f2` | The ranking scrolls only its own list to the first lit card (P1, from the Ask reviewer) |
| `2d86b76` | Phone: the brief line and top 3 never reach up into the carousel (P2, from the Ask reviewer) |

Each behaviour fix has a check that fails without it (confirmed with `git stash` on the fix): `src/shell/layout.test.ts` (new, reads the CSS) and `src/shell/shell.test.tsx` (5 new tests).

## Findings

### P1. A lit card scrolled into view moved the whole center. Fixed in `f7153ae`

- Repro: `?view=stage&lib=0&ask=0`, then `useStore.getState().setHighlightIds(["PSI-108","PSI-181"])` (two cards at the foot of the Moon ranking). The Rank sheet opens and scrolls to the first lit card, which is correct. But `scrollIntoView` also scrolled `.console-center` (it was `overflow: hidden`, which is still a scroll container) by 81px. The carousel was cut off at the top, and the dimming stopped 81px short of the bottom.
- Evidence: `.console-center` scrollTop 81 before the fix and 0 after. Only `.sheet-body` scrolls now (6813). Screenshot `rv-s/1440-rank-lit.png` shows the state after the fix.
- Fix: `src/app/app.css` `.console`, `.console-center` and `.sheet` use `overflow: clip`. This also covers the carousel's own `scrollIntoView` (`src/shell/Carousel.tsx:28`).
- "Scroll to the first lit card when Rank mounts" works: the card lands inside `.sheet-body` (rows 350 to 561 of 161 to 749).

### P1. The page grew to 2,727px, so scrolling in a panel moved the whole console. Fixed in `f7153ae`

- Repro: `?base=earth&lib=1&ask=1`. `document.documentElement.scrollHeight` is 2727 at a 900px viewport. An absolutely placed, visually hidden element in the Library list had no positioned ancestor, so it sat at its static place far down the page. Scrolling Trust into view (`scrollIntoView`) then scrolled `<html>` by 61px. The top bar left the screen and a blank band showed under the status strip.
- Evidence: scrollers after the scroll were `HTML=61, ASIDE.console-left=3209`. After the fix: `scrollHeight` 900, and only `.console-left` scrolls (`rv-s/1440-lib-trust.png`).
- Fix: `.console` and `.console-left, .console-right` get `position: relative`.

### P1. Phone: "Ask about this" in the Rank sheet opened Ask behind the sheet. Fixed in `502095c`

- Repro: 390x844 `?view=rank`, then press "Ask about this". `askOpen` became true, but `.console-right` was at z-index 20 under the full-screen sheet's 30. `elementFromPoint` inside the panel returned the sheet, so the button seemed to do nothing.
- Fix: on a phone, `.console-right` is at z-index 35 (`src/app/app.css:425`). When an answer lights cards on a phone, `openRankOnHighlight` (`src/shell/logic.ts`) also closes Ask, so the Rank sheet with the lit cards is what shows. On a wide screen Ask stays open.
- Evidence: `rv-s/390-rank-askabout.png` shows the chat with the "About: FLEX" chip, over Rank.

### P1. The ranking's scroll-to-lit-card used `scrollIntoView`. Fixed in `aa959f2`

- From the Ask reviewer: pressing "Show the N experiments" in an answer moved the whole console up about 88px. Two causes:
  - The document was taller than the viewport. Fixed in `f7153ae`, above.
  - `src/ranking/index.tsx` called `scrollIntoView`, which scrolls every scrollable ancestor.
- Fix: new `src/ranking/scroll.ts` (`centredScrollTop`, `revealInList`, the same approach as the Ask review's) centres the card in its nearest `overflow-y: auto` ancestor, which is `.sheet-body`, and scrolls nothing else. `logic.ts` is untouched (reskin rule).
- Repro and evidence, 1440x900 with `?ask=1`, after `setHighlightIds(["PSI-108","PSI-181"])`: the only scrolled element is `DIV.sheet-body=7001`, and the lit card is fully inside it.
- Test: `src/ranking/scroll.test.ts`.

### P2. Phone: at 320px the brief line sat over the carousel. Fixed in `2d86b76`

- Repro: 320x568, `?lib=0&ask=0`. The brief line spanned 122 to 265px and the carousel 129 to 220px. At 320x700 they overlapped too (204 against 220).
- Fix: on a phone `.console-hud` spans from under the carousel to the foot and stacks from the bottom up. `.console-overlay` (`flex: 0 1 auto; min-height: 0`) shrinks and scrolls instead of climbing.
- Evidence: the brief line now starts at 229 at both heights, and 390x844 is unchanged (`rv-s/320x568-stage.png`, `rv-s/320x700-stage.png`).

### P2. Tab walked behind an open sheet. Fixed in `acff189`

- Repro: 1440x900, focus `#nav-rank`, Enter: focus moves into the sheet (correct). 31 Tabs later focus left the sheet. Shift+Tab from the sheet start landed on "See all" (`.pill.top-all`) under the dimming.
- Fix: `inertBehind` in `src/shell/Sheet.tsx` makes what the sheet covers inert. On a wide screen that is the rest of the center: the replay, the brief line and the top 3. The carousel stays live because it sits above the dimming, and the panels sit beside it. On a phone the sheet is full screen, so the whole console goes inert except Ask SI. Switching straight from one sheet to another keeps the replay inert.
- Evidence, 150 Tabs after the fix:
  - 1440: focus visits the sheet, the status strip, the top bar, the rail and the carousel. It never reaches the replay or the HUD.
  - 390: focus visits only the sheet and the skip link.
  - Esc closes the sheet, focus returns to `#nav-rank`, and no `[inert]` is left. The page never scrolled (all scroll offsets 0).

### P2. Phone: the Library and Ask bottom sheets covered the carousel. Fixed in `502095c`

- Repro: 390x844 `?lib=1` or `?ask=1`. The panel top was at 169px while the carousel ends at 220px.
- Fix: phone `--top-h` and `--carousel-h` are set to the measured 121px and 92px. A new `--bottom-sheet-h` (`100dvh` minus the top bar, the carousel and two gaps) sets both sheets' height.
- Evidence: the panel top is now at 229 and the carousel is fully visible (`rv-s/390-lib.png`, `rv-s/390-ask.png`).

### P2. Native controls were blue (no hue rule). Fixed in `5da6ee0`

- Repro: `?view=graph`, legend panel. The link checkboxes drew in Chrome's blue. Lane K's past/now radios did the same.
- Fix: `src/styles/base.css` sets `:root { accent-color: var(--color-accent) }`. Computed value `rgb(236, 235, 230)`, shown in `rv-s/1440-graph-legend.png`.

### P3. A click on the dimming sent focus to `<main>`, not the nav button. Fixed in `acff189`

- Repro: `?view=compare`, mouse click at (72, 500) on the dimming. Before: active element `main#main`. After: `#nav-compare`.
- Fix: the `Scrim` mousedown calls `preventDefault`.

### P3. Phone: On Earth scrolled inside a scrolling overlay. Fixed in `502095c`

- Repro: 390x844 `?base=earth`. Both `.console-overlay` (38dvh) and `.earth` (50vh) scrolled.
- Fix: inside the phone overlay `.earth` has no height cap. Now only the overlay scrolls (`rv-s/390-earth.png`).

### P3. What-if sliders overflowed their field by 2px. Fixed in `5da6ee0`

- The browser's default 2px margin on `input[type=range]` (`whatif-field` 280 > 278 at 1024px, 360 > 358 at 390px). Set `margin: 0` in `src/whatif/whatif.css`. There was no visible scrollbar, so this is not a behaviour bug and has no test.

### Checked and fine

- Trust in the 320px left panel and Earth in the 320px overlay: nothing clips horizontally (panel `scrollWidth` equals `clientWidth`). Earth scrolls inside its card on desktop by design (`rv-s/1440-earth.png`, `rv-s/1440-lib-ask-earth.png`).
- `.sec-h` in sheets: 37.6px at 1024 and 28px at 390, with no overflow in any sheet. Trust and Earth headings are `t-readout`.
- Phone at a true 390x844: page `scrollWidth` 390 and `scrollHeight` 844 in every view. The nav chip row scrolls sideways inside itself. The status strip is two lines (53px). Sheets open full screen.
- Desktop at 1440x900: no page scroll in any view. Esc closes. Focus moves in on open and back to the nav on close.
- Reduced motion: the global rule in `base.css` removes transitions and animations.

## Reported, not fixed

| P | Finding | Why not fixed | Evidence |
|---|---|---|---|
| P3 | Each sheet says its name twice: the sheet header "RANK" and the section's own `sec-word` "RANK" right under it (Interpret, Team models likewise). | Removing either changes headings that the PRD and lane M's report keep on purpose ("the section inside keeps its own h2"). Design call. | `rv-s/1440-rank.png`, `rv-s/1440-interpret.png` |
| P3 | Status strip "Experiments 24" and the brief's "24 PSI combustion experiments", but Rank says "Top 8 of 26" and the Library says 26. The 24 leaves out the `pds === "Other"` rows (`limitsFrom`, `src/app/App.tsx:26`). A first-time user sees two totals. | The count rule is content logic, not a reskin change. Needs a decision on which total to show. | `rv-s/1440-stage.png`, `rv-s/1440-rank.png` |
| P3 | Esc pressed while typing in Ask SI closes the open sheet underneath (`src/shell/Sheet.tsx:58` only skips `<dialog>`). On a phone, Ask now sits over the sheet, so Esc in the chat closes the Rank sheet under it. | Low harm. Whether Esc in the chat should close the chat or nothing belongs to lane A's Ask. | Code reading |
| P2 | Phone: "See all" sits at the foot of the top 3 card. You reach it only by scrolling the overlay, at 320 and at 390 (`seeAllVisible: false` at 320x568, 320x700 and 390x844; true at 1440). Suggested fix for lane T in `src/top/top.css`: `.top { max-height: 100% }` and `.top-list { min-height: 0; overflow-y: auto }`. The overlay then gives the card a height, and the list scrolls above a foot that stays put. | `.top` and its children are lane T's. Styling them from `app.css` would couple the slot to T's internals. | `rv-s/390-stage.png`, `rv-s/320x568-stage.png` |
| P3 | A cut-off "S" shows at the carousel's left edge on a phone, and beside the carousel at 1440 when both panels are open. It is the old Stage heading "See the fire" in lane K's area. | `src/scenes/` is lane K's, still building. | `rv-s/390-stage.png`, `rv-s/1440-lib-ask-earth.png` |
| P3 | With the Library open, about 60 tab stops in the Library come before the top 3. Keyboard users have "Skip to content" as the first tab stop: Enter, then Tab lands on "Previous base" in the carousel (checked over CDP at 1440 `?lib=1`). The DOM order follows the visual left-to-right order, which keeps focus order meaningful (WCAG 2.4.3). | Moving the center before the Library in the DOM would put focus order out of step with the layout. The skip link already covers it. If more is wanted, a "Skip the library" link at the top of the panel is the low-risk option: a design call. | CDP: first stop `skip`, after skip and Tab `icon-btn Previous base` |
| P3 | At 320px wide the status strip takes three lines (two at 390). | The PRD names two lines for the phone and 390 was the check width. Hiding another stat is a content call. | `rv-s/320x568-stage.png` |
| Info | The top card will grow by about 40px on `main` ("Same air as ..."). At 1440x900 the overlay slot allows 608px (`max-height` in `app.css`) and the card is 381px today, so 421px still fits. The card's top would sit about 128px below the carousel's foot (168px). No change needed. | | CDP: overlay 450 to 831, carousel 77 to 168 |
| P3 | The what-if chart's "12% O₂" axis label sits on the dashed baseline. | Inside the SVG in `src/whatif/` markup, which is lane M's logic-adjacent drawing. Cosmetic. | `rv-s/1440-models.png` |
| P3 | Trust disclosure rows overflow their column by 2px (`summary` 257 > 255). Nothing clips, because the panel absorbs it. | Not visible. | CDP measure at 1440 `?lib=1` |
| Info | `--sphere-*`, `--porthole-*`, `--shadow-2` and `--color-match` are still in `tokens.css`, and none is used by lanes S or M now. The old `--glass-text` and `--glass-muted` aliases are still used by `src/whatif/whatif.css`. | Deleting them could break lanes K, T or A, which are still building. Clean up after they merge. | `src/styles/tokens.css:96-126` |
