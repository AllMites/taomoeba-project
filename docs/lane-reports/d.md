# Lane D report: Fire FX + SAFFIRE replay

Files (all inside the lane's paths): `src/fx/` (index.tsx, look.ts + look.test.ts, materials.ts, palette.ts),
`src/scenes/saffire/` (index.tsx, SaffireScene.tsx, World.tsx, set.ts + set.test.ts, timeline.ts + timeline.test.ts,
paint.ts, saffire.css), `public/data/scenes/saffire.json`, `public/img/scenes/saffire.webp`, `docs/lane-reports/d/`.
No new dependencies. Nothing outside the lane touched. `public/models/saffire/` and `scripts/models/saffire/` are
unused: the set is built in code (see "Set").

## What works

- **`Flame`** (contract `FlameProps` unchanged): two shader spheres, additive, no post-processing. Shell shaded by
  facing angle, so the blue (`#3D7BFF`) is brightest at the edge; pale core; faint orange soot band; soft halo; no
  plume. Airflow stretches the downstream half (+x) and blunts the upstream half. `calm` freezes shader time and turns
  flicker off. A dim blue point light lets nearby surfaces pick up the flame. Shared geometry for every flame.
- **`FlameFront`** (new export): a line of flame burning along a flat sample, with the char trail behind it (dark
  mottled char, warm ember band at the front). Props: `length`, `width`, `front` (metres), `o2Percent`,
  `pressureKPa`, `airflowCmS`, `intensity` (0..1 for ignition and burnout), `calm`. Draws flame and char only; the
  scene draws the unburnt sheet.
- **`flameLook(o2, kPa)`** in `src/fx/look.ts`: the one mapping from air to drawn size and brightness, marked as an
  illustration in its code comment and in the scene caption. More oxygen: tighter and brighter. Less pressure: larger
  and dimmer. 1 / 1 at 21 % and 101.3 kPa, clamped (size 0.6..1.6, brightness 0.25..2.5), unlit at 0. 6 unit tests.
  `leanFromAirflow(cm/s)` sets the lean (0.6 at 20 cm/s, cap 1.5). Lane G can import both from `src/fx/index.tsx`.
- **SAFFIRE scene** (`SceneModule` default export): title "A real fire inside a cargo spacecraft"; caption "A fabric
  strip from SAFFIRE-II burns inside a Cygnus cargo ship; its spread and timing come from the run table, its look is
  illustrative." Fills its parent, owns its `<Canvas>`.
  - Moving: opens on the module and the flow unit, pushes in low over the window while the igniter runs (about
    3 s), then holds a raised 3/4 view: the flame low in frame, the cargo-lined module running away above the flow unit. Loops: igniter
    9.2 s, burn 145 s, hold 25 s (record seconds), played at 10x. Replay and Pause/Play buttons.
  - `calm`: no camera move, one still frame at mid-burn (72.5 s), no loop, flicker off; a "Play once" button.
  - Poster `public/img/scenes/saffire.webp` (1280x720, 30.1 KB, our own render of the calm frame) replaces the canvas
    when WebGL is unavailable or the context is lost. Both paths tested (see Verified).
  - Pauses rendering when off screen (IntersectionObserver); `frameloop="demand"` when paused or calm.
- **HUD** (DOM over the canvas): experiment name and sample, Oxygen %, Air flow cm/s, Pressure (Not on record),
  Time s of 145 s, Flame front cm of 29 cm, phase line (igniter / spreading / out), speed line. Numbers use
  `t-readout`. Updates only when a shown number changes.
- **Callouts** (at most 2): each a leader line from a projected 3D anchor to a box with one SI-written sentence from
  `claims.json` and a source chip (source title, id small). 1) `clm:PSI-99:summary`, anchored to the sample card.
  2) the habitat's `clm:brief:<habitat>:saffire-gravity` takeaway (same text for all three), anchored to the silicone
  strips. Text and titles are read from `claims.json` / `sources.json` through `useDataset`, never copied.
  Phone width: one note at a time, with 1 / 2 buttons.
- **Styling**: colours from `--glass-*` tokens only (the canvas is always dark, and these stay dark in light mode),
  spacing 4/8/16/24/32 (`--space-1/2/4/5/6`), 44 px buttons, 12 px minimum text, focus ring `--glass-accent`, no
  underlines, no borders-plus-shadows. Words: "experiment", no "AI", no "according to NASA", sentences under 25 words.

## Data: every number and its source

All from `public/data/runs/PSI-99.json` (source `psi:PSI-99`, SAFFIRE-II), row `sample_number` 2-5, copied into
`public/data/scenes/saffire.json`. `timeline.test.ts` checks each value against the run table row.

