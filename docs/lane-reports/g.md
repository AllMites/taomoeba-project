# Lane G: Your habitat (lunar scene)

Branch `claude/lane-g`. Scene id `lunar`, title "Your habitat".

## What works

- `src/scenes/lunar/index.tsx` exports the real `SceneModule`. The component fills its parent box, owns its `<Canvas>`, and reads only `habitat` and `calm`.
- **Framing by habitat:**
  - `moon` frames the HDU, with the rover parked left and the astronaut for scale.
  - `rover` frames the SEV, with the HDU behind it.
  - `iss` loads no models and shows one flame on a dark backdrop. iss_b was not used: it is half scale with stray parts.
- **Look:**
  - Procedural regolith: noise, bowl craters with rims, and a far ridge that hides the mesh edge. Flat pads sit under the models, the cameras and the lines of sight.
  - Low sun at 7°, behind and left, with shadows. A cool camera-side fill (`#b9c8ee`) and a faint hemisphere light keep the habitat readable.
  - An Earth crescent (shader, parked on the camera) on wide boxes only. Two orange beacons, on the HDU dome and the SEV antenna.
  - Camera at 1.4 m (moon) or 1.0 m (rover) above the local ground. Long lens: 20° vertical on wide boxes, 28° on narrow ones.
  - Slow lateral dolly: ±3 m over 70 s.
- **Comparison:**
  - Two `Flame`s from `src/fx/index.tsx`, used only through their props: same `size`, same `airflowCmS` (3), and each side's `o2Percent` and `pressureKPa`.
  - Left is ISS air, read from `/data/habitats.json`. Right is the picked habitat, read from the prop.
  - Labels and readouts are DOM ("ISS air / 21% oxygen / 101.3 kPa").
  - Each flame is drawn in its own scene and camera, centred on a measured DOM slot, so the labels always line up.
  - An ISS pick, or any habitat with the same air, shows one flame and says why.
  - A missing value shows "Not on record" in muted text, and that side draws no flame.
- **Limits line:** "Illustration, not a simulation. No fire experiment on record ran in Moon gravity." It is persistent DOM, top left over empty sky, and stays in every state, including the poster fallback.
- **`calm`:** `frameloop="demand"`, no dolly, no beacon pulse, `calm` passed to `Flame`.
- **Offscreen:** the loop also drops to demand when the scene is off screen (IntersectionObserver).
- **Fallback:**
  - When WebGL is missing, the context is lost, or a model fails to load, the scene shows `public/img/scenes/lunar-<shot>.webp` (`lunar-<shot>-narrow.webp` in a box under 640 px), the readouts, and a CSS still flame per side.
  - After a context loss the scene tries the 3D view again when the tab becomes visible.
  - The CSS flame is tighter and brighter at higher oxygen, with colours from the `--sphere-*` tokens.
  - Checked with `--disable-webgl`: see `g/moon-nowebgl-*.png`.
- **Unmount:** the models' geometry, materials and textures are disposed, their `useGLTF` cache entries cleared and the Draco workers terminated. The release waits one task (`hold.ts`), so a StrictMode remount keeps them. The ground, beacon and Earth resources are disposed too.
- **Shadows:** PCF, drawn once per change (`shadowMap.autoUpdate = false`), since only the camera moves.
- **Overlay rules:**
  - Colours come from `--glass-*` and `--sphere-*` tokens only. The scene stays dark in light mode, as the porthole does.
  - `t-readout` for numbers. Spacing uses 4/8/16/24/32 only. Text is 12 px minimum.
  - There are no controls, so no tap targets or focus states apply.
  - The canvas is `aria-hidden`, and its wrapper is `role="img"` with a plain description.
- `src/scenes/lunar/copy.test.ts` (5 tests) covers:
  - word counts and banned words
  - numbers read from the prop, never fixed
  - one flame for ISS
  - "Not on record"

## Stubbed or waiting

- **Flame:** the scene shows Lane D's placeholder (blue spheres) until D lands. Nothing in this lane changes when it does.
  - The flame camera is passed to the portal (`createPortal(..., { camera })`), so a billboard shader in `Flame` faces the right camera.
  - Flames sit 1 m from that camera, with `size` about 0.05 to 0.07 m.
- **Fallback flames:** the CSS still flame in the fallback is a stand-in drawn by this lane, not D's look.

## Asset pipeline

One entry point: `sh scripts/models/lunar/build.sh RAW_DIR`. Set `BLENDER` if Blender is not on PATH. It needs Blender 5.x and `npx @gltf-transform/cli@4.5.1`.

