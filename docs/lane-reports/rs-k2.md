# Lane K2: Replay polish

Commits: d160ce4 (problems 1 to 3), 294ce6b (problem 4). Both merged to main (544e77d, adf37c9).

1. Flame is the hero: per-base "Now" framing, larger flames, soft additive glow (src/scenes/lunar/FlamePair.tsx, replay.ts).
2. Text on glass: flame labels are glass chips anchored to their flames; the illustration note folded into the caption chip. Keep-out zones in src/scenes/zone.ts, tested in zone.test.ts.
3. Stage controls laid out by container queries on `.stage` (600 to 1700px wide), src/scenes/stage.css.
4. ISS: iss-lo.glb first, iss.glb after the scene is up, each fitted by bounding box (src/scenes/lunar/fit.ts, tested), solar panels mono grey (station.tsx).
5. Not done: camera drift and star field.

Screenshots: docs/lane-reports/rs-k/ (1440x900 and 390x844).
