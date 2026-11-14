# Lane R report: ranked experiment list

Built in `src/ranking/` only: `index.tsx` (default `Ranking`), `ExperimentCard`, `OxygenBar`, `FactorDots`, `PdsTag`, `logic.ts` (pure), `logic.test.ts` (7 tests), `ranking.css`.

## What it does
- Heading "Rank", intro line naming the habitat with oxygen % and kPa, native `<details>` "How ranking works" with `HOW_RANKING_WORKS` verbatim.
- Filter: All / Prevention / Detection / Suppression (buttons, `aria-pressed`, each with a plain hint line) bound to `pds`; search bound to `search` (name, id, fuel, hardware; every word must match). "N of M experiments".
- Cards in `rankedFor` order, numbered by full-list position. Top 8 (never `Other`), then "Show all N experiments". Filter or search active: all matches. Lit card behind "Show all": list opens by itself (derived, no effect).
- Card = one button, sets `selectedInvestigationId`. Rank, title, id, tag (text + shape), "Summarize" + summary, oxygen bar, five dots with short labels, rationale. No score on the face.
- Highlight: 3px border, glow, "In the answer" label; first lit card scrolls to centre (auto if reduced motion, smooth otherwise).
- States: loading (`role=status`), load error (`role=alert`), empty with "Clear filter and search".

## Oxygen scale
Fixed 0 to 100% for every card. Reason: ranges run from 12 to 85% and habitats are 21 to 30%; one fixed scale lets cards be compared by eye. Narrow ranges get a minimum 2% width so a single value still shows. Caption under the bar says "Tested 12 to 34% · here 30%". Text equivalent is the `o2` factor `reason` (aria-label + title). Null range: "Oxygen: not on record".

## Dots
`dotLevel`: null = dashed ring with slash; under 1/3 = ring; 1/3 up to 2/3 = half; 2/3 and up = filled. Name is "<label>: <reason>" (null adds "not on record."); on hover title, and screen readers. Dots cannot be focusable on their own (the card is the one button); the drawer shows reasons in full.

## Tokens wanted (fallbacks defined in `ranking.css`, not added to tokens.css)
`--color-lit`, `--color-lit-bg`, `--color-lit-text` (lit card; fall back to accent / badge colours), `--color-track` (empty bar track; falls back to border). No hex in components.

## Verified
`npm run gate` green (tsc, 60 vitest, build, pytest). Real browser (Vite dev, port 5311): 1440x900 dark and 375x812 light; no sideways scroll at either (scrollWidth = clientWidth). Checked: top 8 then 26 after Show all, filter Detection = 6, empty state and clear, card click sets `selectedInvestigationId`, lit card hidden behind Show all opens the list and scrolls it into view, Tab lands on first card with 3px focus ring, 375 filter control as a 2x2 grid.

## Not verified
- 1440 light and 375 dark not viewed (all colours are tokens, both themes seen at the other width).
- Contrast not measured with a tool.
- Screen reader not run. Reduced-motion branch not exercised.
- Lit state seen in dark only.

## Notes for others
- Summaries from `claims.json` begin "PSI investigation ..." (data lane's text); shown as is.
- Several titles are long (CFD paper titles); they wrap.
- `highlightIds` are matched against investigation ids.
