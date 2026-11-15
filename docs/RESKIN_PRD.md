# Reskin PRD: one-screen mission console

Status: **draft for tonight's reframe.** Options are open where marked; **Rec** is the default if nobody picks.
Supersedes `docs/PAGE_PLAN.md` (one long page) once approved. Locked features in `docs/FEATURES.md` still hold.

References: `docs/reskin-refs/canva-board.jpg` (team Canva: Formless glass flowers, IT Empire, HSR-style
backdrop, note "use NASA 3D models"), `docs/reskin-refs/it-empire.jpg` (layout model).

## 1. Why

The site works but reads as one 16.7-screen page (29 on phone) with no navigation. Teammate feedback:
"messy, all the info in one page." The reskin is for organization and first impression, not new features.

## 2. The idea in one line

One screen. The replay is the center: the picked base's fire, live in 3D. The required dashboard (summarize, rank,
interpret) sits on it as glass and is never more than zero clicks away. Library on the left, SI chat on the right.

## 3. Layout (desktop)

```
┌───────────────────────────────────────────────────────────────────────┐
│ FIREBREAK                                [Interpret Rank Compare Models]│  top bar
├──────┬────────────────────────────────────────────────────┬───────────┤
│ rail │  ‹ ISS · [MOON BASE] · ROVER ›   ← base carousel   │           │
│  ◎   │                                                    │  ASK SI   │
│  ▤   │        REPLAY (center, always running)             │  (panel,  │
│  ✦   │   the picked base's flame in 3D, cinematic         │  closable)│
│      │   Saffire past ⇄ this base now                     │           │
│      │                                     ┌────────────┐ │  drop     │
│ LIB  │  brief: 1 line + source             │ TOP FOR    │ │  cards    │
│ panel│  "At 30% O2 flames spread faster…"  │ MOON BASE  │ │  here     │
│(open)│                                     │ 1 FLEX-2   │ │           │
│      │                                     │ 2 BASS-II  │ │           │
│      │                                     │ 3 SAFFIRE  │ │           │
│      │                                     │ See all →  │ │           │
│      │                                     └────────────┘ │           │
├──────┴────────────────────────────────────────────────────┴───────────┤
│ status strip: habitat · O2 · pressure · sources checked · model       │
└───────────────────────────────────────────────────────────────────────┘
```

| Zone | What it holds | Locked features it carries |
|---|---|---|
| Left rail (icons) | Toggles between center views and opens the left panel. Taken from the IT Empire side icons. | — |
| Left panel: **Library** | The RAG database made visible: sources and experiments, search, filters Prevention / Detection / Suppression, and per answer the pipeline steps (BM25 search, rerank, TypeSafe check, Haiku write). Cards drag into the chat. | RAG, TypeSafe, Anthropic |
| Center: **Replay** | The main attraction. The base carousel (ISS, Moon Base, Pressurized rover) sits on top; the picked base's fire replay runs below it, cinematic: camera drift, depth fog, bloom. Past (Saffire) and now (this base) toggle. | 3D lanes |
| Over the replay: **Top for this base** | The required part, always visible: top 3 ranked experiments with score and one-line summary, plus a one-line interpretation with its source. "See all" opens the Rank sheet. Updates the moment a base is picked. | Dashboard (summarize, rank, interpret) |
| Right panel: **Ask SI** | Today's chat panel moved here. Accepts dragged cards as context ("ask about this"). | Anthropic, RAG |
| Top nav | Center views: Interpret (brief), Rank (list), Compare, Team models (what-if). Each opens as a glass sheet over the stage, the stage dims behind it. Hover or focus shows a one-line description. | Dashboard, CatBoost |
| Status strip | Habitat, O2 %, pressure kPa, time, sources checked. The IT Empire "Time / Temp / Energy" row, filled with real readouts. | — |

Phone: stage full screen; Library and Ask SI become bottom sheets; nav becomes a chip row. Details in §8.

## 4. Flow

1. Land on the replay. The default base is Moon Base, and its flame is already burning in the center. The
   top 3 experiments and the brief line are visible in the first frame, from a poster until the 3D loads.
2. Pick a base (click, swipe or arrow keys). The replay cross-fades to that base's flame, the top 3 and the
   brief re-run, and the status strip updates. The carousel never advances by itself, because every pick
   re-ranks.
3. From there, any of:
   - **See all / top nav** sheets: Interpret, Rank, Compare, Team models.
   - **Library** (left) to browse sources; drag one to **Ask SI** (right).
   - **Past ⇄ now** toggle on the replay.

## 5. Decision: Replay as the main attraction vs the guidelines

Sav's idea: pick a base, go straight into the replay, and make the replay the main attraction. It isn't
in the guidelines. Weighing it:

