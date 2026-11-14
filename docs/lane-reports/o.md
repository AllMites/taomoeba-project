# Lane O report (deploy prep)

Nothing deployed. No secrets written. Config keys taken from current Cloudflare docs (Context7): `[assets] directory/binding/not_found_handling/run_worker_first`.

Files: `wrangler.toml`, `scripts/deploy/smoke.mjs`, `docs/DEPLOY.md`.

## Dry run
```
npm run build            -> dist/ built
npx wrangler deploy --dry-run --outdir .wrangler/dry
  Read 12 files from the assets directory .../dist
  Total Upload: 62.10 KiB / gzip: 15.86 KiB
  env.ASSETS  Assets
  env.SPEND_MODE ("mock")  Environment Variable
  --dry-run: exiting now.
```

## Local `wrangler dev --port 8871`
```
GET /                                        200 text/html  (<!doctype html>, app shell)
GET /data/fixtures/investigations.fixture.json  200 {"fixture": true, "items": [{"id": "PSI-01", ...
GET /health                                  {"ok":true}
GET /some/route                              200 (SPA fallback to index.html)
node scripts/deploy/smoke.mjs http://localhost:8871 -> PASS x3, exit 0
smoke against a dead port -> FAIL x3, exit 1
```
Server killed (workerd and wrangler node PIDs); port 8871 free.

## For Lane E / integrator
- Worker `export default app` (Hono) works as-is. `/ask` must exist on the Hono app (not present in scaffold yet).
- Unmatched API paths go to Hono only for the 4 listed; any new API path must be added to `run_worker_first` in `wrangler.toml`.
- Read `SPEND_MODE` from `c.env.SPEND_MODE`, keys from `c.env.ANTHROPIC_API_KEY` / `c.env.TYPESAFE_API_KEY`; treat missing key as mock.
- Note: `/health` is only checked as JSON `ok === true` by smoke.
- Optional `package.json` line: `"deploy:check": "wrangler deploy --dry-run --outdir .wrangler/dry"`.
- Gotcha: smoke uses `process.exitCode` (not `process.exit`), which crashed Node on Windows with open fetch handles.
