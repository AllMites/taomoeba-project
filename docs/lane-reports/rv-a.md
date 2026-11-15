# Review of lanes A (Ask SI, server) and T (Top, Library)

Branch `claude/rs-a`, reviewed against `e646ba8..7669b52`. Review commits: `f5644db`, `f35eb84`, `3198ff8`.
Gate on each commit: `npx tsc --noEmit && npx vitest run && npx vite build` pass (38 files, 369 passed, 1 skipped).

How it was checked: Vite on port 5184 and a headless Chrome of my own (port 9335, own profile), driven over the
DevTools protocol by the scripts in `docs/lane-reports/rv-a/` (`cdp.mjs` is the driver). `/ask` was stubbed with
`Fetch.requestPaused`, which also records the request body. Screenshots are in the same folder: `before-*` and
`after-*` for 1440x900, 390x844 and 320x640, with `lib` and `ask` on and off, and `base=rover`.

## Fixed

| # | P | Finding | Repro | Evidence | Commit |
|---|---|---|---|---|---|
| 1 | P1 | "Show the N experiments" (same ids) called `scrollIntoView`, which in the one-screen console also scrolls the document: the whole console moved up 88px and a black band was left at the bottom. Ask now scrolls only the Rank sheet's own list (`revealInList`, `centredScrollTop`). The ranking lane still does it, see R1. | `show.mjs`, `show-same.mjs`: `document.scrollingElement.scrollTop` 0 -> 88 | `1440-show-1.png`; `src/ask/index.tsx` `revealInList` | f5644db |
| 2 | P2 | Close or Escape on a panel that was open from page load (the default from 1500px), or opened from a sheet that has since closed, dropped focus to `<body>`. Focus now goes to the opener, else the Ask SI pill, else `#main` (`focusBackTo`). | `ask-flow.mjs` step 7: focus `BODY` before, `ask-pill` after | `src/ask/thread.ts` `focusBackTo` | f5644db |
| 3 | P3 | Asked for: the Ask empty state repeated "How an answer is made" (also in Library and Trust). Removed with its now unused `IDLE_STEPS`; each answer keeps its own steps. | `after-390-lib_0_ask_1.png` | `src/ask/chat.tsx` empty state | f5644db |
| 4 | P2 | "Read the full source" under a cited source was 140x17 and underlined (a standalone link). Now 44px tall, no underline until hover. | `answer.mjs` | `1440-answer-open.png`, `src/ask/ask.css` `.ask-link a` | 3198ff8 |
| 5 | P3 | Asked for: Moon Base and Pressurized rover show the same top three. The card now says "Same air as Pressurized rover, so the same ranking." Derived from `habitats.json` (O2 and pressure) for the bases the carousel can pick, and only when the two top-three lists agree in ids and scores. | `top.test.tsx` | `after-1440-base_rover_lib_1_ask_1.png`; `src/top/logic.ts` `sameAirAs` | f35eb84 |
| 6 | P2 | Brief line source link was 21px tall and cut to "Compu..." (59px) at 1440 and two letters (40px) at 320. It is now 44px tall, takes its own line when it would be cut short (More moves under it), and on a phone the "and N more" count gives way to it. | `measure.mjs` | `before-1440-lib_1_ask_1.png` vs `after-1440-lib_1_ask_1.png`; `before-320-*` vs `after-320-*` | f35eb84 |
| 7 | P2 | Library source links were 21 to 42px tall. The whole row (44px or more) is now the link's target (`::after`). | `measure.mjs`, `hit.mjs` (`elementFromPoint` at both row corners hits the link) | `src/library/library.css` | f35eb84 |
| 8 | P3 | Top card had no empty state (an empty list for a base with no ranks) and its names were cut with no way to read them. Added "No ranked experiments for this base yet." and `title` on the name. | `top.test.tsx` (`mars`) | `src/top/index.tsx` | f35eb84 |

Each fix has a test that fails without it (checked by reverting the source file and running the tests).

## Checked, no change needed

- **Point 2, the four replaced tests.** The launcher test covered the floating launcher and "hidden while the drawer
  is open": both are gone (the Ask SI pill is lane S's). The phone scroll-lock test covered `html:has(.ask-panel:modal)`:
  there is no modal now. The two `controls.test.tsx` checks (focusable while busy, label and 300-character cap) run
  against the panel composer with the same assertions. No behaviour that still exists lost its test. Focus return
  on close had no test before; it has one now (finding 2).
- **Point 3, Ask panel in the real console** (`ask-flow.mjs`, 1440x900):
  - Chips: two presses on the same Top row give one chip; a Library press adds a second; the remove button removes it;
    the request body carries `about: ["PSI-69"]`; the sent question shows "About: FLEX"; chips stay after sending;
    New chat clears chips and thread. Focus goes to the composer when a chip is added.
  - Mounted while hidden: after Close, `.ask-panel` is in the DOM with `hidden`, the aside is hidden, the thread is kept.
  - What-if path: clicking a what-if chip in the Team models sheet with the panel closed opens the panel and sends
    the question (seen in the stubbed request). `1440-whatif-asked.png`.
  - Drop target, with Chrome's own drag pipeline: `Input.setInterceptDrags`, mouse press and moves on a Top row start
    a real drag (`Input.dragIntercepted` gives `application/x-flame-investigation`), then `Input.dispatchDragEvent`
    dragEnter, dragOver and drop on the panel. While held: `data-drop="true"` and the dashed "Drop to ask about this"
    (`1440-drop.png`). After the drop: chip "About: FLEX-2", drop state cleared (`1440-dropped.png`).