- The challenge's core objective is a dashboard that **summarizes, ranks and interprets** investigations.
  Relevance is judged on how directly we do that with NASA data at the core.
- The five criteria are weighted equally and none can be traded away. 3D lifts **Creativity** and
  **Presentation**, and the 30 s video is judged first.
- It costs **Relevance** if the ranking hides behind a cutscene, and **Validity** ("usable,
  user-friendly") if the first click is a long load.

| Option | What a judge sees first | Creativity / Presentation | Relevance / Validity |
|---|---|---|---|
| **A. 3D stage as the hub, dashboard on top (Rec)** | The base carousel over a live 3D backdrop. Picking a base re-ranks immediately; Rank and Interpret are one click away as glass sheets; Replay is a button. | High: the 3D is the first frame and the video's hero shot | Kept: the ranking reacts to the pick at once and is never behind the cutscene |
| B. Pick → replay → dashboard | A cinematic replay after the pick, then the dashboard | Highest | Risk: the core objective comes after a cutscene; slow on weak laptops |
| C. Dashboard first, replay as a separate module | Today's dashboard, reorganized; 3D on its own page | Low | Safest |

**Decided (Daniel): replay central, required first.** A blend of A and B:
- The replay is the center and always runs. It is not behind a button.
- The required summarize, rank and interpret results sit over it in the first frame and re-run on every pick, so nothing judged waits behind a cutscene.
- If the replay and a required element compete for space or load time, the required element wins:
  - the top 3 and brief render from data before any 3D;
  - the 3D streams in after them;
  - without WebGL, the replay falls back to a poster and the top 3 still show.

## 6. Visual direction

**Mono, dark, transparent.** Modelled on the IT Empire reference: warm near-black, bone-white type, smoked-glass
panels, one solid white pill for the main action. The UI has **no hue at all**. The only colour on screen is
the fire in the replay, so nothing in the interface competes with it.

Not this: neon cyan or magenta, glowing borders, gradient text, scanlines, HUD corner brackets on every box,
or a grid overlay. The reference keeps its corner ticks to one frame (the hero); we do the same, around the replay only.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--space` | `#0b0b0a` | Page, behind the 3D | — |
| `--glass` | `rgba(14,14,13,0.72)` + `backdrop-filter: blur(20px) saturate(120%)` | Panels, sheets, the top-3 card | Composites to about `#1a1a18` even over the brightest replay frame |
| `--glass-hi` | `rgba(255,255,255,0.06)` | Hover, selected row | — |
| `--line` | `rgba(255,255,255,0.10)` | Hairlines, panel borders | — |
| `--line-strong` | `rgba(255,255,255,0.24)` | Focus ring base, selected card border | — |
| `--text` | `#ecebe6` | Body, headings | 16.5:1 on space, 14.6:1 on glass |
| `--muted` | `#a3a19b` | Secondary text, units | 7.6:1 on space, 6.8:1 on glass |
| `--label` | `#85837d` | Small mono capitals only | 5.2:1 on space, 4.6:1 on glass. Never on bare 3D |
| `--primary` | `#f2f1ed` fill, `#0b0b0a` text | The one solid pill: Ask SI, "See all" | 17.4:1 |
| `--focus` | `#ecebe6` 2px ring, 2px offset | Every focusable element | — |
| `--flame` | from `src/fx/palette.ts` | Replay only, plus a 6px dot in the Ask SI pill | 8.5:1 |
| `--in-range` / `--out-range` | `#ecebe6` solid vs `#85837d` dashed | "Inside tested range" vs "extrapolated". Shown by form, not hue | — |

Type: keep what we ship.
- Display: **Archivo** at 125% width, uppercase, tracking +0.04em. This is the IT Empire title look.
- Body: Archivo at normal width.
- Readouts: JetBrains Mono, tabular numbers.
- No new font dependency.

Icons: one outline set (Lucide), 1.5px stroke, colour `--text`. No filled or coloured icons.

Selected state, as on the reference's rail and tabs: white fill with dark icon or text. Unselected: transparent with a `--line` border.

Glass rules:
- Blur only on panels over the 3D.
- Without `backdrop-filter`, or when the viewer prefers reduced transparency, use solid `#161615`.
- No light mode: the console is dark by design.

Canva: the board's colours are now decided here (Daniel, 15 Nov). The Canva file is used for reference only.

## 7. 3D

- **Models (decided).** All from NASA 3D Resources (https://science.nasa.gov/3d-resources/), "free to download
  and use" under the NASA Images and Media Usage Guidelines. Strip insignia and flags with the lunar lane's
  pipeline (`docs/lane-reports/g.md`), and credit each model in `CREDITS.md`.

  | Base | Model | File | Size | Triangles | Why |
  |---|---|---|---|---|---|
  | ISS | International Space Station (ISS) (B) | new: `public/models/iss/iss.glb` | 477 KB, Draco | 174,440, 10 meshes, no textures | Full-detail truss and modules. Untextured grey matches the mono look |
  | ISS, small | ISS (A) | new: `public/models/iss/iss-lo.glb` | 40 KB, Draco | 6,642 | Carousel card and phone, loaded first |
  | Moon Base | Habitat Demonstration Unit + Astronaut | shipped: `lunar/hdu.glb`, `astronaut.glb` | 120 + 65 KB | 6,584 + 6,379 | Already cleaned and in the lunar scene |
  | Pressurized rover | Space Exploration Vehicle | shipped: `lunar/sev.glb` | 666 KB | 39,995 | It is NASA's pressurized rover concept |
  | Earth (bonus) | Shader globe | shipped: `scenes/lunar/world.tsx` Earth material | 0 KB | — | No texture to load, and it stays mono |

  - Download: ISS (B) is at `assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/international-space-station-(iss)-(b)/International%20Space%20Station%20(ISS)%20(B).glb`. Use lowercase `(b)` in the folder and leave the parentheses unencoded; any other form returns an HTML 404 page.
  - Total before the first interaction: 40 KB (ISS small) plus the poster. All models together are about 1.4 MB, well under the 3 MB budget.
- **Carousel.** Four cards on a turntable, built in R3F (already a dependency), DOM labels on top:
  ISS, Moon Base, Pressurized rover, then Earth as a bonus card set slightly apart.
  The center card is larger and lit.
- **Earth card (bonus).**
  - Earth is not a habitat preset: its air (21% O2, 101.3 kPa) matches the ISS, so the ranking uses the ISS
    figures.
  - Picking Earth turns the overlay card into **On Earth**: the Earth applications with sources (today's Earth section), not a top 3.
  - The replay shows a 1 g flame for contrast: a teardrop beside the space sphere.
- **Backdrop.** The picked base's environment behind the carousel: slow camera drift, fog, bloom, star field. It is the same scene the replay uses, so one load serves both.
- **Budget.**
  - Load the first frame from a poster image. Swap in the 3D when it is ready.
  - At most `[ 3 MB ]` of models before first interaction, Draco compressed (already set up).
  - Target 60 fps on an integrated GPU, 30 fps on a phone.
- **Fallbacks.**
  - No WebGL: posters and a 2D carousel.
  - Reduced motion: no drift, instant cross-fade.
  - Both fallbacks exist today in the replay lanes.

## 8. Phone

| Desktop | Phone |
|---|---|
| Stage center | Full screen, carousel swipes |
| Left Library panel | Bottom sheet from a "Library" tab |
| Right Ask SI panel | Bottom sheet from the "Ask SI" button |
| Top nav sheets | Chip row under the top bar; sheets open full screen |
| Status strip | Two lines, under the carousel |

## 9. Drag to chat

- Library cards and ranked experiment cards are draggable into Ask SI.
- A dropped card becomes a chip above the composer ("About: FLEX-2"). It sends that experiment's id with the question, so the answer is scoped to it.
- Keyboard and touch: every card has an "Ask about this" button that does the same. The what-if and Earth sections already do this.
- `/ask` today takes `{ question, habitat?, history? }` only (`server/app.ts:74`). It has no scope field. Options:
  - **Rec:** add an optional `about: InvestigationId[]` that boosts those ids in retrieval. This is one server change, and it needs a test.
  - Or prefix the question text with the experiment name. No server change, but weaker.

## 10. What happens to today's sections

| Today | Goes to |
|---|---|
| Hero porthole + picker | Stage carousel |
| Ask the records box | Removed. Ask SI panel (right) |
| Brief | Interpret sheet |
| Stage (replay) | Center, "Enter replay" |
| Ranking + filter + limits | Rank sheet; limits in its footer |
| Compare | Compare sheet |
| What-if (team models) | Team models sheet |
| Gaps | Rank sheet, "What to test next" tab |
| Earth | Fourth, bonus card in the base carousel; its overlay card shows "On Earth" (§7) |
| Trust (How we know) | Library panel, "How answers are checked" |
| Evidence drawer | Opens from any card over everything, as now |

The feature-lock test must also follow: sections can now hide in sheets, so the test checks that each
one is reachable from the nav, not that it sits in `App.tsx`.

## 11. Out of scope

- New data, new models, new endpoints, except an optional scope field on `/ask`.
- Rockets and propellants, as before.
- Accounts and saved state across devices.

## 12. Success checks

- A first-time user picks a base and reaches a ranked list in ≤ 2 clicks and ≤ 10 s on the
  deploy URL (hallway test, 3 people).
- Every locked feature is reachable from the first screen: the gate test, plus a manual check.
- Lighthouse performance ≥ `[ 70 ]` on desktop with the poster first frame; no WebGL crash in 3 runs.
- Contrast ≥ 4.5:1 for panel text over the brightest backdrop frame.
- The 30 s video can be shot entirely from the live site.

## 13. Build plan (draft, lanes by file set)

Required first: wave 1 alone must ship a judgeable site (pick a base, see ranked and interpreted results,
replay in the center with a poster fallback). Waves 2 and 3 add the cool parts.

| Wave | Lane | Owns | Required? |
|---|---|---|---|
| 1 | S Shell | `App.tsx`, `app.css`, `styles/` (tokens, glass), layout grid, top nav, status strip, sheets | Yes |
| 1 | T Top for this base | `src/top/` (new): top 3 + brief line over the replay, from `rankedFor` / `briefFor` | Yes |
| 1 | M Sheets | Wrap Brief, Ranking, Compare, What-if, Gaps in sheets (markup only); Earth content reused by the Earth card | Yes |
| 2 | K Replay center + carousel | `src/scenes/` (center mount, carousel, cross-fade), reuses saffire + lunar | Central |
| 2 | A Ask panel | `src/ask/`: move to the right panel, drop target, scope chip | Locked feature |
| 3 | L Library panel + rail | `src/library/` (new): sources, filters, pipeline steps | Extra |
| 3 | N NASA models | `public/models/` ISS + rover, `CREDITS.md` | Extra |
| after each wave | V Review + visual audit | Per lane, against this PRD | — |

Wave 1 lanes touch separate files, so they run side by side. K waits for S's center slot.

## 14. Open questions for tonight

1. ~~Replay-first or stage-hub?~~ Decided: replay central, required first (§5).
2. ~~Canva colours?~~ Decided: mono dark glass (§6).
3. ~~Earth?~~ Decided: bonus fourth card in the carousel (§7).
4. ~~Models?~~ Decided: ISS (B) + (A), SEV, HDU, shader Earth. Budget passes (§7).
5. ~~Light mode?~~ Decided: no (§6).
6. Does round 1 of the decision board still apply? Ask SI is now the white pill (§6), not amber. Phone padding, the rover label clip and
   section-link fixes carry over; the structure, nav, carousel and bottom-card cards are replaced by this PRD.

## 15. Replay v2 (Daniel's review of the live site, 15 Nov)

This section replaces the Past / Now toggle and the two-flame comparison of sections 3, 4 and 7. Owner: `src/scenes/` (not `registry.ts`) and `src/fx/`. Read-only imports: `src/whatif/logic.ts`, `src/whatif/load.ts`, `src/solids/logic.ts`, `src/app/console.ts`, `src/app/store.ts`.

What Daniel said: "I'm very confused about what the 3D scene is." "I don't understand the difference between Past and Now." "Can we have a timeline seeker for the playback?" "Make the scene navigable with actual 3D movement." "I'd like the team models applied in the 3D scene, with controls on the side so the data gets rendered live." "Show the fire spreading around combustible objects. Show how a microgravity fire would interact. Label parts of the fire. Hover over an object to see whether it is combustible, with details." "The ISS air and Moon Base air flames look separated. Have the fire actually show in the 3D scene."

### 15.1 Known defect (fix first)

At 1440x900, `?lib=0&ask=0&base=moon` and `base=rover`: the flames are dots about 6px wide above the rover and the habitat, and their label chips float mid-frame, not at the flames. `base=iss` is correct. Add a test that fails on this: each base's flame has a projected size above a floor at 1440x900, and each chip sits near its flame.

### 15.2 The fire is in the scene

- The default view puts the viewer where the fire is: inside the picked base's cabin, with the flame burning on something in the scene. The flame is large and in view at all times.
- The exterior of the habitat, rover or station is the establishing view: the camera may start there and "Reset view" may return to it.
- The side-by-side two-flame comparison is removed. "Compare with station air" is an optional toggle, off by default, that shows a faint second flame at the same spot.

### 15.3 Scene picker and one timeline

- No Past / Now. A scene picker with three named options, each with a one-line description:
  1. "This base: model burn" (default)
  2. "This base: fire spread"
  3. "Real fire: Saffire flight test"
- One playback bar, bottom center, on glass: play and pause, a seeker (`<input type="range">`, keyboard operable, 44px), elapsed and total time in mono, and the phase name. Scrubbing moves the fire in every scene. Saffire uses `src/scenes/saffire/timeline.ts`.
- Both scene modules stay lazy-loaded through `registry.ts`, which is not edited (feature lock).

### 15.4 Navigation

- drei `OrbitControls` in every scene: drag to orbit, wheel or pinch to zoom, right-drag or two-finger drag to pan, with distance and polar limits and damping.
- Camera drift stops for good at the first interaction. A "Reset view" button. A hint chip ("Drag to look around, scroll to zoom") that goes away after the first interaction.
- Keyboard, when the stage has focus: arrow keys orbit, plus and minus zoom. The wheel over the stage never scrolls or zooms the page.

### 15.5 Model burn (team models in the scene)

- A fuel droplet on a holder in the cabin. It shrinks by the d-squared law at the predicted burning rate, and the flame goes out at the extinction diameter the CatBoost model predicts for the picked base's oxygen and pressure. Use `habitatPoint`, `predict`, `burnPlan`, `diameterAt`, `playbackSpeed`, `support`, `describe`; `src/whatif/Burn.tsx` shows the 2D version.
- Side controls on a glass panel at the stage's left edge: fuel, diluent gas and amount, start diameter, with the same option lists as the Team models sheet. A change re-renders the burn at once.
- Live mono readouts: droplet diameter now, predicted burning rate, predicted extinction diameter, time to extinction, and the model's support level (in range, sparse, out of range) by form and a word.
- Where the model has no prediction for the base (`isMoonLike`, and how `WatchBurn` handles it), say so on the panel and show a steady flame with no numbers.

### 15.6 Fire spread

- An interior of the picked base's cabin with a few everyday objects from simple geometry, some combustible and some not: for example cotton cloth, paper checklist, plastic panel, cable insulation, foam pad, aluminium locker, glass window. For Earth, the same cabin at 1 g.
- A flame starts at a marked ignition point and creeps across the combustible objects along the timeline. Burnt area darkens behind the front. Non-combustible objects do not burn.
- Microgravity against 1 g, visibly different: low, rounded, blue-edged flames that hug the surface, no rising plume, spread and smoke that follow the cabin's airflow (drawn as faint arrows and named). At 1 g: tall teardrop flames and rising smoke.
- Real data first. `public/data/solids.json` has BASS-II tests of SIBAL cotton-fiberglass fabric (oxygen, airflow, burned or went out, `minBurnO2`, four findings) and Saffire-II samples in space and on Earth. The cloth is the SIBAL fabric; an airflow control decides whether the flame lives or goes out, following the tests; the Earth contrast uses the Saffire-II rows. What the data does not cover is labelled as illustrative, including spread speed scaled by oxygen.
- Labels on the fire, on glass chips with leader lines: flame front, burnt zone, unburnt fuel, airflow direction.
- Hover, keyboard focus or tap on an object: white outline and a glass detail card with what it is, "Combustible" or "Does not burn" as a word plus a solid or dashed mark, one or two plain sentences on its behaviour in microgravity, and, where the data has a match, the experiment or sample with its source and three buttons: "Open the evidence" (`setSelectedInvestigationId`), "Ask about this" (`askAbout`), "Open Materials" (`setView("materials")`). Ids, names and wording come from `public/data/`; nothing is invented. With no match in the data, the card gives only the general behaviour.
- The same objects are listed as buttons on the side panel, so every card is reachable without a pointer.

### 15.7 Say what the viewer sees

- One caption on glass, top-left, in plain words, that changes with scene and phase. Example: "A heptane droplet burning in Moon Base air (30% oxygen, 70.3 kPa). Size and timing come from the team's model. The flame goes out at 1.8 mm."
- Things in view carry small glass labels. The word "illustration" stays where it is true.

### 15.8 Layout and checks

- Stage controls stay clear of the base carousel (top 96px, center), the brief line (bottom-left, 44ch) and the top-3 card (bottom-right, 320px) at center widths from 600px to 1700px, by container queries on `.stage`. On a phone the side controls collapse behind a "Model" button.
- Tests: seeker time to droplet diameter, the no-prediction case, scene picker to scene, which objects burn, front position at a time, oxygen scaling, object to data lookup.
- Build order, one commit each: 15.1, 15.4, 15.3, 15.5, 15.6, 15.7. Each commit passes `npx tsc --noEmit && npx vitest run && npx vite build` and is checked in a real Chrome with WebGL at 1440x900 and 390x844.

### 15.9 Fire in this base (the default scene)

Daniel, 15 Nov: "I want the 3D replay to literally be integrated with the scene so that you can see the fire spread, see it in the air, or if a fire starts somewhere, how it will damage the structure, what would happen. Illustrative."

This turns the fire spread scene (15.6) into the main thing the replay shows. 15.6 still holds; this adds to it.

- **Default scene for every base**, named "Fire in this base". The model burn becomes the second option ("Lab view: team model burn") and Saffire the third.
- **One story on the one timeline, in five stages**, each with its own caption and a mark on the seeker: 1 Ignition, 2 Spread, 3 Smoke and air, 4 Detection and response, 5 Aftermath. It plays from a preset start point with no input.
- **Pick where it starts.** Two or three combustible objects can be the start point. Click, tap or focus one and press "Start a fire here": the story restarts from that object and the spread path changes.
- **See it in the air.** Smoke and hot gas are drawn as a soft volume that moves with the cabin ventilation. In microgravity it does not rise: it drifts along the airflow and gathers where the flow is weak. At 1 g it rises to the ceiling. A smoke detector sits in the cabin; it trips when smoke reaches it, and the timeline marks "Detected at <t> s".
- **Three controls, no more:** start point, ventilation on or off, and "Compare with Earth" (1 g). What ventilation does must follow the records: read the BASS-II airflow findings in `solids.json`, the `solids-quench-flow` fact and the ACME BRE claims on flames with the airflow off at 21% oxygen and in richer oxygen. Do not write the behaviour from memory or from this paragraph.
- **Damage, shown as what the fire and smoke touched:** burned objects char and darken, objects the smoke reached get a soot tint, objects that do not burn stay as they were. Stage 5 shows an aftermath card with counts from the run, for example "3 of 7 objects burned. Smoke reached the detector at 12 s. Flame out 9 s after ventilation stopped."
- **No structural failure.** The project data has no record of damage to a habitat structure, so never draw a wall breach, a pressure loss or a collapse. The aftermath card says in one line that the data has no test of structural damage.
- **Truth rules.** A stage caption cites a record where one supports it (same "How we know" pattern as the Interpret sheet). Where none does, the caption carries the word "Illustration". All times and speeds are illustrative and labelled so; oxygen scales them.

### 15.10 What the scene is for: a fire scenario you can try to control

Daniel, 15 Nov: "The real goal is NASA Artemis, boots on the ground. Having a way to actually see what would happen, see the hypothetical scenarios, how would you control it."

So "Fire in this base" (15.9) is a scenario tool, not a film. The viewer sets up a fire, watches it, then tries a response and sees what the evidence says about it. This sharpens 15.9; where the two differ, this section wins.

- **The question on screen:** "What if a fire starts here?" The caption for stage 1 asks it, with the base name.
- **Scenario = start point.** Each start point has a one-line name ("Cloth near the air vent", "Cable behind the panel", "Paper on the desk").
- **Response, at stage 4, is a choice the viewer makes:** "Do nothing", "Stop the ventilation", "Discharge carbon dioxide". The story then plays that outcome. Each response shows one evidence line with its record ("How we know"), and one line on what is not known. Take both from the records: the BASS-II airflow findings and `solids-quench-flow`, the ACME BRE claims on flames with the airflow off at 21% oxygen and in richer oxygen, and the FLEX carbon dioxide facts (`flex-dext-share-co2-*`, a weak trend in droplet tests). Where the records do not say whether a response works for a material or an air, the outcome is drawn as uncertain (the flame weakens but the card says "Not tested") and never as a clean success. Add a response only if a record speaks to it.
- **Gravity is the honest gap for the Moon.** No test in the data ran in Moon gravity. For Moon Base and the rover, draw the flame and smoke between the orbit behaviour and the Earth behaviour (a weak, slow rise) and label the scene "Estimate: no fire test has run in Moon gravity". The compare control becomes a three-way switch, "In orbit (measured)", "On the Moon (estimate)", "On Earth (measured)", so the viewer sees what is measured and what is drawn between. ISS defaults to orbit, Earth to Earth.
- **Controls, final list:** start point, response, gravity. The ventilation control of 15.9 is the "Stop the ventilation" response.
- **Aftermath card adds the lesson:** one sentence on what the chosen response did, one on what is untested, and an "Ask about this" button that opens Ask SI with the scenario as the question.
- **Dates.** Do not put an Artemis landing date on screen: none is in the project data and schedules move.

## 16. Guided path (owner request, 2026-11-15)

Problem: the console is a dashboard. A first-time researcher does not know what to click first or next. The owner and the event organizer both ask for one defined path through the site, explained at each step.

### 16.1 The path, six steps

| # | Step name | Console state | What the viewer is told |
|---|---|---|---|
| 1 | Pick your base | stage, carousel in focus | Each base has its own air (oxygen and pressure). Fire behaves differently in each, so everything after this step is for the base you pick. |
| 2 | See what matters most | Rank sheet open | The experiments are ranked for this base. Say what the score means and where it comes from. |
| 3 | Read what it means | Interpret sheet open | What the evidence says about a flame in this air, how it differs from Earth, and what is not known. |
| 4 | Watch a fire and respond | stage, scene "Fire in this base" | Start a fire, watch it spread, pick a response, read the outcome card. Say what is measured and what is illustration. |
| 5 | Ask your own question | Ask SI panel open | Ask in plain words. Every answer shows its sources; numbers come from the tables, not from the model. |
| 6 | Check how it was made | Team models sheet, with links to Research map and Library | The models, the data, and the limits. |

Copy rules: each step has a name (2 to 5 words), one sentence that says what to do, and a longer "Why this step" text of 2 to 4 sentences. Every factual sentence must be true of the site as built; no Artemis date; no claim the data does not support.

### 16.2 The control

- One guide bar, docked under the top nav, full width of the console, glass, one hairline. It shows: "Step N of 6", the step name, the one-sentence instruction, Back, Next, and "Hide guide".
- "Why this step" expands under the bar (a disclosure, not a modal).
- Next and Back set the console state of the step (base stays as picked). They never reload the page.
- The control the viewer should use next gets a solid 2px outline (no glow, no shadow, no animation loop longer than one pulse; honour prefers-reduced-motion).
- If the viewer navigates by hand (opens a sheet, opens Ask), the step follows: the bar shows the step that matches the current state.
- First visit: the guide is on at step 1. "Hide guide" stores the choice in localStorage (wrapped in try/catch). A "Guide" button in the top nav brings it back at the current step.
- URL: `?guide=3` opens at step 3 with that step's state; `?guide=0` hides it. This is for screenshots and the demo video.
- The top nav order matches the path, and each nav item that is a step shows its step number.
- Narrow center (under 60rem) and phones: the bar is one 48px row, "N/6", the step name and Next; a tap on the name expands the instruction and "Why this step". It must not cover the carousel, the playback controls or the bottom bar.
- Keyboard: the bar is a labelled region; Next and Back are buttons; step changes are announced with aria-live polite; focus moves to the opened sheet or panel as it does today.
- Only one solid white pill exists on the site (Ask SI). Next is a glass button with a strong outline, not a second white pill.

### 16.3 Files

New folder `src/guide/` (steps data, bar component, css, tests). Mount in `src/app/App.tsx`; nav order and numbers in `src/shell/chrome.tsx`; guide state in `src/app/console.ts` (URL read). Nothing else.

### 16.4 Checks

- A test that each step sets the stated console state, and that a state change by hand maps back to the right step.
- A test that `?guide=N` and the localStorage choice are read.
- Seen in a real browser at 1440x900, 1280x720 and 390x844.

## 17. Scene detail: each base is its own place (owner request, 2026-11-15)

Problem: the four cabins look the same and read as a bunch of cubes. The owner wants a detailed environment, built differently for each base.

### 17.1 Rules that hold

- Detail comes from form, light and surface, not from colour. Scene materials stay neutral (greys, off-white, dark metal). The flame, the smoke and one small screen glow per base are the only light sources that draw the eye. No new saturated colours.
- Built in code with three.js and the installed `@react-three/drei` (RoundedBox, Instances, Edges, Text and the like). No new dependency, no downloaded model, no texture file over 50 KB. Canvas-drawn textures are fine.
- The story does not change: `src/scenes/spread/story.ts` positions (ignition points, vent, detector, locker, airflow) and the picked-object ids keep their meaning. If a prop moves, the story position it stands for moves with it, in one place.
- Camera limits and home poses (`layout.ts`) still hold: the fire is in view at home, and the camera stays inside the walls.
- Speed: the scene must still reach its first frame in about one second and hold a smooth frame rate on a laptop with integrated graphics. Budget: under 150 draw calls per base (use instancing and merged geometry), no real-time shadow maps, no post-processing pass. Measure with `renderer.info.render.calls` and report it.
- Every object the viewer can pick keeps a readable name, and it must look like what it is named: cloth looks like cloth, a cable like a cable.

### 17.2 The four places

| Base | What it must read as at a glance | Required set pieces |
|---|---|---|
| ISS | A station lab module: a tube with no floor, every wall in use | Four walls of rack fronts with seams and latches; handrails; a hatch ring at each end; cable bundles along a standoff; a laptop on an arm; soft stowage bags held by straps; an air diffuser grille (the vent); the work bench as a glovebox-style frame; a round window with Earth |
| Moon Base | A surface habitat with weight: things rest on a floor | Curved shell with ribs; a floor of panels; a workbench on legs; an airlock hatch with a wheel; bunks or a suit rack; a plant rack with a grow light (the one glow); storage crates stacked; a window with the grey horizon and Earth small above it |
| Pressurized rover | A cramped vehicle cockpit | Two seats with headrests; a wide windshield with the lunar surface; a dashboard with screens and a hand controller; overhead stowage; side hatches; ribbed floor; everything within arm's reach |
| Earth | An ordinary lab room on Earth | Lab bench with stools; a fume hood; ceiling light panels; a door; a window with daylight; shelves; things sit on surfaces and hang down, so gravity is visible |

The three start points (cloth near the air vent, paper on the desk, foam pad by the bench) keep their ids and map to a fitting prop in each base: for example in the rover the cloth is a seat cover by the cabin vent, the paper is a checklist on the dashboard, and the foam is a seat cushion.

### 17.3 Props, not cubes

Replace each cube stand-in with a shaped prop: cloth as a draped, slightly folded sheet; paper as a small stack with one sheet lifted; foam as a rounded pad; cable as tubes in a bundle with ties; the locker with a door seam, hinge and handle; the detector as a ceiling disc with a ring light; the vent as a slatted grille. Burn and char states still apply to the same meshes or their stand-ins.

### 17.4 Checks

- A test that every base defines all required story anchors and all three start points, inside its room bounds.
- Screenshots of each base at home pose and one close view of the props, at 1440x900 and 390x844, saved with the lane report. The coordinator looks at them before shipping.
- Draw calls and first-frame time per base, reported.

### 17.5 Material details as callouts in the scene (owner request, 2026-11-15)

The details of an object no longer open as a card in the side panel. They show in the scene, as a labelled diagram does: a glass card joined to the object by a thin leader line.

- **Hover** an object (pointer): a small preview callout shows its name, whether it burns here, and one line of why. It goes when the pointer leaves.
- **Click** an object (or tap, or Enter on its row in the panel list): the callout is pinned and shows the full details: name, burns or not and why, "How we know" with the record, "Start a fire here" where the object is a start point, and "Ask about this". The object keeps its outline while pinned.
- **Deselect** (click the object again, click empty scene, the callout's close button, or Escape): the callout goes. Nothing shows for an object that is neither hovered nor pinned.
- One pinned callout at a time. A hover preview may show beside a pinned one.
- The callout follows the object as the camera orbits, pans and zooms: its anchor is the object's projected position, re-computed on every camera change (the existing `project()` in `layout.ts`). The card itself stays upright, at a fixed readable size, and never scales with distance.
- The leader line runs from the object's anchor point to the nearest edge of the card: one hairline, with a small dot at the object end.
- The card stays inside the stage and out of the keep-out boxes (`zone.ts`: caption, playback bar, top-3 card, scenario panel, bottom bar). When it cannot sit beside the object it moves to the nearest free side and the line follows.
- When the object is behind the camera or outside the view, the preview hides; a pinned callout docks at the nearest stage edge with its line pointing off-screen.
- The panel keeps the object list as the keyboard and screen-reader path: each row is a button, `aria-pressed` when pinned, and the pinned details are also announced (aria-live polite).
- Narrow center and phones: there is no hover. A tap pins. The pinned callout is at most 60% of the stage width, with inner scroll.
- Checks: a test for the three states (none, preview, pinned) and for deselect; a test that the card position stays inside the stage and out of each keep-out box for a set of anchor points; seen in a real browser while orbiting.

## 18. Stage clutter budget (owner feedback with a screenshot, 2026-11-15)

Problem: at 1141x847 the scene is almost fully covered: a three-line caption card, the playback bar, an object detail panel, the brief card, the top-3 card, the scene picker and three labels all sit on the stage at once. The owner: "there are so many screens here taking up space".

Rule: the scene is the subject. At rest (nothing opened by the viewer), overlays cover at most 20% of the stage area at every width, measured as the union of overlay rectangles over the stage rectangle. Anything more opens on demand and closes again.

### 18.1 Shell (files: src/app/app.css, src/top/)

- The brief and the top-3 card are never drawn over the stage at rest, at any width. The 48px bottom bar (today's narrow-center layout: top result, score, "Top 3", "Brief") is the layout at every width. The wide variant with both cards open over the stage is removed.
- A card opened from the bar opens upward over the stage, one at a time, and closes on Escape, on an outside press or on its close button, as today.

### 18.2 Stage chrome (files: src/scenes/)

- One strip at the top of the stage holds the scene picker, play or pause, the seeker with its stage marks, and the time. One row on a wide stage, two on a phone.
- The caption is one line under that strip, cut with an ellipsis. A press on it (or on its "i") expands the full text and "How we know"; a second press, Escape or an outside press closes it. The word "Illustration" or the source mark stays visible in the one-line form.
- The scenario panel (start point, response, gravity, outcome) is closed at rest at every width, behind one "Scenario" button. Open, it sits at one side, at most 22rem wide, with inner scroll. The outcome headline also shows as one line in the caption when a response has played, so the viewer need not open the panel to see what happened.
- The object detail panel goes: details are the in-scene callouts of 17.5.
- In-scene labels (window, burnt zone, detector, flame front) are at most 5 at once, one line each, and hide while the caption or the scenario panel is open over them.
- "Reset view" is an icon button with a tooltip and an accessible name.
- Check: a browser measurement of the covered share at 1141x847, 1440x900 and 390x844 at rest, reported with the hand-back; target 20% or less.
