# Design system

One screen: a mission console (`docs/RESKIN_PRD.md`). Mono, dark, transparent. Token values live in
`src/styles/tokens.css` and nowhere else. Dark only; there is no light mode.

## The one rule

The UI has no hue. Warm near-black, bone-white type, smoked glass. The only colour on screen is the
fire in the replay, plus one 6px flame dot in the Ask SI pill.

Not this: neon, glowing borders, gradient text, scanlines, a grid overlay, drop shadows on panels,
corner brackets on every box. Corner ticks are on one frame only: the replay.

## Layout

| Zone | Class | Holds |
|---|---|---|
| Top bar | `.console-top` | Brand, nav (Interpret, Rank, Compare, Team models, Research map), the Ask SI pill |
| Rail | `.console-rail` | Icon toggles: Replay, Library, Ask SI. Desktop only |
| Left panel | `.console-left` | Library, then "How we know". 320px |
| Center | `.console-center` | The replay, filling it. Over it: base carousel (top), brief line (bottom-left), top 3 or On Earth (bottom-right) |
| Right panel | `.console-right` | Ask SI. 360px |
| Status strip | `.console-status` | Base, O2, pressure, sources checked, experiments, models, About |
| Sheet | `.sheet` | One nav view over the replay; the replay dims behind it |

State is in `src/app/console.ts`. The URL sets the first state: `?base=rover&view=rank&lib=1&ask=0`.
From 761 to 1100px the panels are drawers over the center, under the carousel. At 760px and below:
the nav is a chip row, the panels are bottom sheets, nav sheets open full screen, the strip is two lines.

## Colour

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#0b0b0a` | Page, behind the 3D |
| `--glass` | `rgb(14 14 13 / 0.72)` + blur 20px | Panels over the 3D only (`.glass`). Solid `--color-surface` without `backdrop-filter`, or when the viewer asks for less transparency or more contrast |
| `--glass-hi` | `rgb(255 255 255 / 0.06)` | Hover, selected row |
| `--line` | `rgb(255 255 255 / 0.10)` | Hairlines, panel borders, unselected controls |
| `--line-strong` | `rgb(255 255 255 / 0.24)` | Corner ticks, selected card border |
| `--color-text` | `#ecebe6` | Body, headings. 16.5:1 on the page, 14.6:1 on glass |
| `--color-text-muted` | `#a3a19b` | Secondary text, units. 7.6:1 / 6.8:1 |
| `--label` | `#85837d` | Small mono capitals only. 5.2:1 / 4.6:1. Never on bare 3D |
| `--color-pill` / `--color-pill-text` | `#f2f1ed` / `#0b0b0a` | The one solid pill (Ask SI, "See all"), and every selected state |
| `--color-focus` | `#ecebe6` | Focus ring: 2px, 2px offset, on every focusable element |
| `--flame` | `#ff8a73` | The 6px dot in the Ask SI pill. Nowhere else |
| `--scrim` | `rgb(0 0 0 / 0.5)` | Dimming behind a sheet |

Selected = white fill with dark text or icon. Unselected = transparent with a `--line` border.
"Inside the tested range" and "extrapolated" are told apart by form (solid, dashed), not by hue.
Text over the replay always sits on glass, never on bare 3D. Body text is at least 4.5:1.

## Type

| Role | Face | Setting |
|---|---|---|
| Display: brand, base names, experiment names, rank numerals | Archivo, width 125, weight 800 | Uppercase, tracking 0.04em. Numerals tabular |
| Body | Archivo, normal width, 400 / 600 | 16px, line height 1.5 |
| Readout: units, ids, labels | JetBrains Mono, 500 | Uppercase, tracking 0.08em, 12 to 13px. Never for sentences |

Classes: `.t-display`, `.t-upper`, `.t-readout`. Both families are open licence and self-hosted.

## Shape and spacing

- Spacing from the scale only: 4, 8, 12, 16, 24, 32 (`--space-1` to `--space-6`).
- Radius: 8 chips and icon buttons, 16 panels and sheets, full for pills. One radius per component family.
- Hairlines, not shadows. The only shadow is under the evidence drawer.
- Every control is a real button, at least 44px, with a visible focus ring. Labels and values share a baseline.
- No underline on a standalone link; underline only inside a sentence.

## Icons

Outline icons, 1.5px stroke, `currentColor`, inline SVG in `src/shell/icons.tsx`. No icon dependency.
Path data is from Lucide (https://lucide.dev), ISC licence, copyright Lucide Contributors.

## Motion

| Moment | What moves |
|---|---|
| Picking a base | Ranked cards glide to their new place (view transition). The page itself does not cross-fade, so the replay never flashes |
| Opening a card | Its numeral and title travel to the drawer header |
| Opening a sheet | Fades in and rises 12px |

180ms small state changes, 320ms cards and sheets, 480ms the drawer. Reduced motion: every effect is an instant change.

## Components

- **Base carousel**: one radio group over the replay: ISS, Moon Base, Pressurized rover, then Earth set apart
  as a bonus. Click, arrow buttons or Left/Right keys. It never advances by itself, because every pick re-ranks.
- **Sheet**: glass over the replay. Small header (view name in mono, close button), scrolling body, 960px measure.
  Esc closes it. Focus moves in on open and back to its nav button on close.
- **Nav button**: pill outline; white fill when its sheet is open; pressing it again closes the sheet.
- **Ask SI pill**: the one solid white pill, with the flame dot.
- **Status strip**: mono readouts of the picked base, and an About disclosure with the data and SI notes.
- **Experiment card**, **oxygen bar**, **factor mark**, **source disclosure**, **drawer**: as before, in mono.

## Imagery

Four SI-generated illustrations exist in `public/img/` (a flame sphere and one window view per
habitat), made with Higgsfield (GPT Image 2). The console does not show them today; the rules below
apply wherever one is used again, and in the deck.

Rules, from the Space Apps Project Submission Guide:

- Every generated image carries a visible mark. Each file has "SI-GENERATED IMAGE" baked into its
  corner; where the page shows one, repeat the mark in HTML because crops can hide the baked one.
  Keep both when reusing an image in the deck.
- No NASA logos, flags, patches or mission names in any generated image. Check each new output
  by eye before it ships.
- They are decoration. Anything that shows evidence (bars, counts, tables, quotes) stays code and
  NASA data. Real NASA photographs are never mixed in unlabelled next to generated ones.
- The About disclosure in the status strip says pictures marked SI-generated are illustrations, not NASA photographs.
- The "Use of SI" field on the project page must list Higgsfield and these four images.
