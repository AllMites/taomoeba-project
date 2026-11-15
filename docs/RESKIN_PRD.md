# Reskin PRD: one-screen mission console

Status: **draft for tonight's reframe.** Options are open where marked; **Rec** is the default if nobody picks.
Supersedes `docs/PAGE_PLAN.md` (one long page) once approved. Locked features in `docs/FEATURES.md` still hold.

References: `docs/reskin-refs/canva-board.jpg` (team Canva: Formless glass flowers, IT Empire, HSR-style
backdrop, note "use NASA 3D models"), `docs/reskin-refs/it-empire.jpg` (layout model).

## 1. Why

The site works but reads as one 16.7-screen page (29 on phone) with no navigation. Teammate feedback:
"messy, all the info in one page." The reskin is for organization and first impression, not new features.

## 2. The idea in one line

One screen. A 3D habitat in the center, the library on the left, SI chat on the right. Pick your base,
and the whole console (ranking, brief, models, replay) re-tunes to that habitat's air.

## 3. Layout (desktop)

```
┌───────────────────────────────────────────────────────────────────────┐
│ FLAME IN FREEFALL                        [Interpret Rank Compare Models]│  top bar
├──────┬────────────────────────────────────────────────────┬───────────┤
│ rail │                                                    │           │
│  ◎   │        CHOOSE YOUR BASE                            │  ASK SI   │
│  ▤   │   ┌────┐   ┌──────────┐   ┌────┐                   │  (panel,  │
│  ✦   │   │ISS │   │MOON BASE │   │ROV │  ← 3D carousel    │  closable)│
│      │   └────┘   └──────────┘   └────┘                   │           │
│      │   backdrop: live 3D scene of the picked base       │  drop     │
│ LIB  │                                                    │  cards    │
│ panel│   [ Enter replay ]   30% O2 · 70.3 kPa             │  here     │
│(open)│                                                    │           │
├──────┴────────────────────────────────────────────────────┴───────────┤
│ status strip: habitat · O2 · pressure · sources checked · model       │
└───────────────────────────────────────────────────────────────────────┘
```

| Zone | What it holds | Locked features it carries |
|---|---|---|
| Left rail (icons) | Toggles between center views and opens the left panel. Taken from the IT Empire side icons. | — |
| Left panel: **Library** | The RAG database made visible: sources and experiments, search, filters Prevention / Detection / Suppression, and per answer the pipeline steps (BM25 search, rerank, TypeSafe check, Haiku write). Cards drag into the chat. | RAG, TypeSafe, Anthropic |
| Center: **Stage** | 3D carousel "Choose your base" (ISS, Moon Base, Pressurized rover). The picked base's environment is the live backdrop. Cinematic camera, depth fog, light bloom. | 3D lanes |
| Right panel: **Ask SI** | Today's chat panel moved here. Accepts dragged cards as context ("ask about this"). | Anthropic, RAG |
| Top nav | Center views: Interpret (brief), Rank (list), Compare, Team models (what-if). Each opens as a glass sheet over the stage, the stage dims behind it. Hover or focus shows a one-line description. | Dashboard, CatBoost |
| Status strip | Habitat, O2 %, pressure kPa, time, sources checked. The IT Empire "Time / Temp / Energy" row, filled with real readouts. | — |

Phone: stage full screen; Library and Ask SI become bottom sheets; nav becomes a chip row. Details in §8.

## 4. Flow

1. Land on the stage: three base cards rotate on a slow turntable over a dark space backdrop.
2. Pick a base (click, swipe or arrow keys). The backdrop cross-fades to that base's 3D environment, the
   status strip updates, the ranking re-runs. The carousel never advances by itself, because every pick
   re-ranks the page.
3. From there, any of:
   - **Enter replay**: the cinematic fire scene for this base (Saffire past, the base's flame now).
   - **Top nav** sheets: Interpret, Rank, Compare, Team models.
   - **Library** (left) to browse sources; drag one to **Ask SI** (right).

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

**Rec A**: it keeps Sav's cool moment (the pick drives the 3D world, the replay is one press away and
leads the video) without moving the judged objective behind it. Use B's sequence only in the 30 s video.

## 6. Visual direction

Flat, clean, modern, grey. Frosted, translucent glass panels like Safari's, clean vector icons with high contrast. Cinematic 3D only in the
center; panels stay calm and readable over it.

| Token role | Value | Note |
|---|---|---|
| Page / space | `[ near-black grey, e.g. #0e0f11 ]` | IT Empire base; fill from the Canva hex if given |
| Glass panel | `rgba(255,255,255,0.06)` + `backdrop-filter: blur(24px) saturate(140%)` | 1px border `rgba(255,255,255,0.12)` |
| Text | `[ #f2f2f0 ]`, muted `[ #a4a8ae ]` | ≥ 4.5:1 over the darkest stage frame, so test over the real 3D |
| Accent | `[ Canva accent ]`, fallback amber `#ffbb5c` | One accent. The flame keeps its own colour |
| Display font | `[ Canva font ]`, fallback **Archivo** wide | IT Empire uses a wide geometric display face |
| Body / UI | `[ Canva font ]`, fallback Archivo | |
| Mono readouts | JetBrains Mono | Status strip, units, ids |
| Icons | One outline set, 1.5 px stroke, 20/24 px | e.g. Lucide; no emoji |

Glass rules:
- Blur only on panels that sit over the 3D.
- If `backdrop-filter` is missing, or the user prefers reduced transparency, fall back to a solid `#16181b` at 0.92 opacity.

**Open:** `[ Canva hex codes and font names ]`. We could not read the Canva file from here. Paste them
in, or Rec: ship the fallbacks above.

## 7. 3D

- **Models.** Use NASA 3D Resources (public domain, nasa3d.arc.nasa.gov / github nasa/NASA-3D-Resources):
  - ISS: an ISS model.
  - Moon Base: today's lunar scene (`public/models/lunar`: hdu, sev, astronaut).
  - Pressurized rover: SEV / LTV.
  - Check each model's licence note and credit them in `CREDITS.md`.
- **Carousel.** Three cards on a turntable, built in R3F (already a dependency), DOM labels on top. The center card is larger and lit.
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
| Earth | Interpret sheet, "On Earth" tab, or `[ own sheet ]` |
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

| Wave | Lane | Owns |
|---|---|---|
| 1 | S Shell | `App.tsx`, `app.css`, `styles/` (tokens, glass), layout grid, rail, top nav, status strip, sheets |
| 1 | K Carousel + backdrop | `src/scenes/stage/` (new), reuses `scenes/lunar`, adds NASA models under `public/models/` |
| 1 | L Library panel | `src/library/` (new): sources, filters, pipeline steps |
| 2 | A Ask panel | `src/ask/`: move to the right panel, drop target, scope chip |
| 2 | M Sheets | Wrap Brief, Ranking, Compare, What-if, Gaps, Earth in sheets (markup only) |
| 3 | V Review + visual audit | Per lane, against this PRD |

## 14. Open questions for tonight

1. Replay-first (B) or stage-hub (A, Rec)?
2. Canva hex codes and fonts, or ship the fallbacks?
3. Earth: Interpret tab or its own sheet?
4. Which NASA models for the ISS and the rover? Do they pass the size budget?
5. Keep a light mode? Rec: no; the console is dark by design. The old site had both.
6. Does round 1 of the decision board still apply? Ask SI amber, phone padding, the rover label clip and
   section-link fixes carry over; the structure, nav, carousel and bottom-card cards are replaced by this PRD.
