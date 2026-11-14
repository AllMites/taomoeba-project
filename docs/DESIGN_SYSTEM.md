# Design system

Derived from the team's mood board (14 Nov). The board leads; this file turns it into rules
and exact values. Token values live in `src/styles/tokens.css` and nowhere else.

## What the board says

Six references and three palettes. Patterns that repeat across them:

| Pattern on the board | Seen in | What we take |
|---|---|---|
| Black space, one large lit object per screen | Planet pages, glass flower | One focal object per section. Ours is the flame sphere. |
| Looking out through a window: hexagon ports, a rounded viewport frame | "Space Design", mountain viewport | The hero is a porthole. Content sits inside a thick rounded frame. |
| Very wide, heavy display type for names; thin tight grotesk for statements | CETRION, DEVLAAR; "Space Design at Your Advantage" | Expanded bold for names and numerals, regular width for sentences. |
| Big index numerals `_01 _02 _03` | Planet pages | Rank numbers on cards. They are real information here, not decoration. |
| Small mono capitals for labels and readouts | All | Mono only for units, ids and the three challenge words. |
| Leader line from object to a data box | Glass flower | One, in the hero: from the sphere to the habitat's oxygen and pressure. |
| White pill button, mono capitals, arrow | "Start your journey" | Primary action style. |
| Warm light on cold dark: rust, coral, amber against navy and black | Palettes 1 and 2 | Fire on space. Blue for depth, warm for anything alive. |

Left on the board, on purpose: barcodes, coordinate strings, dense HUD boxes, tiny grey
paragraphs. They read as decoration, and our rehearsal failed on "I don't know what to do".

## Colour

Palette 2 is the base (near-black, deep blue, coral, amber, pale blue-grey, off-white): it is
the board's own fire-on-space set. Palette 1 gives the warm neutrals. Palette 3's green is used
for one meaning only.

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `--color-bg` | `#0b0d12` | `#f0efec` | Page |
| `--color-surface` | `#15171c` | `#ffffff` | Cards |
| `--color-surface-2` | `#1f2f38` | `#ebe6da` | Raised: drawer, sticky bar, porthole frame |
| `--color-border` | `#2b3a52` | `#c9c1b2` | Hairlines |
| `--color-text` | `#f0efec` | `#15171c` | Body |
| `--color-text-muted` | `#aab4bf` | `#4a5563` | Secondary, "Not on record" |
| `--color-accent` | `#ffbb5c` | `#9a4a12` | Primary action, selected state, habitat marker |
| `--color-accent-contrast` | `#15171c` | `#ffffff` | Text on accent |
| `--color-flame` | `#ff8a73` | `#a5533a` | Flame glow edge, lit cards |
| `--color-depth` | `#003a70` | `#cfd8df` | Flame core glow, meter track, porthole sky |
| `--color-match` | `#7cc563` | `#00703f` | A tested range that covers the habitat. Nothing else. |
| `--color-border-strong` | `#6b7785` | `#6b7280` | Edges of inputs, radios and unselected controls (3:1) |
| `--color-unknown` | `#6b7785` | `#6b7280` | Not on record marks (always with a dashed shape) |
| `--color-focus` | `#ffbb5c` | `#003a70` | Focus ring |

Rules: one warm accent on screen at a time does the pointing. Blue never carries meaning.
Green means "covers your habitat" and is always paired with a filled shape or the word.
Body text 4.5:1, marks 3:1, in both schemes; check after any value change.

Measured (WCAG ratio, worst case across page, card and raised surfaces): text 12.0 dark / 14.4
light; muted text 6.6 / 6.1; accent 8.2 / 5.0; flame 6.0 / 4.3 (marks only, never text in light);
match 6.6 / 5.0; unknown and strong border 3.0 / 3.9. `--color-border` is a decorative hairline
(about 1.6:1) and must never be the only edge of a control.

Safety tags are told apart by shape and word first, tint second: Prevention (shield),
Detection (eye), Suppression (drop).

## Type

| Role | Face | Setting |
|---|---|---|
| Display: title, experiment names, rank numerals | Archivo, expanded width (125), weight 800 | Uppercase for names up to about 14 characters, tracking 0.02em. Numerals tabular. |
| Statement: hero line, takeaways | Archivo, normal width, weight 400 | Tracking -0.02em at 32px and up, as large type needs tighter spacing. |
| Body | Archivo, normal width, weight 400 / 600 | 16px minimum, line height 1.5, measure 60 to 70 characters. |
| Readout: units, ids, challenge words | JetBrains Mono, 500 | Uppercase, tracking 0.08em, 12 to 13px. Never for sentences. |

