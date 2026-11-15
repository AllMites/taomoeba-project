# Lane F: fact picking

## Built
- `server/facts.ts`: `findFacts` unchanged in behaviour (scoring moved into `scoreFacts`). New `factPool` (findFacts' picks first, then facts sharing any real word, up to 10, same dashboard rules) and `namesPaperTopic` (the old topic veto, now callable on its own).
- `server/factpick.ts`: `pickFacts`, one Haiku call over the pool. The reply is validated: unknown or repeated ids are dropped, more than 2 are cut, and a reply that names only unknown ids counts as unusable. No key, a failed call or an unusable reply return `findFacts`. A dashboard-only ranking makes no call. The veto stays in front of the model by default (`veto = true`).
- Tests: `server/factpick.test.ts` (reply validation, each fallback, no call on the dashboard-only path, the quote-only path unchanged).
- Eval endpoint: `POST /ask` with `factsOnly: true` (plus `factPicker: "model"|"keyword"`, `factVeto: false`) picks facts only and returns `{ facts, picker, pool }`. It goes through the same rate limit and validation, is never cached and never reads saved answers. The flags are ignored without `factsOnly`.
- Labelled set `scripts/rag/fact_questions.json`, written before any run: the 30 CASES, 31 paraphrases and 10 new "none" questions. Eval through the site: `node scripts/rag/eval_facts.mjs https://<site>` (213 requests, 7 s apart, about 25 min, at most 142 Haiku calls). It writes `eval-results/facts-<date>.json`.
- Summary wording: `MOON_NOTE` now says station tests are microgravity, not reduced gravity, and that no test ran in Moon or Mars gravity. The summary-only `MOON_AIR_NOTE` says some FLEX runs used air close to the habitat's and the gap is Moon gravity. Its premise (`model-moon-validity`: 9 methanol and 7 heptane runs at 30% oxygen or more and 620 mmHg or less) and its presence in the summary prompt are tested in `ask.thread.test.ts`. Not measured live.

## Measured

| picker | old cases: right first | old: in the 2 | paraphrases: right first | paraphrases: in the 2 | "none" questions given a fact |
|---|---|---|---|---|---|
| keyword (`findFacts`) | 25/25 | 25/25 | 4/31 | 4/31 | 0/15 |
| Haiku (`pickFacts`) | not run | not run | not run | not run | not run |

The pool's ceiling, measured offline: the right fact is in the pool for 25/25 old cases and 26/31 paraphrases. The 5 paraphrases whose right fact is missing from the pool use words like "drop" (not "droplet"), "breeze" and "alcohol". The veto fires on 1 paraphrase ("reversed flames ... die out", where the right fact is in the pool) and on 4 of the 15 none questions.

## Not done
- No Haiku measurement and no `eval_ask.mjs` runs. `.dev.vars` holds only `SPEND_MODE`, with no `ANTHROPIC_API_KEY`, and no key is set in the environment. Reading `.env` was refused.
- So the ship rule is unproven, and `pickFacts` is **not wired into `live()`**. The coordinator runs the eval on the deployed Worker. If it passes, wiring it in is one line in `server/ask.ts` `live()`: `const facts = (await pickFacts(extras.facts ?? [], question, env)).facts;`. `steps` and the site's pipeline list need no change, because `steps.facts` still counts the facts shown.
- The veto decision (item 4) needs the eval's "haiku, no veto" against "haiku, veto in front" rows. Until then the veto stays in front.

## Measured on the deployed Worker, 2026-11-15 (coordinator)

`node scripts/rag/eval_facts.mjs https://flame-in-freefall.all-mites1.workers.dev`, 71 questions x 3 groups, 0 errors, 0 fallbacks.

| Picker | Old cases right first | Old in the 2 | Reworded right first | Reworded in the 2 | "None" shown a fact | Model calls |
|---|---|---|---|---|---|---|
| keyword | 25/25 | 25/25 | 3/31 | 3/31 | 0/15 | 0 |
| model, veto in front | 25/25 | 25/25 | 22/31 | 22/31 | 0/15 | 60 |
| model, no veto | 25/25 | 25/25 | 23/31 | 23/31 | 0/15 | 65 |

The ship rule passes for both model rows. `pickFacts` is now wired into `live()` with the veto in front (the default): one question of difference does not justify removing a guard. The quote-only path still runs `findFacts`.
