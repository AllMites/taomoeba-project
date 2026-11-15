# Lane M: sections into sheets and panels

Branch `claude/rs-m`. Markup and CSS only. No `logic.ts`, no data, no server change.

## What changed

- **No box inside a sheet.** Compare, Gaps, What-if and the research graph lost their own padded surface card. The glass sheet is the surface. Inner cards use a hairline (`--line`) and no fill.
- **Mono pass.** No hard-coded colour is left in these folders. `--color-match`, `--color-flame`, `--color-depth`, `--sphere-*`, `--color-meter-track`, `--color-badge-*` and `--porthole-edge` are no longer used here, so lane S can delete them.
  - Oxygen bar: the tested span is solid when it covers the base and a dashed outline when it misses. The caption still says "covers yours" or "misses yours".
  - What-if support line: solid rule = inside the tested range, dashed rule = few tests nearby, dashed outline = outside the tested range.
  - Earth status: in use = white fill, research = outline, heritage = dashed outline.
  - What-if burn drawing: one flame hue (`--flame`) for both fuels. Methanol and heptane differ by the thickness of the flame shell.
  - A card lit by an answer has a solid white edge and a white "In the answer" label. The sweeping gradient edge is removed (the PRD bans glowing borders).
  - "Show all N experiments" is a quiet button, not a solid pill. The one solid pill on screen stays Ask SI.
- **Earth** is a compact glass card for the 320px overlay slot: heading "On Earth", one intro line, the label key behind a disclosure, items as a hairline list, max-height 50vh with inner scroll.
- **Trust** fits the 320px left panel: heading "How answers are checked", five topics as native disclosures, the first one open.
- **Ranking cards**: the row is draggable (`dragProps(id)`) and has an "Ask about this" button (`askAbout(id)`). The button is a sibling of the card, because the card is itself one button.
- **Evidence drawer** (CSS only): glass, hairline left edge, no drop shadow, solid fallback under reduced transparency.
- **Gaps** copy: "Pick another base to see its gaps."

## Tests

- New `src/ranking/ask.test.tsx`: pressing "Ask about this" opens the Ask panel and scopes the question once.
- `earth.test.tsx` and `trust.test.tsx` follow the new headings.

## Not seen in sheet form

Lane S's shell is not on this branch. The checks ran on the old long page, plus a throwaway 320px harness for Earth and Trust (not committed).
Still to check after the merge: each section inside `.sheet-body`, the heading sizes (`.sec-label`, `.sec-h` belong to lane S), Earth in `.console-overlay` over a live replay frame, Trust under the Library.
On the old page the phone capture shows blank bands where the reveal-on-scroll code hides sections that are off screen. Lane S removes that code.

## Screenshots

- `rs-m/1440-long.webp`: old long page at 1440 wide (first 14,000px).
- `rs-m/390-long.jpg`: old long page at a true 390 wide. No horizontal overflow (scroll width 390).
- `rs-m/320-earth-trust.webp`: Earth card over a bright frame and Trust panel, both 320px.
