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
