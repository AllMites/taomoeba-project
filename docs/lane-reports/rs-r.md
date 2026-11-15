# rs-r: small-screen layout audit

Branch `claude/rs-s`. Commits: `ab746d4` (mid widths: nav, short-screen panels), `aac0318` (touch: fields, targets, Compare table).
Gate before each commit: `npx tsc --noEmit`, `npx vitest run` (560 passed, 1 skipped), `npx vite build`, all exit 0.

Method: `docs/lane-reports/rs-r/audit.mjs`, own headless Chrome (CDP 9342, own profile), Vite on 5202. Sizes 320x568, 360x740,
390x844, 414x896, 844x390, 600x960, 768x1024, 1024x768; touch emulated below 768. States: four bases on the stage, the scene
picker open and the second scene, the bottom bar with Top 3 and Brief open (ISS and Earth), the six sheets (scrolled to the
end), Library, Ask SI with a typed question, Ask over the Rank sheet, carousel and nav reachability. Raw output:
`rs-r/before.txt` and `rs-r/after.txt`. Screenshots in `rs-r/`.

Clean at every size and state: no sideways page scroll (`html` scrollWidth = clientWidth); every sheet scrolls to its last
child; all four bases in the carousel are hit at their centre; every nav item is reachable (scrolling the row); status strip
has no covered or clipped control.

## Fixed

| # | P | Size | View | Measurement | Fix |
|---|---|---|---|---|---|
| F1 | P1 | 768x1024, 844x390 (761 to about 1000 wide) | every view | `elementFromPoint` at the Ask SI pill centre hit `button.nav-btn [Research map]`; nav ran to x=793 over the pill at 637-752 / 713-828 | `ab746d4`: between 761 and 1100px the nav row scrolls sideways (as on a phone), tips hidden there. After: no covered control. `before-768x1024-sheet-rank.png`, `after-768x1024-sheet-rank.png` |
| F2 | P1 | 844x390 | Library, Ask SI | Library drawer under the carousel: list box 94px tall (238-332); Ask showed only the form, no header | `ab746d4`: mid width and height up to 480px, the drawer starts at the top of the center. Library list 210px. `before-/after-844x390-library.png`, `-ask-typed.png` |
| F3 | P2 | all phone sizes, 844x390 | Rank, Compare, stage | fields at 14px: Rank search, three Compare selects, the replay's selects (iOS zooms on focus) | `aac0318`: `src/styles/base.css` floor of 16px for fields on `(pointer: coarse)`, width up to 760px, height up to 480px. After: none at those sizes. 768 and 1024 still read 14px in headless (no coarse pointer emulated); a real iPad matches `pointer: coarse` |
| F4 | P2 | all | Rank | "How ranking works" summary 141x31 | `aac0318`: 44px line on touch and up to 1100px |
| F5 | P2 | 360 and up | Compare | column-head buttons 36x21 and 82x21 | `aac0318`: 44x44 minimum on touch and up to 1100px |
| F6 | P2 | 320 to 640 | Compare | table `min-width: 34rem` inside an inner scroller: the second experiment's column sat off screen with no visible cue | `aac0318`: up to 640px the table fits (fixed layout, 30% attribute column). Table 288 of 288 at 320. `after-compare-320x568.png`, `after-compare-390x844.png` |

1440x900: unchanged. Shots before and after F1/F2 (`1440-before-rank-panels.png`, `1440-after-g1-rank-panels.png`) match; F3 to
F6 sit behind touch, narrow or short queries (Compare buttons still measure 36x21 at 1440, as before).

## Reported, not fixed

For the stage agent (`src/scenes/`):

| # | P | Size | Steps | Measurement |
|---|---|---|---|---|
| S1 | P1 | 320x568 | `?base=moon&view=stage&lib=0&ask=0` (and `base=rover`) | "Fire scenario" toggle (`button.burn-toggle`) centre at y=645 of 568, in no scroller: cannot be reached. The caption card fills the stage height (`after-320x568-stage-moon.png`) |
| S2 | P1 | 844x390 | `?base=moon&view=stage` (and rover) | `form.burn-panel` box 401-427, below the 390 screen |
| S3 | P2 | 844x390 | `?base=iss&view=stage`, open the scene picker | option "Real fire: Saffire flight" centre y=415 of 390: cannot be picked (`after-844x390-stage-iss-picker-open.png`) |
| S4 | P2 | 844x390 | `?base=iss&view=stage`, pick the second scene (SceneLab) | scene picker button covered by the base carousel; "About this replay" summary covered by the readout value `101.3` (`after-844x390-stage-iss-scene2.png`) |
| S5 | P2 | 768x1024, 1024x768 | `?base=iss&view=stage` (and earth) | response buttons "Stop the ventilation", "Discharge carbon dioxide", "Do nothing" 214x36 (under 44) |
| S6 | P3 | touch and phone | any stage with a select | the 16px field floor (F3) also applies to the replay's selects; check the scene panels still fit |

For the guide/nav agent (`src/shell/chrome.tsx`, nav order):

| # | P | Size | Note |
|---|---|---|---|
| N1 | P3 | 761 to 1100 | F1 makes `.console-nav` scroll sideways in the mid-width block of `app.css` with a hidden scrollbar (same as the phone row); the cut-off chip is the only cue, and nav tips are hidden there. If the nav is reordered or the guide bar changes the top row, keep that rule or re-measure Ask SI at 768x1024 |

For the Compare owner:

| # | P | Size | Note |
|---|---|---|---|
| C1 | P3 | all | `.cmp-open` is underlined at rest; the design rules say no underline on standalone links. Left as is so wide desktop does not change |

## Counts

P1: 4 (2 fixed, 2 reported to stage). P2: 7 (4 fixed, 3 reported to stage). P3: 3 reported.

## Not tested

Real iOS focus zoom and real `pointer: coarse` (headless only); Ask SI with a long answer thread (no Ask server running);
on-screen keyboard height on a phone.