1. `build.py` (Blender, headless):
   - **HDU:** parts 1 and 2 imported together in their shared frame, scaled ×0.0254 (inches to metres).
   - **SEV:** welded on import, then collapse-decimated from 413,038 to 40,000 triangles. Only the colour map is kept; the bump and specular maps are dropped.
   - **Astronaut:** scaled to 1.85 m. The arms are dropped 72° by rotating vertices about each shoulder with a smooth ramp; the model has no rig.
   - **Every model:** pivot at the bottom centre, and matte opaque materials (no transmission or specular extension, which would cost an extra render pass in three.js).
   - **Logo repaint:** the NASA insignia (large and small), US flags, X-Hab logos and HDU badges on HDU_01 become blank panel. So do the backpack flag, NASA insignia, mission patch and sleeve flag on the astronaut texture. Each rectangle is filled row by row with a blend between its left and right neighbours, which keeps the panel seams.
   - The repainted file is loaded as a new image, because the exporter otherwise writes the packed originals. The finished textures were extracted from the shipped GLBs and checked by eye.
2. `gltf-transform optimize`: Draco, WebP, texture size 1024 (HDU, SEV) or 512 (astronaut), no extra simplify, prune.
3. The Draco decoder (`draco_decoder.wasm`, `draco_wasm_wrapper.js`) is copied from `three` into `public/models/lunar/draco/`, so there is no CDN at runtime.

Other scripts:
- `scripts/models/lunar/shots.cjs`: screenshots, posters (`?poster` dev-only flag hides the overlay and flames), the no-WebGL check, and the fps probe.

No pre-event script or output was copied. The X10 notes were read for scale, weld and lighting lessons. The scripts are new.

## Models (for CREDITS.md)