| Shown / used | Value | Column | Note |
|---|---|---|---|
| Material | Cotton-Fiberglass (SIBAL) | material | |
| Flow direction | Concurrent | flow_direction | flame spreads with the flow |
| Oxygen | 22.1 % | o2_percent | table note 1: derived from measured CO2 production |
| Air flow | 20 cm/s | airflow_cm_s | |
| Sample length | 29 cm | sample_length | |
| Sample width | 5 cm | sample_width_cm | |
| Spread rate | 2.1 mm/s | microgravity_spread_length | column says "spread length" but the value is in mm/s |
| Burn length | 29 cm | microgravity_burn_length | |
| Burn time | 145 s | burn_time_s | |
| Ignition power | 80 W | ignition_power_w | shown in the igniter phase line |
| Ignition time | 9.2 s | ignition_time_s | igniter phase length |
| Pressure | **Not on record** | none | no column; `investigations.json` pressureRange null. Flame drawn at the stated default 101.3 kPa |
| Other 8 samples | material and microgravity burn length per sample | material, microgravity_burn_length | drawn as neighbour strips; silicone 2-1..2-4 "~ 0" |

**Flame-front position** = min(29 cm, 0.21 cm/s x burn clock). It reaches 29 cm at 138 s, inside the recorded 145 s;
the flame fades between 138 s and 145 s and is out at 145 s.

Stated defaults (not data, not shown as data): the burn clock starts when the igniter stops (whether the 145 s
includes the 9.2 s ignition is not on record); flame growth over the first 4 s; sample layout on the card (not on
record; side by side, sample-number order); playback speed 10x; hold 25 s.

## Set

Built in code (`set.ts`), not a GLB: 7,388 triangles for the set (test-checked < 95k), about 11.3k with one flame
front. Merged into 2 meshes. Materials: 2 for the set (vertex colours, lit and glowing), 3 for the flame front
(shell, halo, char), 1 for the igniter glow during ignition: 6 of 8. Textures: 0. Model download: 0 MB.

Sizes are set geometry, stylized, and never shown as data: flow unit 90 x 53 x 133 cm (Saffire IV-VI module, NTRS
20170002628, from the X10 practice notes); card frame 40.6 x 94 cm (SAFFIRE-I sample size, `runs/PSI-98.json`);
SAFFIRE-II strips 29 x 5 cm (`runs/PSI-99.json`); module inner radius 1.45 m, 6.4 m long (stylized estimate).
Interior near-black, orange only on floor strips and placards. Pre-event X10 scripts were read, not copied.

## Credits and licences (for CREDITS.md)

- SAFFIRE scene set, flame shaders and poster: original work by the team during the event, procedural three.js code.
  No third-party models, textures or images. Poster is a render of our own scene, not a NASA photograph and not
  SI-generated.
- Data: NASA PSI investigation records and run tables, CC0 1.0 (as already listed for `psi:*` sources).
- Libraries already in the project: three (MIT), @react-three/fiber (MIT).

## Chunk sizes (`npm run build`)

The app does not import the scene registry yet, so `npm run build` output is unchanged by this lane: main JS 350.42 kB
(gzip 106.45 kB), same as before. three.js is not in the main bundle. To size the scene chunks I built the dev
harness entry once with a throwaway config (deleted, not committed):

| Chunk | Raw | Gzip |
|---|---|---|
| `saffire-*.js` (scene + fx + zod contracts it pulls in) | 115.53 kB | 34.88 kB |
| `saffire-*.css` | 3.96 kB | 1.10 kB |
| `react-three-fiber.esm-*.js` (three + R3F, shared with lunar) | 918.35 kB | 242.60 kB |

In the real page zod and the contracts already live in the main bundle, so the saffire chunk should shrink.

## Verified

Own headless Chromium (Playwright 1.66 driving its bundled Chromium 149, own profile) against my own
`vite --port 5147` dev server, stopped afterwards. Scripts lived in the session scratchpad, not the repo.

- **Software WebGL** (`--use-angle=swiftshader --enable-unsafe-swiftshader`): a full pass at 1440x900 and 375x812
  (start, mid, end, calm) ran clean with no page errors, while tuning the look. The final screenshot set below was
  captured with the real GPU (`--use-angle=d3d11`), because SwiftShader was too slow to reach mid-burn in reasonable
  time once the camera came in close.
- **WebGL off** (`--disable-webgl --disable-3d-apis`): no canvas, poster shown (1280 px, alt text set), HUD frozen at
  mid-burn to match the poster. **Context lost** mid-replay (`WEBGL_lose_context`): poster replaces the canvas.
