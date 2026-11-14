# Lane Q report: ask box and habitat brief

Branch `claude/lane-q-f2b5e6`. Edited only `src/ask/`, `src/brief/` and this report.

## What was built

- `src/brief/index.tsx` (`Brief`, no props), `brief.ts` (order, count parsing, single-experiment test), `brief.css`.
  - Heading "Interpret", sub-line "What the evidence says for <habitat label>".
  - One card per takeaway, sentence at 1.25rem. "How we know" is a native `<details>` with the excerpt and the source titles as links (from `sources.json`).
  - Order is the `TOPIC_ORDER` table in `brief.ts`, keyed on the last part of the claim id: gravity-limit, fuel-gap, o2-coverage, pressure-coverage, bre-airflow, saffire-gravity. Unknown slugs go last in file order. Five shown, then "Show all N" (resets on habitat change).
  - "N of M" is drawn as M round marks, N filled (filled vs hollow, not colour alone), `role="img"` with `aria-label`, no picture when there is no count or M > 60. With the current data: o2-coverage and pressure-coverage draw; fuel-gap and gravity-limit have no "N of M" so they draw nothing.
  - "See experiment" only where the takeaway rests on one source that is its own experiment (`sourceIds == ["psi:<investigationId>"]`): bre-airflow (PSI-20), saffire-gravity (PSI-99). Sets `selectedInvestigationId`.
  - States: loading (`role="status"`), error (`role="alert"`), "No brief for this habitat yet".
- `src/ask/index.tsx` (`Ask`, no props), `respond.ts` (fetch and response handling), `ask.css`.
  - "Ask the records", labelled input (maxLength 300, count shown from 250), Ask button, three example questions that fill and submit.
  - Polite live region "Looking through the records"; answer text with `[ids]` and the "I am quoting the PSI records directly:" lead-in removed (the mode label covers it); cited claims each with a "Source: <title>" disclosure holding the excerpt, plus "See experiment".
  - Sets `highlightIds` to `investigationIds`; "N experiments light up below" links to `#ranking-h` (only when N > 0). Clear empties answer and `highlightIds`.
  - Mode labels as briefed. Errors in `role="alert"`: 429, 400 too long, 400 other, 5xx, network failure, no-cover (suggests the examples), and any non-JSON or wrong-shape reply ("The question service is not running here.").
  - Stale requests are aborted; a late reply never overwrites a newer one.

## Example questions (checked against `public/data/index.json` with the extractive ranker)

The briefed examples did not retrieve well from this corpus: "carbon dioxide on a droplet flame" and "30% oxygen" both return the SAME two unrelated PSI-98/PSI-100 sentences about instruments. I used three that answer cleanly:

- Why does smoke detection matter on a spacecraft? (PSI-102 and the NTRS source)
- How does oxygen level change burning in microgravity? (PSI-25, PSI-20)
- What is a cool flame? (PSI-142, PSI-159)

Follow-up for the corpus/server lanes: CO2-on-droplet and 30% oxygen questions retrieve nothing relevant.

## Tokens

No missing tokens. Used `--color-bg/surface/border/text/text-muted/accent/accent-contrast/focus/badge-bg/badge-text`, `--space-*`, `--radius-*`. The error box reuses the badge colours.

## Verified (what I ran)

- `npm run gate`: green (tsc; vitest 66 passed 1 skipped across 6 files, including the 13 new tests in my two test files; vite build; pytest 67 passed 9 skipped).
- New tests: `src/brief/brief.test.ts` (ordering per habitat with real claims, unknown slugs last, two counts, no count, single-experiment test) and `src/ask/respond.test.ts` (live, extractive, mock, no-cover, 429, 400 too long, 400 other, 500, network failure, HTML reply with 200 and 404, wrong-shape JSON, readable text).
- `npm run build` then `npx wrangler dev --port 8788` (mock, no keys, no `.env` read): in the built-in browser I ran the example "Why does smoke detection matter on a spacecraft?" and got a mock answer with the "Sample answer, the live service is off" label and a source disclosure.
- Extractive reply with `investigationIds`: wrangler is pinned to mock, so I replaced `window.fetch` in the page with a canned extractive JSON reply, typed a question and pressed Enter at 375 wide. Saw the label, the two quotes, "2 experiments light up below", two sources with excerpts, two "See experiment" buttons, and a Clear button. This proves the UI path only, not the live server's output.
- `npm run dev` (Vite, port 5199): clicked an example; the alert read "The question service is not running here." No crash.
- 1440x900 dark and 375x812 dark and light: no sideways scroll (`scrollWidth == clientWidth`), brief cards and 24-mark rows read well, "Show all 6" present.
- Keyboard only: Tab order is skip link, habitat radio, input, example chips, then each "How we know"; Enter on a summary toggles it; Enter in the input submits.
- Servers killed; ports 8788 and 5199 confirmed free.

## Not verified

- Live (SI) mode and the 429 path against a real server: covered by fake-fetch unit tests only.
- Light mode at 1440 and keyboard-only operation of the "See experiment" / Clear buttons were not separately exercised (same markup as the tested ones).
- Contrast was not measured with a tool; the tokens in use are the shared ones.
- "See experiment" and the highlight lighting were not checked against the other lanes' drawer and ranking cards (those lanes' code is still stubs/in progress here).

## Notes for the integrator

- Mock mode (wrangler default) returns the first chunk of the index, which is a long paragraph and carries no investigation id, so no cards light up in mock. That is the server's behaviour; the UI shows it honestly under the mock label.
- The answer appears below the example chips, so at 375 wide it sits below the fold after a submit. A scroll-to-answer would help; it is one line but I kept scope small.
- Brief text from `claims.json` still says "PSI combustion experiments" and "PSI-20"; plain-language pass is lane B's data.