Source: NASA 3D Resources (https://science.nasa.gov/3d-resources/). The collection says models are "free to download and use" under the NASA Images and Media Usage Guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/). No per-model licence is stated. NASA insignia and flags were removed (see the pipeline above).

| File | Source download | Size | Triangles | Textures | Materials |
|---|---|---|---|---|---|
| `hdu.glb` | Habitat Demonstration Unit (part 1) + (part 2) GLB, `assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/habitat-demonstration-unit/` | 120,188 B | 6,584 | 2 × 1024 WebP | 2 |
| `sev.glb` | Space Exploration Vehicle GLB, `.../model/space-exploration-vehicle/Space%20Exploration%20Vehicle.glb` | 665,624 B | 39,995 | 1 × 1024 WebP | 1 |
| `astronaut.glb` | Astronaut GLB, `.../model/astronaut/Astronaut.glb` | 64,676 B | 6,379 | 512 + 128 WebP | 2 |
| `draco/` | three.js (MIT) Draco glTF decoder | 250,876 B | | | |

Measured sizes in metres (glTF x × y-up × z):
- HDU: 16.67 × 5.83 × 11.65, including the deck and stairs.
- SEV: 4.05 × 3.97 × 5.92.
- Astronaut: 1.00 × 1.85 × 0.69, with arms down.

**Budget:**

| Budget item | Used | Limit |
|---|---|---|
| Models | 850,488 B (0.85 MB) | 1.5 MB |
| Draco decoder (extra to models) | 0.25 MB | |
| Textures | 5 | 6 |
| Materials | 8 (HDU 2, SEV 1, astronaut 2, regolith, beacon, Earth) | 8 |
| Triangles | about 89k | 100k |

Triangle total: models 52,958, regolith 33,800, Earth 2,208, beacons about 350. The total is before D's flames, and so are the material counts.

Posters:
- `lunar-moon-narrow.webp` (672×842, phone framing): 8,014 B
- `lunar-rover-narrow.webp`: 15,268 B
- `lunar-moon.webp`: 24,744 B
- `lunar-rover.webp`: 31,168 B
- `lunar-iss.webp`: 2,296 B

## Build

- `npm run gate`: green. tsc passes, vitest has 124 passed and 1 skipped, vite build passes, and pytest has 68 passed and 9 skipped.
- The app build (`index.html`) does not import the registry yet, so its chunks are unchanged: `index-*.js` is 350.42 kB (106.45 kB gzip).
- A side build with `scenes.html` added as an input, from a temporary config outside the repo, shows three.js and the models stay in lazy chunks:

| Chunk | Size | Gzip |
|---|---|---|
| `lunar-*.js` (includes GLTFLoader and DRACOLoader) | 85.24 kB | 26.90 kB |
| `lunar-*.css` | 2.27 kB | |
| `react-three-fiber.esm-*.js` (three, shared with saffire) | 921.63 kB | 243.87 kB |
| `main-*.js` | 129.92 kB | 37.88 kB |
| `base-*.js` (React) | 220.08 kB | 68.84 kB |

The models are fetched only when the scene mounts.

## Screenshots (`docs/lane-reports/g/`)

Captured by `shots.cjs` in its own headless Chromium (Playwright 1.5x with chromium-1228, a fresh `--user-data-dir`, `--use-angle=swiftshader --enable-unsafe-swiftshader`) against its own `vite --port 5237`. The server was stopped after the run.

- `moon-desk.png`, `moon-phone.png`
- `rover-desk.png`, `rover-phone.png`
- `iss-desk.png`, `iss-phone.png`
- `moon-calm-desk.png`, `moon-calm-phone.png`
- `moon-nowebgl-desk.png`, `moon-nowebgl-phone.png`

Desk is 1440×900; phone is 375×812.

Fixed after looking:
1. NASA insignia and flags were still on the HDU, because the exporter reused the packed original.
2. A terrain swell hid the rover. Pads were added on the lines of sight, and the eye height is now relative to the ground.
3. The Earth was unlit, then overlapped the phone readouts. It is hidden on narrow boxes.
4. The HDU beacon floated; it now sits on the model's highest point.
5. The phone subject sat under the readouts; it was moved lower.

## Frame rate (measured)

Method: `node scripts/models/lunar/shots.cjs <url> <out> fps`. It times `requestAnimationFrame` for 5 s on `habitat=moon&calm=0` after a 6 s settle, at DPR 1.

| Renderer | Box | Mean fps | p95 frame time |
|---|---|---|---|
| Real GPU: headless Chromium, ANGLE D3D11, NVIDIA RTX 5070 Ti | 1440×900 | 177.7 | 6.4 ms |
| Real GPU: headless Chromium, ANGLE D3D11, NVIDIA RTX 5070 Ti | 375×812 | 177.8 | 6.4 ms |
| SwiftShader (CPU) | 1440×900 | 15.5 | |
| SwiftShader (CPU) | 375×812 | 48.8 | |

The identical GPU numbers suggest headless pacing caps the rate, so read them as a floor.

Not measured: a real phone. The 30 fps phone budget is unverified. If it misses, the first levers are:
- turn shadows off on narrow boxes
- cut the regolith grid from 130 to 96 segments
- set DPR 1 on narrow boxes

## For the integrator

- **Draco decoder:** it is self-hosted under `public/models/lunar/draco/`. If Lane D also uses Draco, point both at one copy, for example `public/models/draco/`. That path is outside my lane.
- **ISS reference air:** the left flame fetches `/data/habitats.json` to read ISS air, because `SceneProps` carries only the picked habitat.
  - An optional `reference?: HabitatPreset` in `SceneProps` would remove that fetch. That is a contract decision.
  - Until then, the left side reads "Not on record" for a moment while the file loads.
- **Box size:** the scene assumes the harness box (16:9 wide, 4:5 phone). It switches framing at aspect 1.2 and overlay layout at a 640 px container width. A very short box would crowd the overlays.

## Open taste questions

1. **Lighting:** the cheated cool fill (current) or a truer, darker backlit look? The fill is 1.2 against the sun's 4.8.
2. **Earth:** keep it on wide boxes? It is a stylised crescent with soft clouds, not a photo.
3. **Rover shot:** the HDU behind the rover adds context but competes with the SEV. Keep it, or swing the camera so the rover is alone?
4. **Airflow:** both flames get 3 cm/s, and the number is not shown on screen. Should the line name it?
5. **Station pick:** the line reads "its air is the reference". Would a judge rather see the Moon Base comparison by default there?

## Review fixes (review fix lane G commits)

- StrictMode ran the model cleanup on mount: models were disposed and their cache cleared while on screen, so every later re-render (scrolling the scene out and back) refetched and re-decoded all three. Fixed with a deferred, counted release (`hold.ts`, tested).
- A model that failed to load blanked the whole React root. `LoadGuard` now catches it and the scene shows its poster.
- The Draco worker pool was never terminated. It is now, on the last unmount.
- A failed ISS fetch was cached for the whole visit ("Not on record" until reload). It now retries on the next mount (`iss.test.ts`).
- No-WebGL fallback on a phone: the cropped wide poster put the habitat under the readouts (contrast 1.6:1 to 3.1:1). Portrait posters with the phone framing fix it (17.6:1 measured).
- The limits line said weightless and Earth-gravity results "bracket" Moon gravity, which the record does not show. "Same flame size" contradicted two different-size flames. Both reworded (`copy.test.ts`).
- Shadows: `shadows` asked for PCFSoftShadowMap, which three r187 removed (console warning). It now asks for PCF, and the shadow map is static: draw calls fell from 496 to 363 per 2 s (SwiftShader, 1440×900).
- The render loop no longer allocates vectors per frame.
