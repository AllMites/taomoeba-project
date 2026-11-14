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

## Rank script round 2 (`node scripts/rank/build.ts`, idempotent)
- score = plain mean of 5 factors in order o2, pressure, directness, evidence, goalFit; null counts as 0 (`FACTOR_WEIGHTS`, `HOW_RANKING_WORKS` exported). `overlap`/`dimsUsed`/`siRelevance` kept.
- Real data: 104 items, `public/data/rank.json` committed. 100 TypeSafe Score calls, 46,657 in / 1,900 out tokens (about 20 s); rerun = 0 calls, all cached. No dollar figure: TypeSafe returns tokens only.
- Null factors: o2 64, pressure 80, directness 0, evidence 104 (Lane A has not added `evidence` yet), goalFit 0.
- Moon Base top 5 (o2/pressure/directness/evidence/goalFit -> score): PSI-69 1/1/1/null/0.908 -> 0.782; PSI-68 1/1/1/null/0.575 -> 0.715; PSI-10 1/1/0.5/null/0.63 -> 0.626; PSI-159 1/1/0.5/null/0.595 -> 0.619; PSI-20 1/null/1/null/0.68 -> 0.536.
- o2 and pressure agree with `overlap.json` for every single-dimension row (tested). Goal-fit questions are 4 strings (one per habitat; no `mars`, none in habitats.json). Goal fit judges only the first ~400 chars of `objectives` (the shown excerpt).
- provenance: `measured` only when a condition comes from a table (no `conditionBasis` counts as table); record-only or none = `illustrative`.
- Fixture inputs still write to `scripts/rank/.cache/rank.fixtures.json`. Claim ids from `public/data/claims/*.json` if present, else the fixture.
- Integrator: create a local `.dev.vars` (gitignored) with `SPEND_MODE=mock` so `wrangler dev` ignores real keys from `.env`. Example: `.dev.vars.example` content is just that one line.

## Lane O must add
- `wrangler.toml`: `main = "server/index.ts"` (already), an `[assets]` binding named `ASSETS` (so `/data/index.json` loads; else bundled fixture index is used).
- Secrets: `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`. Var: `SPEND_MODE` (`mock` | `extractive`; unset = by keys).
- Note: ports 8787 and 8799 on this machine are held by unrelated services; I used 47613.

## Stubbed / ceilings
- Rate limit (10 burst, 1 per 6 s per IP) and answer cache (200 entries) are per-isolate memory. Move to a Durable Object or KV if abused.
- Index: fixture index until Lane B's `public/data/index.json` lands (loaded via `ASSETS`, shape `{chunks, idf, avgLen}`).
- No new npm dependencies.
