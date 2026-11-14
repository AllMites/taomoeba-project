# Page plan (approved)

One page. A judge or researcher arrives wanting to know which NASA fire experiments apply to
their habitat, and why. First click: pick a habitat. Everything below changes with that pick.

## Sections, top to bottom

| # | Section | Answers | Challenge word | Owner |
|---|---|---|---|---|
| 1 | Hero: title, one line, habitat picker (ISS / Moon Base / Pressurized rover) | What is this, where do I start? | | C Shell |
| 2 | Ask box: question in, cited answer out, matching cards light up | Does CO2 put out a droplet flame? | SI-powered | Q Ask + Brief |
| 3 | Habitat brief: takeaways for the picked habitat, each with its source | What does the evidence say for my habitat? | Interpret | Q Ask + Brief |
| 3b | Replay (extra, after the gate): two 3D scenes, loaded on demand. Past: a SAFFIRE fire in a cargo ship. Your habitat: the same flame at the picked habitat's air | What does this fire look like? | | D, G; mounted by the integrator |
| 4 | Filter row: Prevention / Detection / Suppression, search | Show me detection only | Find | R Ranking |
| 5 | Ranked experiments: cards in order, top 8 then "Show all" | Which apply, and why this order? | Rank, Summarize | R Ranking |
| 6 | Limits strip | Can I trust this? | | C Shell |
| - | Detail drawer, opened by a card | Everything about one experiment, plus download | Extract | H Drawer |

Section labels on screen use the challenge's own words: Summarize, Rank, Interpret.

## Shared state (`src/app/store.ts`, integrator only)

`habitat`, `pds`, `search`, `selectedInvestigationId` (drawer open when not null),
`highlightIds` (investigations the last answer cited).

## Shared helpers (`src/data/`, integrator only)

- `useDataset(name)`: investigations, rank, claims, sources, habitats.
- `select.ts`: `rankedFor`, `claimsFor`, `briefFor`, `pickerHabitats`, `loadRuns`, `runUrls`.
- `rankRule.ts`: `HOW_RANKING_WORKS`, shown verbatim behind "How ranking works".

Need something that is not there? Do not edit these files. Write it in your own folder and
list it in your lane report.

## Rules for every UI lane

1. Plain language. One sentence, 25 words at most. Gloss jargon. Numbers carry units.
   Say "experiment" on screen, never "investigation" or "PSI-69" alone (show the name, id small).
2. Show, do not tell. A bar or a dot beats a sentence. No walls of text, no tables of raw fields.
3. Never show a blank, a zero or "null" for missing data. Say "Not on record" in muted text.
   No finding for an experiment: the card simply has no finding line.
4. Never show a bare score without its five reasons within one click.
5. Every SI-written sentence shows its source on demand (the excerpt and source id).
6. Colour comes from tokens in `src/styles/tokens.css` only. No hex values in components.
   The team's mood board will replace token values; nothing else should need to change.
   Each lane keeps its CSS in its own folder (`src/<lane>/<lane>.css`, imported by its index).
7. Accessibility: keyboard reachable, visible focus, real buttons and labels, 4.5:1 text
   contrast in light and dark, meaning never by colour alone, respects reduced motion.
8. Works at 1440x900 and at 375 wide with no sideways scroll.
9. Each of the seven screens must read as a still image: one clear focal point.
10. No new dependencies (the integrator added three, @react-three/fiber and drei for `src/scenes/` and `src/fx/` only). Native elements first (`<dialog>`, `<details>`, radio inputs).
11. No words "AI-powered", no "according to NASA". Use "SI" where the model is named.

## 3D scenes (`src/contracts/scene.ts`)

- A scene is the default export of `src/scenes/<id>/index.tsx`: a `SceneModule` whose Component fills its parent box.
- The page loads scenes lazily through `src/scenes/registry.ts`. The 2D page must work with WebGL off.
- Develop at `/scenes.html?scene=saffire&habitat=moon&calm=0` (dev server only).
- Budget per scene: 1.5 MB of models, 100k triangles, 6 textures, 8 materials. 30 fps or better on a phone.
- `calm` true: one still frame, no loop.

## Data facts to design around

- 26 experiments: 24 about fire, 2 tagged Other (rank last, hide behind "Show all").
- Oxygen range on record for 10, pressure for 6. The rest say "Not on record".
- Findings exist for 5 experiments, habitat rationales for 6, summaries for 24.
- Run tables for 19 experiments (FLEX has 274 runs). Some carry `notes`.
- Brief: 16 takeaways across ISS, Moon Base and rover.

## Slides that fall out of the page

1 hero, 2 ranked list, 3 one card and its drawer, 4 ask box, 5 filters and export,
6 brief and limits, 7 impact.

## Cut

Separate analyst page, compare view, numbered side rail, Past / Present / Future tabs, hash routes.
