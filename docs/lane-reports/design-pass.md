# Lane report: design pass

Branch `claude/design-pass`, cut from `99d5b36`. The look and motion from `docs/DESIGN_SYSTEM.md` are applied to the finished page. No features were added, and no data, server, contracts or store files were touched. The only new dependencies are `@fontsource-variable/archivo` and `@fontsource-variable/jetbrains-mono`.

## What changed, per step

1. **Tokens** (`src/styles/tokens.css`, `index.html`)
   - Colours follow the spec's table exactly: dark by default, plus a full light scheme.
   - Every old token name is kept and mapped onto the new palette:
     - `--color-edge` → `--color-border-strong`
     - `--color-highlight` → accent
     - `--color-glow` → flame
     - `--color-meter-track` → depth
     - meter fill and marker → accent
     - the three tag fills → `--color-surface-2`, with text in `--color-text` (shape and word come first, so no hue competes with match green or the accent)
   - New names: `--color-flame`, `--color-depth`, `--color-match`, `--color-border-strong`, `--color-pill`/`-text`, `--sphere-*`, `--porthole-sky`, `--material-bg`/`-blur`, `--shadow-porthole`, `--radius-full`, `--space-9`, `--section-gap`, `--text-4xl`, `--font-stretch-display`, `--motion-mid`, `--ease`.
   - Radii are now 8/16/32/full and spacing runs 4…112. `--space-8` changed from 80 to 72 to sit on the spec's scale.
   - Type scale is 12, 14, 16, 20, 28, 40, 64 and 104; the top three steps are fluid.
   - Motion is 180, 320 and 480ms with one easing, `cubic-bezier(.2,.8,.2,1)`, which has no overshoot.
   - The comment block lists every token. `theme-color` is now `#0b0d12` (dark) and `#f0efec` (light).
   - `.unknown` text now uses `--color-text-muted`, because `--color-unknown` is a 3:1 mark colour and is not legible enough for text.
2. **Type**
   - Archivo loads `@fontsource-variable/archivo/wdth.css`, which declares `font-stretch: 62% 125%`. JetBrains Mono loads `wght.css`.
   - Checked in Chrome: the title measures 693px at `font-stretch: 100%` and 860px at 125%. The platform font reports `Archivo-SemiBold-Expanded-ExtraBold`.
   - `base.css` gains these roles: `.t-display`, `.t-upper`, `.t-statement`, `.t-readout`, `.sec-label`/`.sec-word`/`.sec-h`, `.pill`, `.quiet` and `.sr-only`.
   - `src/app/type.ts` sets names of 14 characters or fewer in uppercase.
3. **Hero porthole** (`src/app/App.tsx`, `app.css`, `flame.ts`)
   - A thick frame in `--color-surface-2`, with an inner 1px light edge and a deep inset shadow painted over the glass.
   - The flame sphere is pure CSS: a radial gradient with a blue core and a coral-to-amber rim, plus a halo.
   - The sphere is driven by `--flame-size` and `--flame-glow`. Both are registered with `@property` so they transition, and both are set from the picked habitat's oxygen (21% → 1 / 0, 30% → 0.78 / 1).
   - One 45° leader line runs to a mono readout showing the habitat, O₂ % and kPa.
   - `.porthole-slot` is positioned to fill the glass. An `<img>` inside it gets `object-fit: cover`; the slot is empty for now.
   - The habitat cards show the name in display type, a mono oxygen/kPa readout and the sentence. When selected, a card gets an accent ring, a filled dot and the word "Picked". The bars inside the cards were removed.
