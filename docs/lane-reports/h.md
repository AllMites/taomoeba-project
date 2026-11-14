# Lane H report: experiment detail drawer

Files: `src/evidence/index.tsx` (default export `Evidence`), `logic.ts` + `logic.test.ts` (pure logic, 6 tests), `evidence.css`. Nothing else touched.

## What it does
- Native `<dialog>` + `showModal()`, driven by store `selectedInvestigationId`. Close button, Escape and backdrop click all call `close()`; the `close` event sets the store to null. Related buttons set the id in place (drawer stays open, scrolls to top).
- Right panel 480px at desktop; full width at 600px and below.
- Blocks in the planned order. Summarize, why-it-ranks, measured, changed and related are skipped when empty; conditions and download always show.
- Why it ranks: five rows, each with a bar plus a word (Strong / Partial / Weak / Not on record, dashed empty bar for null), the reason, and a Source disclosure for goal fit. Score appears once, small: "Score 0.78 of 1".
- Conditions: units %, kPa, cm/s; single value shows as "21 %"; null, empty and "Not stated" show "Not on record"; `conditionBasis` "table" adds "from the experiment's data table" (only when a value exists).
- Runs: row/column count, CSV and JSON links with `download`. Run table is fetched only when Preview is opened; first 5 rows in a region that scrolls inside itself; `notes` listed under "Notes from the source table". No runs: "No run table on record".

## Verified (real Chrome via DevTools MCP, vite dev on :5191, now killed)
Store set from the console via `import('/src/app/store.ts')` plus a temporary button injected into the page DOM by the test script (never in source).
- 1440x900 (dark): PSI-69, PSI-99, PSI-60 (no conditions, no runs, ground). Panel 480x900 at x=960, no page sideways scroll, preview table scrolls inside its own region, notes list shown for PSI-99, links have `download`.
- 375x812 emulated mobile, light: PSI-69, PSI-99, PSI-60. Dialog 375 wide, page scrollWidth 375, preview table scrolls inside region.
- Escape closes, store goes to null, focus returns to the opener button.
- Related button (PSI-69 -> CFI) switches the drawer.
- Gate: `npm run gate` green (tsc, vitest 59 pass, build, pytest).

## Not checked
- Tab wrap: after the last control, Tab moved focus to browser UI (body), the native modal behaviour; the page behind is inert. I did not walk every Tab stop by hand.
- Light mode at 1440 and dark at 375 were not screenshotted (same CSS, tokens only). Reduced-motion not exercised.
- Real cards from lane R not present; focus return was tested with an injected opener.
- Screen reader output not tested. Contrast relies on token values (not measured).
- Built-in browser pane was hidden (zero layout), so Chrome DevTools MCP was used instead.

## Notes for integrator
- No missing tokens; only existing `--color-*`, `--space-*`, `--radius-1`, fonts used. Backdrop uses `rgb(0 0 0 / 0.5)` (not a colour token; add `--color-backdrop` if wanted).
- `body:has(.ev-dialog[open]) { overflow: hidden }` in `evidence.css` locks page scroll while open.
- Run-table `columns` objects (`{name, unit, original}`) differ from `investigation.runs.columns` (strings); the drawer uses each correctly.
- Some SI claim text starts "PSI investigation X ..." ("PSI" shown on screen); lane B's wording, not changed here.
