// Usage: node scripts/deploy/smoke.mjs <baseUrl>   (exits 1 on any failure)
const base = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!base) {
  console.error("usage: node scripts/deploy/smoke.mjs <baseUrl>");
  process.exit(2);
}

const checks = [
  ["/", (r, t) => r.ok && /<div id="root"|<html/i.test(t)],
  ["/health", (r, t) => r.ok && JSON.parse(t).ok === true],
  ["/data/fixtures/investigations.fixture.json", (r, t) => r.ok && JSON.parse(t) !== null],
];

let failed = 0;
for (const [path, ok] of checks) {
  try {
    const r = await fetch(base + path);
    const t = await r.text();
    if (ok(r, t)) console.log(`PASS ${path} ${r.status}`);
    else throw new Error(`status ${r.status}, unexpected body`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${path}: ${e.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
