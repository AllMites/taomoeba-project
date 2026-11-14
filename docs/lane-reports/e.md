# Lane E report: Server

Branch `claude/lane-e-6d2c56`. Ran under `npx wrangler dev` (workerd, local), real HTTP, killed by PID afterwards.
Worker entry is `server/index.ts` (default export only; workerd rejects other exports). App code is `server/app.ts`.

## Endpoints (real output)
- `GET /health` -> `{"ok":true}`
- `POST /ask {question, habitat?}` ran in **extractive** mode (only TYPESAFE key set), 0.22 s:
  `curl -X POST :47613/ask -d '{"question":"How big are smoke particles from spacecraft materials?","habitat":"iss"}'`
  -> `{"answer":"I am quoting the PSI records directly: \"Smoke particles are larger than the aerosols used to certify ground detectors.\" [SRC-05] \"Flame spread ... [SRC-01]","claims":[{"id":"ask-1","investigationId":"PSI-05","kind":"finding",...,"sourceIds":["SRC-05"]},...],"investigationIds":["PSI-05","PSI-01"],"mode":"extractive"}`
  Off-topic ("pizza recipe") -> `"The PSI records I have do not cover that."`, empty claims.
  The second quoted sentence (SRC-01) is a weak match: BM25 returns any chunk sharing a term. Live mode filters this.
- `POST /verify {text, excerpt, sourceText?}` ran against live TypeSafe (`jev-latest`), 0.42 s:
  -> `{"verbatim":true,"verdict":"supports","confidence":0.98,"flagged":false}`
  No `sourceText` -> `verbatim:false`, not flagged for that alone. No TypeSafe key -> `flagged:true` (unchecked). Core is `verify()` in `server/verify.ts`.
- Too-long question -> `400 {"error":"too_long",...}`. Over-limit -> 429. Errors never include keys or stacks.

## Modes
- `SPEND_MODE=mock` forces canned. No keys at all defaults to mock. TYPESAFE key only -> extractive. `ANTHROPIC_API_KEY` -> live (`claude-haiku-5-5`, `fetch`, effort low).
- **Live mode never ran against Anthropic** (no key). Tested only with a stubbed fetch (parsing, unknown-id drop, failure falls back to extractive). The request body follows the claude-api skill (no temperature, `output_config.effort`); first real call may need tuning.
- `/rank` stays a 501 stub; ranks are precomputed.

## Rank script (`node scripts/rank/build.ts`)
- `ALPHA = 0.5` in `scripts/rank/build.ts`. Fixture run: 32 items (8 investigations x 4 habitats), 32 TypeSafe Score calls, 16,452 in / 608 out tokens, 7.4 s. Cached in `scripts/rank/.cache/` (rerun = 0 calls).
- With fixture inputs the output goes to `scripts/rank/.cache/rank.fixtures.json` (gitignored), not `public/data/rank.json`, so it cannot be committed by accident. `rank.json` is NOT committed. With Lane A's real files it writes `public/data/rank.json`.
- Fixture overlap is empty, so every item is `overlap:null`, `dimsUsed:0`, `illustrative`. The measured path is only unit-tested.
- Reads `public/data/habitats.json` if present, else the habitat fixture (4 habitats; no `mars`). claimIds come from `public/data/claims/*.json` if present, else the claims fixture.

## Lane O must add
- `wrangler.toml`: `main = "server/index.ts"` (already), an `[assets]` binding named `ASSETS` (so `/data/index.json` loads; else bundled fixture index is used).
- Secrets: `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`. Var: `SPEND_MODE` (`mock` | `extractive`; unset = by keys).
- Note: ports 8787 and 8799 on this machine are held by unrelated services; I used 47613.

## Stubbed / ceilings
- Rate limit (10 burst, 1 per 6 s per IP) and answer cache (200 entries) are per-isolate memory. Move to a Durable Object or KV if abused.
- Index: fixture index until Lane B's `public/data/index.json` lands (loaded via `ASSETS`, shape `{chunks, idf, avgLen}`).
- No new npm dependencies.
