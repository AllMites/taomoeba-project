# Locked features

These ship and stay. `src/features.lock.test.ts` fails the gate if one is removed or unwired.
Changing this list needs both Daniel and Raenn.

| Feature | What it is | Where |
|---|---|---|
| AI 1, CatBoost | Team model for flame extinction diameter, shown in What-if | `public/data/whatif.json` (`models.ext_diameter`), `src/whatif/` |
| AI 2, TypeSafe | System One verifier, `POST /verify`; extractive Ask fallback | `server/verify.ts`, `server/ask.ts` |
| AI 3, Anthropic | Claude writes Ask answers, `POST /ask` | `server/llm.ts`, `src/ask/` |
| AI 4, RAG | BM25 + rerank over the library; server-only papers in KV `LIBRARY` / `restricted-index` | `server/bm25.ts`, `server/rerank.ts`, `server/app.ts`, `scripts/rag/` |
| 3D lanes | Saffire and Lunar scenes, lazy-loaded on the Stage | `src/scenes/`, `src/fx/` |
| Dashboard | Brief, Ranking, Compare, What-if, Gaps, Earth, Trust, Evidence drawer | `src/app/App.tsx` and each section folder |

## Deploy account

`wrangler.toml` `LIBRARY` id `dc03ff57518e41a8b42c5f8c48120bf5` is the KV namespace on Daniel's deploy account. Do not change it. Pointing it elsewhere leaves the RAG with no server-only papers. If `restricted-index` goes missing, rebuild it with `scripts/rag/add_papers.py` and upload:

```
npx wrangler kv key put restricted-index --path=library/restricted-index.json --binding=LIBRARY --remote
npx wrangler kv key list --binding=LIBRARY --remote
```

## Reskin rules

The reskin is for organization: grouping, order, navigation, visual system. Not for features.

- Free to change: `src/styles/`, every `*.css`, `docs/DESIGN_SYSTEM.md`, markup and section order in `src/app/App.tsx`, section wrappers and headings.
- Do not change: `server/`, `scripts/`, `public/data/`, section `logic.ts` files, `src/contracts/`, `src/scenes/registry.ts`.
- Every locked feature stays reachable from the page. Run `npm run gate` before merging.
