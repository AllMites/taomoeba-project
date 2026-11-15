# Lane ownership

Each lane edits only the paths it owns. Shared files are integrator only.

| Lane | Owns |
|---|---|
| A Data | `scripts/ingest/`, `public/data/investigations.json`, `public/data/overlap.json` |
| B Corpus | `corpus/`, `scripts/rag/`, `public/data/claims/`, `public/data/sources.json` |
| E Server | `server/` |
| C Shell | `src/app/App.tsx`, `src/app/app.css`, `src/styles/`, `index.html` |
| R Ranking | `src/ranking/` |
| Q Ask + Brief | `src/ask/`, `src/brief/` |
| H Drawer | `src/evidence/` |
| O Deploy | `wrangler.toml`, `scripts/deploy/`, `docs/DEPLOY.md` |
| D Fire FX + Saffire | `src/fx/`, `src/scenes/saffire/`, `public/models/saffire/`, `public/data/scenes/saffire.json` |
| G Lunar | `src/scenes/lunar/`, `public/models/lunar/` |
| Q2 Conversation | `src/ask/`, `server/` |
| Integrator only | `src/contracts/`, `src/app/store.ts`, `src/data/`, `src/scenes/registry.ts`, `src/scenes/dev.tsx`, `scenes.html`, `package.json`, `docs/PAGE_PLAN.md` |

Lane reports go in `docs/lane-reports/<lane>.md`, never the repo root.

## Reskin (one-screen console)

Design source: `docs/RESKIN_PRD.md`. Layout state: `src/app/console.ts` (`useConsole`, `pickBase`, `askAbout`, `dragProps`). Any state can be opened by URL: `?base=iss|moon|rover|earth&view=stage|interpret|rank|compare|models|graph&lib=0|1&ask=0|1`.

| Lane | Owns |
|---|---|
| S Shell | `src/app/App.tsx`, `src/app/app.css`, `src/shell/`, `src/styles/`, `index.html`, `docs/DESIGN_SYSTEM.md` |
| M Sections | `src/brief/`, `src/ranking/`, `src/compare/`, `src/whatif/`, `src/gaps/`, `src/earth/`, `src/trust/`; CSS only in `src/graph/`, `src/evidence/` |
| K Replay | `src/scenes/` (not `registry.ts`), `src/fx/` |
| A Ask | `src/ask/`, `server/app.ts`, `server/ask.ts` |
| T Top + Library + Models | `src/top/`, `src/library/`, `public/models/iss/`, `CREDITS.md` |
| Integrator only | `src/app/console.ts`, `src/app/store.ts`, `src/features.lock.test.ts`, `package.json`, `public/data/`, `src/contracts/`, `scripts/` |

Layout contract (class names are fixed):

```
div.console                 grid, 100dvh, no page scroll; data-view, data-left, data-ask
  header.console-top        brand, nav (opens sheets), the Ask SI pill
  nav.console-rail          icon buttons
  aside.console-left        320px: <Library />, <Trust />
  main#main.console-center  position: relative
      carousel (top), <Stage /> fills the center, .console-brief (bottom-left) <BriefLine />,
      .console-overlay (bottom-right, 320px) Earth base ? <Earth /> : <TopForBase />,
      one <Sheet> per view over the center
  aside.console-right       360px: <Ask /> (stays mounted while hidden)
  footer.console-status     status strip
<Evidence />                drawer over everything
```

Design rules (a reviewer checks these):

- Mono, dark, transparent. No hue in the UI: the only colour is the fire in the replay and the 6px flame dot in the Ask SI pill. No neon, glowing borders, gradient text, scanlines, grid overlays or panel drop shadows. Corner ticks on the replay frame only.
- Tokens only, from `src/styles/tokens.css`: `--glass`, `--glass-hi`, `--line`, `--line-strong`, `--color-text`, `--color-text-muted`, `--label` (small mono capitals only, never on bare 3D), `--color-pill`. `.glass` only on panels that sit over the 3D.
- One solid white pill on the screen: Ask SI ("See all" is the one other allowed pill). Selected state is a white fill with dark text; unselected is transparent with a `--line` border.
- A state that used to be shown by colour is shown by form and a word (solid versus dashed).
- Spacing from `--space-1..6` (4, 8, 12, 16, 24, 32px). One radius per component family.
- Type: `.t-display` for the brand and base names, `.t-readout` for units and labels, Archivo for body.
- Every control is a real button or link with a 44px target and a visible focus ring. Labels and values sit on the first baseline. No underline on standalone links.
- Text over the replay always sits on glass. Body text contrast is at least 4.5:1.
- Reduced motion: no transitions. Phone (760px and below): panels are bottom sheets, sheets are full screen.

Checks: `npx tsc --noEmit && npx vitest run && npx vite build` in the lane; `npm run gate` before a merge to `main`.