- No horizontal scroll at either width (scrollWidth = viewport width). Keyboard: first Tab lands on the replay
  control, 44 px tall, 3 px `--glass-accent` outline.
- Console: one 404 on the harness page load, not from this lane's files (no request from the scene failed when
  logged by URL; most likely the harness favicon). A `THREE.Clock` deprecation warning comes from R3F itself.
- `npm run gate` green: tsc, vitest (lane tests: 6 flame mapping, 7 data and timeline, 1 set budget), vite build,
  pytest.

**Frame rate, measured** (requestAnimationFrame count over 5 s while the replay plays, headless Chromium with
`--use-angle=d3d11`, renderer string read from `WEBGL_debug_renderer_info`: NVIDIA GeForce RTX 5070 Ti, D3D11):

| View | Canvas pixels | FPS | Worst frame |
|---|---|---|---|
| 1440x900 | 1408x720 | 179.9 | 7.0 ms |
| 375x812, DPR 3 (capped to 1.75 by the scene) | 600x750 | 178.4 | 7.0 ms |
| same, CPU throttled 4x via CDP | 600x750 | 142.2 | 21.8 ms |

Not measured: a real phone GPU. The desktop numbers say nothing about a phone's fill rate; the overdraw cost is the
two additive halo spheres. If a phone drops under 30 fps, the first lever is the halo sphere (32x16) and DPR.

Screenshots (`docs/lane-reports/d/`), looked at one by one:

| File | What |
|---|---|
| `1440-start.png`, `375-start.png` | 4 to 5 s into the burn, push-in under way: module, flow unit, strips |
| `1440-mid.png`, `375-mid.png` | 70 s: front at 14.8 cm, both callouts (one on phone), char behind the flame |
| `1440-end.png`, `375-end.png` | 145 s: flame out, strip charred end to end, 29 / 29 cm |
| `1440-calm.png`, `375-calm.png` | `calm=1`: still frame at 72 s, "Play once" |
| `1440-no-webgl.png` | WebGL off: poster plus HUD at mid-burn |

## Stubbed / not done

- `public/models/saffire/` and `scripts/models/saffire/`: not used (procedural set).
- The scene does not change with the habitat, except which (identical) takeaway claim id it reads. The habitat's own
  air is Lane G's scene.
- Leader dots can sit on the outside of the box during the opening push-in (anchors are inside it); they land on the
  card and the silicone strips once the camera settles.

## For the integrator / open taste questions

1. `FlameFront` is a new export beside `Flame`; `FlameProps` is unchanged.
2. Set and flame paint are hex values in `src/fx/palette.ts` and `src/scenes/saffire/paint.ts` (shader and vertex
   colours, which CSS tokens cannot reach). The DOM uses tokens only. OK, or should the scene read tokens at runtime?
3. The scene box gets `border-radius: var(--radius-2)` from its own CSS; drop it if the Replay section frames it.
4. The real SIBAL flames in the SAFFIRE videos are bright yellow-orange; the art direction asks for the blue
   microgravity look. The caption says the look is illustrative. Keep blue, or warm the front flame?
5. Opening push-in (moving only) vs. a fixed close view from the first frame.
6. Callout 2 is the silicone takeaway (about 0 cm burned in microgravity). Alternative: no second callout.

## Review fixes (reviewer, after the lane)

- Status line under the HUD now describes the frame on screen (`statusLine` in `timeline.ts`, tested): after
  "Play once" ends it reads "Still frame, burn over", not "mid-burn"; a paused replay reads "Paused".
- Still frames (calm or paused) redraw the leader line when another note is picked on a phone; before, the new
  note had no leader until the next frame. Browser-checked; not unit-testable without a GPU.
- `FlameFront` keeps its point light, and the scene keeps its igniter mesh, mounted and only hides them. Before,
  each ignition and burnout changed the light count and relinked the lit set shader (one extra link per loop,
  measured); now zero. Not unit-testable without a GPU.
- Set reads as a spacecraft on desktop: the held view sits higher and looks down the module (cargo stacks, deck,
  far end) above the flow unit; ceiling lights 5 -> 12 cd, fog starts at 3.5 m instead of 2 m. Phone pose unchanged.
  Screenshots and poster retaken. Overlay contrast re-measured over one loop: muted text at least 5.2:1 (375 wide).
- Measured with the harness built as a second entry: main and base chunks hold no three.js or fx code;
  `saffire-*.js` 24.7 kB (9.1 kB gzip) when zod is shared; three + R3F chunk 918 kB (242.5 kB gzip).
