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

## Rank script (`node scripts/rank/build.ts`, idempotent, round 3)
- score = (2 o2 + 2 pressure + directness + evidence + goalFit) / 7; null factor counts 0.5 x weight (value stays null in data). `compareRank` in `scripts/rank/compare.ts`: score, then more non-null factors, then id.
- Goal fit asked once per (oxygen, pressure) pair, worded by conditions; moon and rover share the answer. 75 calls (3 cache hits), 34,274 in / 1,425 out tokens, model `jev-1.14.0` (stored in each cache entry, not in rank.json). Rerun: 0 calls, no diff. Tokens only, no dollar figure.
- Null factors: o2 64, pressure 80, directness 0, evidence 104 (waits for Lane A round 2), goalFit 0. provenance `measured` only for table conditions.
- Integrator: local `.dev.vars` with `SPEND_MODE=mock` so `wrangler dev` ignores keys in `.env`.
- SAFFIRE-I at ISS: rank 9 of 26 (0.691; oxygen 0.9, pressure not on record, direct) behind six fully measured studies, ahead of all indirect/unmeasured ones. Where a researcher would expect.
- FLEX at suit-ref: rank 8 of 26 (0.541; oxygen 0, pressure 0.83), down from 3rd; it sits below studies with unknown conditions that rate better on directness and goal fit. Defensible; a measured oxygen miss still ranks above 18 others.

Columns: o2/pressure/directness/evidence/goalFit, - = not on record.

**iss** top 8, bottom 3
1. FLEX 0.856 (1/1/1/-/0.49); 2. FLEX-2 0.826 (1/1/1/-/0.285); 3. ACME CFI-G 0.785 (1/1/0.5/-/0.498); 4. ACME/Flame Design 0.783 (1/1/0.5/-/0.478); 5. CFI 0.77 (1/1/0.5/-/0.39); 6. ACME s-Flame 0.768 (1/1/0.5/-/0.373); 7. BASS-II 0.741 (1/-/1/-/0.688); 8. ACME BRE 0.7 (1/-/1/-/0.403)
...; 24. SLICE 0.472 (-/-/0.5/-/0.305); 25. STDCE-1 0.368 (-/-/0/-/0.075); 26. Structure and Proper 0.366 (-/-/0/-/0.065)

**moon** top 8, bottom 3
1. FLEX 0.889 (1/1/1/-/0.725); 2. FLEX-2 0.841 (1/1/1/-/0.385); 3. ACME CFI-G 0.819 (1/1/0.5/-/0.735); 4. ACME/Flame Design 0.789 (1/1/0.5/-/0.52); 5. ACME BRE 0.709 (1/-/1/-/0.46); 6. SAFFIRE-III 0.595 (-/-/1/-/0.668); 7. BASS 0.589 (-/-/1/-/0.625); 8. DAFT / DAFT-2 0.582 (-/-/1/-/0.575)
...; 24. SAFFIRE-I 0.453 (0/-/1/-/0.668); 25. STDCE-1 0.37 (-/-/0/-/0.093); 26. Structure and Proper 0.366 (-/-/0/-/0.065)

**suit-ref** top 8, bottom 3
1. ACME CFI-G 0.734 (0.795/0.929/0.5/-/0.693); 2. ACME/Flame Design 0.71 (0.77/0.949/0.5/-/0.535); 3. SAFFIRE-III 0.606 (-/-/1/-/0.74); 4. DAFT / DAFT-2 0.59 (-/-/1/-/0.628); 5. BASS 0.589 (-/-/1/-/0.625); 6. SAME 0.557 (-/-/1/-/0.4); 7. SAME-R 0.556 (-/-/1/-/0.395); 8. FLEX 0.541 (0/0.83/1/-/0.63)
...; 24. STDCE-1 0.368 (-/-/0/-/0.073); 25. Structure and Proper 0.365 (-/-/0/-/0.053); 26. ACME s-Flame 0.198 (0/0/0.5/-/0.385)

## Lane O must add
- `wrangler.toml`: `main = "server/index.ts"` (already), an `[assets]` binding named `ASSETS` (so `/data/index.json` loads; else bundled fixture index is used).
- Secrets: `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`. Var: `SPEND_MODE` (`mock` | `extractive`; unset = by keys).
- Note: ports 8787 and 8799 on this machine are held by unrelated services; I used 47613.

## Stubbed / ceilings
- Rate limit (10 burst, 1 per 6 s per IP) and answer cache (200 entries) are per-isolate memory. Move to a Durable Object or KV if abused.
- Index: fixture index until Lane B's `public/data/index.json` lands (loaded via `ASSETS`, shape `{chunks, idf, avgLen}`).
- No new npm dependencies.