One variable family carries display and body, so the page loads two font files. Both are open
licence and self-hosted; system sans and mono are the fallbacks and the layout must hold with them.

Scale (fluid, clamp): 12, 14, 16, 20, 28, 40, 64, 104. The 104 step is for the hero title and
rank numerals only.

## Shape, depth, material

- Radius: 8 (chips), 16 (cards), 32 (porthole frame, drawer), full (pills).
- Porthole: a thick `--color-surface-2` frame with an inner 1px light edge and a deep inset
  shadow, so content looks seen through glass.
- Material: the sticky bar and the drawer use a blurred translucent surface so the page stays
  faintly visible behind them. Solid fallback when blur is unsupported or contrast is raised.
- Elevation by light, not by lines: a raised thing is lighter than what it sits on. Shadows
  only under the drawer.
- Spacing: 4, 8, 12, 16, 24, 32, 48, 72, 112. Sections are 112 apart on desktop, 72 on phone.

## Motion

Motion explains where something came from and what changed. If it does neither, it is cut.
Everything below is native CSS or the browser's View Transitions; no animation library.

| Moment | What moves | How |
|---|---|---|
| Scrolling the hero | The flame sphere drifts slower than the text and dims; the porthole frame stays put, so the sphere reads as far away | Scroll-driven animation tied to the hero's own scroll range |
| Picking a habitat | The sphere changes: brighter and tighter at 30% oxygen, softer at 21%. Oxygen markers slide along every bar. Cards that change rank glide to their new place | Sphere: a transition on two custom properties. Cards: a view transition, each card keeps its own name |
| Opening a card | The card grows into the drawer: its title and rank numeral travel to the drawer header | View transition with shared names on title and numeral |
| An answer arrives | Cited cards light in sequence, 60ms apart, warm edge sweeping once | Staggered transition delay |
| Sections entering | Rise 12px and fade in, once | View-timeline animation, runs once |
| Sticky bar | Slides down as the hero leaves | Scroll-driven |

Timing: 180ms for small state changes, 320ms for cards and the bar, 480ms for the drawer morph.
Easing is a soft spring feel: fast start, gentle settle, no bounce on anything that carries data.

Reduced motion: every effect above becomes an instant change or a plain fade. Parallax and the
sphere pulse are off. Nothing on the page depends on motion to be understood.
Browsers without these features get the same page, static.

## Components

- **Habitat choice card**: name in display type, readout line with oxygen and pressure, one
  sentence. Selected: accent ring, filled dot, and the leader line attaches to it.
- **Takeaway card**: statement type, optional count picture, "How we know".
- **Experiment card**: rank numeral (display, large, muted), name, safety tag, one summary
  sentence, oxygen bar with marker, five marks, one reason line.
- **Oxygen bar**: track in depth blue, tested span in match green when it covers the habitat
  and in muted when it does not, marker in accent with the value above it.
- **Factor mark**: filled, half, empty, dashed ring for not on record.
- **Pill button**: off-white fill, dark mono capitals, arrow. One per view.
- **Source disclosure**: quiet text button; opens a quote with a left rule in flame colour.
- **Drawer**: right panel with material, porthole radius on its left corners.

## Imagery

Four SI-generated illustrations, and no others: the hero flame sphere and one window view per
habitat (station, Moon surface, rover cabin). Files are in `public/img/`. Made with Higgsfield
(GPT Image 2).

Rules, from the Space Apps Project Submission Guide:

- Every generated image carries a visible mark. Each file has "SI-GENERATED IMAGE" baked into its
  corner, and the page repeats the mark in HTML (`SiMark`) because crops can hide the baked one.
  Keep both when reusing an image in the deck.
- No NASA logos, flags, patches or mission names in any generated image. Check each new output
  by eye before it ships.
- They are decoration. Anything that shows evidence (bars, counts, tables, quotes) stays code and
  NASA data. Real NASA photographs are never mixed in unlabelled next to generated ones.
- The footer says the four pictures are illustrations, not NASA photographs.
- The "Use of SI" field on the project page must list Higgsfield and these four images.

The porthole glass stays dark in light mode too (`--glass-*` tokens): it looks out into space.
