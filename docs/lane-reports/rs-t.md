# Lane T (reskin): Top for this base, Library, ISS models

Branch `claude/rs-t`, cut from `reskin`. Three commits, one per part. Files: `src/top/`, `src/library/`, `public/models/iss/`, `CREDITS.md`.

## Part 1: `src/top/`

- `TopForBase` (default): glass card. Header "Top for <base label>". Three rows: rank numeral, name, score (0 to 100), summary cut at two lines.
  - The rows are the first three cards of the Rank sheet: `topRows(buildRows(rankedFor(...)))` from `src/ranking/logic.ts`, so both lists always agree.
  - Row click opens the evidence drawer. The row is draggable (`dragProps`). A separate icon button calls `askAbout(id)`.
  - "See all" is a pill and calls `setView("rank")`.
  - Rows are 88px high, loaded or not, so the card does not change size.
- `BriefLine` (named): the first card of the Interpret sheet (`orderBrief(briefFor(...))[0]`), cut at three lines, with its first source as a new-tab link, "and N more", and a "More" button that calls `setView("interpret")`.
- `AskIcon` is exported for reuse (Lucide "message-circle" path, 1.5px stroke).

## Part 2: `src/library/`

- Search plus an All / Prevention / Detection / Suppression filter. Both are local state. The store's `pds` and `search` are not written.
- Experiments list: click opens the evidence drawer; draggable; "Ask about this" button. Names are cut at two lines, with the full name in `title`.
- Sources list: new-tab links with the kind of document (PSI record, NASA report, NASA page). Six are shown until "Show all 64 sources" or a filter.
  - With a kind picked, only the sources that experiments of that kind cite are listed.
- "How an answer is made": Search (BM25), Pick (Rerank), Write (Claude), Check (TypeSafe).
  - The order is the server's order (write, then check), not the order in the brief.

## Part 3: `public/models/iss/`

| File | NASA source | Bytes | Triangles | Meshes | Textures |
|---|---|---|---|---|---|
| `iss.glb` | International Space Station (ISS) (B) | 474,632 | 174,440 | 10 (36 primitives) | 0 |
| `iss-lo.glb` | International Space Station (ISS) (A) | 39,216 | 6,642 | 1 (6 primitives) | 0 |

- Download URLs: `assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/international-space-station-(iss)-(b)/International%20Space%20Station%20(ISS)%20(B).glb`, and the same form with `(a)` and `(A)`.
- NASA ships both files already Draco-compressed, at the sizes in the PRD. They were not compressed again.
- Neither file has a texture or an image, so there is no insignia or flag to remove. The lunar repaint step does not apply.
- One change was made, without loss: the `KHR_materials_specular` extension was removed from the materials, so three.js uses `MeshStandardMaterial`, as the lunar models do. The Draco data was copied byte for byte.
- Both files were loaded with three.js `GLTFLoader` + `DRACOLoader` (decoder from `/models/lunar/draco/`) in headless Chrome: both load, with the triangle counts above.
- For lane K:
  - `iss.glb`: all 19 materials are the same grey (0.4). Local bounds x -11.1 to 3.3, y -4.2 to 41.3, z -22.9 to 22.7. The pivot is not centred.
  - `iss-lo.glb`: 6 materials, one of them blue (solar panels, 0.07 0.04 0.47) and one brown. The root node has scale 0.678 and a 90° X rotation.
  - The two files have different scale and orientation. Fit each by its bounding box.
- The models are not wired into any scene.

## Checks

- `npx tsc --noEmit`, `npx vitest run` (342 passed, 1 skipped) and `npx vite build` pass.
- New tests: `src/top/top.test.tsx` (3), `src/library/library.test.tsx` (3).
- Screenshots in `docs/lane-reports/rs-t/`, taken on a throwaway preview page (not committed) that copies the wrappers from the layout contract, because this branch's `App.tsx` is still the old page:
  - `1440-top-moon.png`, `1440-top-rover.png`, `1440-library.png`, `390-top-moon.png`, `390-library.png`.
  - The 390px shots show the two cards overlapping. That comes from the preview's fixed wrappers. The phone layout belongs to lane S.

## Not done, or for another lane

- Not seen inside the real console shell. Check after the merge with lane S.
- Moon Base and Pressurized rover have the same top three and the same scores. That is the data: both have the same air.
- The lead brief line for the rover says "partial gravity such as the Moon's". That is the claim text in `public/data/claims.json`.
- The Library lists all 26 records, including the two tagged "Other" (PSI-108, PSI-181), which the Rank sheet hides from its top list.
- `CREDITS.md` had no model rows. The three lunar models, the Draco decoder and three.js were added with the two ISS rows.
- `.pill:hover` in `src/styles/base.css` swaps to the accent, which is now the same white as the pill, so the hover does not show. `.top-all:hover` sets its own hover. The base rule belongs to lane S.
