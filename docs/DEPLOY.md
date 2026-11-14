# Deploy (Cloudflare Worker, one URL)

One Worker `flame-in-freefall` serves `dist/` as static assets (no SPA fallback: the app uses hash routes, and a missing file must 404 so the loader falls back to fixtures) and runs `server/index.ts` first for `/ask`, `/rank`, `/verify`, `/health`. Config: `wrangler.toml`.

## Prerequisites
- `npm ci`, then `npx wrangler whoami` shows the owner account (else `npx wrangler login`).
- `npm run gate` is green.

## Check the config without deploying
```bash
npm run build
npx wrangler deploy --dry-run --outdir .wrangler/dry
```

## Preview deploy (separate version URL, production unchanged)
```bash
npm run build
npx wrangler versions upload
```
Prints a preview URL. Smoke it: `node scripts/deploy/smoke.mjs <preview-url>`.

## Production deploy
```bash
npm run build
npx wrangler deploy
node scripts/deploy/smoke.mjs https://flame-in-freefall.<account-subdomain>.workers.dev
```
The smoke script exits non-zero if `/`, `/health` or a data file fails, if a JSON path is not served as JSON, or if a missing data file does not return 404.

## Secrets (never in files)
```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put TYPESAFE_API_KEY
```
Each call creates and deploys a new Worker version. Remove one with `npx wrangler secret delete <NAME>`.

## SPEND_MODE
`wrangler.toml` sets `SPEND_MODE = "mock"` (no paid calls). To go live, change it to `"live"` in `[vars]`, then `npm run build && npx wrangler deploy`. Only do this after the Anthropic spend limit below is set.

## Anthropic spend limit
In the Anthropic Console, open the workspace that owns the key, then Limits, and set a monthly spend limit there. Use a dedicated workspace and key for this app.

## Rollback
```bash
npx wrangler deployments list
npx wrangler rollback            # previous version
npx wrangler rollback <VERSION_ID>
```
Creates a new deployment from the chosen version immediately. Note: secrets and vars roll back with the version.

## Post-deploy checklist
- [ ] Open the URL in a private window: no login prompt, app loads.
- [ ] `node scripts/deploy/smoke.mjs <url>` passes.
- [ ] `<url>/health` returns `{"ok":true}`.
- [ ] Delete `ANTHROPIC_API_KEY` and `TYPESAFE_API_KEY` (or test on a preview with none): the ask box still answers (fixture/mock path).
- [ ] A hash route reloads without a 404.
