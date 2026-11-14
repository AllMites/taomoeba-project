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
| Integrator only | `src/contracts/`, `src/app/store.ts`, `src/data/`, `package.json`, `docs/PAGE_PLAN.md` |

Lane reports go in `docs/lane-reports/<lane>.md`, never the repo root.
