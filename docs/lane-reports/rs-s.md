# Lane S: console shell

Branch `claude/rs-s`. Turns the long page into one screen (`docs/RESKIN_PRD.md`, sections 2, 3, 4, 6, 8, 10).

## What changed

- `src/app/App.tsx`: the console grid. Top bar, rail, left panel (`<Library />`, `<Trust />`), center
  (`<Stage />`, carousel, `<BriefLine />`, `<TopForBase />` or `<Earth />`), right panel (`<Ask />`), status strip,
  one sheet per nav view (Interpret, Rank with Gaps and the limits block, Compare, Team models, Research map),
  `<Evidence />`. The hero porthole, radio picker, sticky bar and reveal-on-scroll are gone.
- `src/shell/`: `Sheet.tsx`, `Carousel.tsx`, `chrome.tsx` (TopBar, Rail, StatusStrip), `icons.tsx` (Lucide paths,
  inline), `logic.ts` (nav list, carousel stepping, "lit cards open Rank"), `shell.test.tsx` (10 tests).
- `src/app/app.css`: rewritten for the console. `src/styles/`: `--scrim` token, 2px focus ring.
- Removed `src/app/focus.ts`, `focus.test.ts`, `flame.ts` (hero only, nothing else used them).
- `index.html`: dark theme colour only. `docs/DESIGN_SYSTEM.md`: rewritten for the mono console.

## Checked in a real browser (own headless Chrome over CDP)

- 1440x900 and 390x844: no page scroll (`scrollWidth` and `scrollHeight` equal the viewport).
- A sheet takes focus on open; Esc closes it and focus returns to its nav button.
- Right arrow on the carousel picks the next base and focus follows it.
- Phone status strip holds to two lines.

## Seams for other lanes

- **K**: `app.css` already sets `.console-center > .stage { position: absolute; inset: 0; z-index: 0 }`.
  Until K lands, the old Stage heading, tabs and 16:9 box show under the carousel (see screenshots).
- **A**: the old Ask still draws its page form in the right panel and its floating launcher over the
  About button; `app.css` no longer pads the body for `.ask-panel`. `.console-right` is `overflow: auto` as a
  stopgap; A's root should take `height: 100%`. On a phone `.console-right` is a fixed bottom sheet, 80dvh.
- **M**: Trust is still a full-size section in the 320px panel; Earth is a full section in the 320px overlay
  (it scrolls inside). Rank mounts only when its sheet opens, so "scroll to the first lit card" must run on mount.
- **L**: the panel header already says "Library", so `app.css` hides `.console-left .lib-h` visually (it stays for
  assistive tech).
- **Integrator** (`console.ts`): at 1366x768 both panels start open and the center is 625px, so the carousel
  scrolls sideways and the brief line is narrow. Consider opening only one panel by default below about 1500px.

## Not done

- Nav tooltips show on hover and keyboard focus; not shown on touch.
- The third footer note is reworded ("Pictures marked SI-generated are illustrations, not NASA photographs"),
  because the console no longer shows the habitat illustrations.
- Rank sheet: Gaps is a stacked section under the ranking, not a "What to test next" tab.

## Screenshots (`docs/lane-reports/rs-s/`)

`1440-stage.png` (both panels), `1440-rank.png`, `1440-earth.png`, `1440-about.png` (About open, Library open),
`1366-both.png`, `1024-panels.png` (drawer under the carousel), `390-stage.png`, `390-rank.png`, `390-library.png`.