4. **Components**
   - Experiment cards:
     - a muted display numeral in two digits ("01")
     - the name in display type
     - a safety tag with shape and word: shield, eye (replaces the magnifier) or drop, all `aria-hidden`
   - Oxygen bar:
     - the track is depth blue
     - the tested span is match green only when it covers the habitat, and then the caption also says "covers yours"; otherwise the span is muted and the caption says "misses yours"
     - a range under 1 point is drawn as a tick
     - the accent marker carries its value above it
   - Dashed rings in the unknown colour mark missing data.
   - One pill per view: Ask, "Show all 26 experiments", and Download CSV in the drawer. Secondary buttons are `.quiet`.
   - Source quotes sit under a 3px flame rule in the brief, the ask sources and the drawer.
   - Takeaway cards use statement type.
   - The drawer has the blurred material with a solid fallback and a 32px radius on its left corners. Its header now shows the rank numeral and the name in display type, plus the shaped tag.
   - The sticky bar uses the same material.
   - Sections are 112px apart on desktop and 72px on phone.
   - Section labels are a mono readout above a plain heading: SI-powered / Ask the records, Interpret / What the evidence says for X, Rank / Experiments that fit your habitat.
5. **Motion** (`src/app/motion.ts`, plus CSS in `app.css`, `ranking.css` and `evidence.css`): see the next section.
6. **Small fixes**: see "Tests". All six have a test that fails without the fix. Each fix is listed here:
   - The count reads "Top 8 of 26" when the list is cut, "N of M experiments" while filtering, and "26 of 26 experiments" when the whole list shows.
   - `#ranking-h` takes `tabIndex={-1}`. In Chrome, following `#ranking-h` moves focus to the heading.
   - When a filter or search hides cited cards, one line says so ("N experiments from the answer are hidden by your filter.") with a Clear filter button.
   - The sticky select hands focus over in Chrome: with the select focused, scrolling to the top moved focus to the checked "moon" radio. This is done by `heroReturnFocus`, called in the IntersectionObserver before the bar unmounts.
   - Run preview headers that start with `?-g` now read "Microgravity …" (checked in PSI-99's preview). "Samle Thickness" is kept as NASA wrote it.
   - New-tab source links say "(opens in a new tab)" in visually hidden text, through `src/app/NewTabLink.tsx` in the brief and the drawer.
   - Goal fit wording: in the drawer, the goal-fit word now comes from the reason's own band (High / Medium / Low), and so does the goal-fit mark on the card (high → filled, medium → half, low → hollow). Other factors are unchanged. `scripts/rank/` and `rank.json` are not edited. **Remaining mismatch:** each card's one-line rationale ("…; partial goal fit") comes from `rank.json`, which is built with the 0.8/0.4 bands. It can still say "partial" where the reason says "high". Fixing that needs a change to `scripts/rank/build.ts` and a rebuild, which is outside this lane.

A fix from my own review of the screenshots: the "In the answer" badge squeezed the card title into broken words ("ACM / E CFI- / G"). It now sits above the title, and the long ask answer was reduced to 24px.

## Contrast (WCAG ratio, computed from `tokens.css` by script)

Spec values passed every pair, so **no token value was adjusted**. "material" means `--material-bg` composited over the page.

| Foreground (need) | Scheme | bg | surface | surface-2 | highlight-bg | material |
|---|---|---|---|---|---|---|
| text (4.5) | dark | 16.90 | 15.59 | 12.00 | 13.05 | 13.51 |
| text (4.5) | light | 15.59 | 17.93 | 14.40 | 15.52 | 14.63 |
| text-muted (4.5) | dark | 9.25 | 8.53 | 6.56 | 7.14 | 7.39 |
| text-muted (4.5) | light | 6.59 | 7.58 | 6.09 | 6.56 | 6.19 |
| accent (4.5) | dark | 11.58 | 10.69 | 8.22 | 8.94 | 9.26 |
| accent (4.5) | light | 5.43 | 6.25 | 5.02 | 5.41 | 5.10 |
| match (3) | dark | 9.28 | 8.56 | 6.59 | 7.16 | 7.42 |
| match (3) | light | 5.39 | 6.20 | 4.98 | 5.36 | 5.06 |
| unknown (3) | dark | 4.26 | 3.93 | 3.02 | 3.29 | 3.41 |
| unknown (3) | light | 4.20 | 4.83 | 3.88 | 4.18 | 3.95 |
| border-strong (3) | dark | 4.26 | 3.93 | 3.02 | 3.29 | 3.41 |
| border-strong (3) | light | 4.20 | 4.83 | 3.88 | 4.18 | 3.95 |
| flame (3, marks only) | dark | 8.45 | 7.80 | 6.00 | 6.53 | 6.76 |
| flame (3, marks only) | light | 4.68 | 5.39 | 4.33 | 4.66 | 4.40 |
| tag text (4.5) | dark | 16.90 | 15.59 | 12.00 | 13.05 | 13.51 |
| tag text (4.5) | light | 15.59 | 17.93 | 14.40 | 15.52 | 14.63 |
| focus (3) | dark | 11.58 | 10.69 | 8.22 | 8.94 | 9.26 |
| focus (3) | light | 9.93 | 11.42 | 9.17 | 9.88 | 9.32 |

Pairs drawn on fills, as dark / light:

| Pair | Dark | Light |
|---|---|---|
| accent-contrast on accent | 10.69 | 6.25 |
| badge text on badge bg | 10.75 | 9.55 |
| pill text on pill | 15.59 | 15.59 |
| tag text on tag fill | 12.00 | 14.40 |
| accent marker on depth track | 6.80 | 4.32 |
| match span on depth track | 5.45 | 4.29 |
| muted span on depth track | 5.43 | 5.25 |

Two limits on these numbers:
- The flame colour is used as text in one place only: the "In the answer" badge in dark (6.0 or better). In light it reaches 4.33 to 4.68, so it is fine as a mark; as badge text it is just under 4.5 on surface-2. Cards are never drawn on surface-2, so it is not used as text there.
- The "Picked" word and the section readouts are accent on bg or surface: 5.43 / 6.25 (light) or better.

## Motion: what is live in Chrome and what falls back

Checked in headless Chrome. The build is current Chrome, which supports `animation-timeline: view()` and `document.startViewTransition`.

| Item | How | Live in Chrome | Fallback |
|---|---|---|---|
| Parallax sphere | `view-timeline` on `.porthole` (inset 0), keyframes on `.sphere-drift` inside `@supports (animation-timeline: view())` and `no-preference` | Yes. At scroll 0: translate 0, opacity 1. At 300px: 21% down, opacity 0.65. The text does not move. | Static sphere |
| Sphere responds to habitat | `@property` transition on `--flame-size` / `--flame-glow`, 320ms | Yes. Measured mid-transition at 0.887, settling at 1 for ISS. | Instant change |
| Habitat pick: cards glide | `pickHabitat()` wraps `setHabitat` in `startViewTransition` + `flushSync`. Each `li` has `view-transition-name: card-<id>` | Yes. One transition per pick, 8 unique card names, no duplicates. | Direct update when the API is missing or motion is reduced |
| Oxygen markers slide | `transition: left 320ms` | Yes (inside the new snapshot) | Instant |
| Card → drawer morph | `openFromCard()` gives the card's `.rk-num` / `.rk-title` the names `ev-num` / `ev-title` just before the transition and clears them inside the update; the drawer header holds those names in CSS. The drawer now opens in a `useLayoutEffect` so the transition captures it | Yes. Before and after the update exactly one `ev-num` exists, with no duplicate names. Group duration 480ms. | Plain open |
| Answer lights cards | `--lit-i` per cited card; border transition delayed by `i × 60ms`; `::after` gradient sweep once, 480ms | Yes. On wrangler: PSI-159 delay 0s, PSI-142 delay 0.06s. | No sweep, plain lit state |
| Sections rise 12px | IntersectionObserver marks sections below the fold `pending`, then `done` once, with a 480ms transition | Yes. All four sections end `done`, opacity 1. | Nothing is hidden: not marked under reduced motion or without IntersectionObserver |
| Sticky bar | Slide-in animation, 320ms, when it mounts | Yes | Appears at once |
| Drawer | `ev-in` slide, 320ms | Yes | Appears at once |

Deviation: the spec asks for a view-timeline for the section rise and a scroll-driven sticky bar. I used IntersectionObserver for the rise because a scroll-driven animation reverses on the way back up and so cannot run "once". The sticky bar uses a mount animation because the bar is already shown and hidden by IntersectionObserver.

Reduced motion was emulated at 1440 dark and 375 light. The page loaded with no sections marked or hidden. The sphere animation was `none` and transition durations were `0s`. After a habitat pick, `document.getAnimations()` returned 0, `--flame-size` was immediately 1, and no view transition was started. No bounce: the single easing has no overshoot.

## Tests

- Changed: `src/ranking/render.test.tsx`, "lists Moon Base best first, top 8, with Show all". It asserted "26 of 26 experiments" on the cut list. That exact wording is what fix 6a changes, so the test now expects "Top 8 of 26" and the absence of "26 of 26 experiments". The behaviour it protects (top 8, Show all, best first) is unchanged.
- Added: `render.test.tsx` (filtering count, `ranking-h` tabindex, hidden-cited note and Clear filter); `logic.test.ts` (covers, rank numeral, countText, litFilteredOut, goal band → mark); `evidence/logic.test.ts` (Microgravity header with Samle kept, goal-fit word); `src/app/focus.test.ts` (sticky focus handoff); `src/app/NewTabLink.test.tsx`.
- Gate: `npm run gate` green. tsc clean, vitest 12 files with 116 passed and 1 skipped, vite build OK, pytest 68 passed and 9 skipped.

## Screenshots (scratchpad `design-pass/`)

- After step 3: `03-hero-{1440,375}-{dark,light}.png`
- After step 4: `04-comp-*`, `04-drawer-*`
- After step 5: `05-motion-*`
- Final: `08-final-*`
- Drawer on FLEX: `08-drawer-FLEX-PSI-69-{1440,375}-{dark,light}.png`
- Reduced motion: `07-reduced-motion-1440-dark.png`, `07-reduced-motion-375-light.png`
- Ask on wrangler (extractive): `06-ask-lit-cards-1440-dark.png`, `06-ask-lit-mid-1440-dark.png`, `06-ask-answer-1440-dark.png`, `06-filter-hides-cited-1440-dark.png`
- Run preview: `08-drawer-PSI-99-run-preview-1440-dark.png`

## Deviations from the spec

- **Hero title size.** "FLAME IN / FREEFALL" set wide is about 7em per line. At 1440 the text column allows about 70 to 80px, not the 104px step, so the size follows the column (`13.5cqi`, capped at 6.5rem) and never breaks a word.
- **Pill colours.** The pill is off-white with dark text in dark mode. In light mode it is inverted (dark fill, light text), because an off-white pill would disappear on the off-white page.
- **Leader line.** It runs to the readout inside the porthole, not to the selected habitat card. The readout names the picked habitat.
- **Tag fills.** All three tags share a neutral fill instead of tints; shape and word tell them apart.
- **Ask label.** The ask section uses the page plan's challenge word "SI-powered".
- **Light-mode sphere.** It reads as rings on a pale sky. It is less glowing than in dark.

## Not verified

- Only headless Chrome was used. Safari and Firefox were not tested, so the fallbacks for missing `animation-timeline` and View Transitions were checked by code path, not in those browsers.
- No screen reader was run. The Tab walk was done in Chrome: hero radio group, ask, brief, filters, cards, Show all; drawer Close, Source, Related, downloads, Preview; Escape returns focus to the card. A focus ring was present at every stop.
- `prefers-contrast: more` (solid material) was not emulated.
- The card → drawer morph and the card glide were checked through transition counts and names, not watched frame by frame. Only one mid-sweep still was captured.
- Layout with system fallback fonts was not screenshotted. The CSS keeps `overflow-wrap` and fluid sizes, but this is unchecked.