- **Point 6.** Top: error is `role="alert"`, loading keeps three fixed-height rows with `aria-busy`, empty added.
  Library: loading `role="status"`, error `role="alert"`, "No experiments match.", "No sources match.". Every control
  in `.top`, `.briefline`, `.lib` and `.ask-panel` is now at least 44x44 (`measure.mjs`, `answer.mjs`). Nothing in
  these four boxes passes the right edge at 390 or 320. Focus rings: 2px `--color-focus` on every control.
  Tab order at 1440 with both panels open: skip link, nav, Ask SI pill, rail, Close Library, then the Library
  (search, four filters, 26 rows of open plus ask, sources), then the center. See R6.
- **Design rules** in the lanes' CSS: no hue, shadow, glow or gradient; tokens only; motion uses the motion tokens
  (0s under reduced motion); selected filter is white fill with dark text.

## Point 1: `about` on `POST /ask` (verdict, not changed)

- Validation is sound: zod `^[A-Za-z0-9._:-]{1,40}$`, at most 5, inside the existing 8 KB body cap; bad input is a 400.
  Ids are only used to filter and order chunks (`knownAbout`, `aboutFirst`, `inAbout`); they never reach a prompt.
  Unknown ids scope nothing. A scoped question skips saved answers, which is right.
- Cache key: `question|habitat|history|about` with `about` deduped. Ids cannot hold `,` or `|`, so keys cannot collide.
  It keeps request order and unknown ids, so `[A,B]`, `[B,A]` or `[A,junk]` miss the cache and run again (P3, R7).
- Retrieval boost: named experiments' passages go first and each keeps one passage; others follow in their own order.
  The re-ranker's order is kept inside each group. Covered by `server/ask.about.test.ts`.
- Off-topic gate skip: **acceptable, no change.** The gate is `!inScope(q) && coverage < MIN_COVERAGE`, so any
  question with one scope word ("fire") already passed it; it was never an abuse barrier. With a known id (ids are
  public in `investigations.json`) an off-topic question now reaches the re-ranker (one Haiku call, where before it cost
  none). The re-ranker's `none_relevant` exit ends most of those with no writer call; if it does rank passages, the
  writer runs and every sentence still faces the same checks. Spend per request is still capped by the unchanged
  per-IP bucket (10 burst, one per 6 s). Net: marginally easier (no scope word needed), no new ceiling.

## Reported, not fixed (outside this file set, or a decision)

| # | P | Finding | Owner | Evidence |
|---|---|---|---|---|
| R1 | P1 | The console can still be scrolled out of place. The document is 2727px tall at 1440x900 while `body` is `overflow: hidden` (so `html` takes it as the viewport's overflow: no user scroll, but any `scrollIntoView` or `focus()` without `preventScroll` scrolls it). Repro: set `highlightIds` and open Rank with no Ask code involved: `scrollTop` 0 -> 88 (`sheet2.mjs`). The ranking lane's scroll to the first lit card does this on every Show press. Suggest `overflow: clip` on `html, body` or the console, and scrolling the sheet's list in the ranking lane. | S, M | `1440-show-1.png` |
| R2 | P2 | At 320x640 the brief line sits under the carousel (its first lines are hidden) and the Top card shows two rows; "See all" is reachable only by scrolling the overlay (`max-height: 38dvh`). At 390x844 the card's foot is also below the overlay's edge. | S | `after-320-lib_0_ask_0.png`, `after-390-lib_0_ask_0.png` |
| R3 | P2 | At 1440x900 the Top card (about 40px taller with the same-air line on Moon Base and rover) overlaps the "Load 3D view" button. That button is also a second solid white pill; the rules allow only Ask SI and See all. | S, K | `after-1440-lib_1_ask_1.png` |
| R4 | P3 | A large "S" glyph is cut off at the left edge of the carousel at 1440 (a heading under the carousel). | S or K | `before-1440-lib_1_ask_1.png` (x 380, y 110) |
| R5 | P3 | A what-if "Ask about this" question is sent with whatever chips are open (`about: ["PSI-69"]` in `ask-flow.mjs`). Whether a what-if question should drop the scope is a product decision. | A, PRD | `ask-flow.mjs` output |
| R6 | P3 | With the Library open there are more than 60 tab stops (26 rows of two, then sources) before the Top card. A "Skip to replay" or a lighter Library row (one stop per row) would help keyboard users. Layout order is lane S's. | S, T | `measure.mjs` tab order |
| R7 | P3 | `/ask` cache key keeps `about` in request order and includes unknown ids (see point 1). Sorting the known ids would need the index before the cache check. | A | `server/app.ts:219` |
| R8 | P3 | A what-if question sent while another is still in flight opens the panel and is dropped silently (same as before the reskin). | A | `src/ask/index.tsx` `submit` |
