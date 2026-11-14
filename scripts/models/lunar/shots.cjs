// Lane G check: screenshots of the lunar scene from its own headless browser, plus poster capture and a frame-rate probe.
//   node scripts/models/lunar/shots.cjs BASE_URL OUT_DIR [mode]
//   mode: shots (default) | posters | fps | nogl (WebGL off: the poster fallback)
// Needs Playwright (PLAYWRIGHT = its module path if not resolvable; CHROME = a Chrome binary if its own is missing)
// and a dev server at BASE_URL. Each run uses a fresh --user-data-dir.
const path = require("path");
const fs = require("fs");
const os = require("os");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");

const [base = "http://localhost:5237", out = "docs/lane-reports/g", mode = "shots"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const SOFT = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const GPU = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];

async function open(args, viewport, deviceScaleFactor = 1) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lane-g-chrome-"));
  const ctx = await chromium.launchPersistentContext(dir, { headless: true, args, viewport, deviceScaleFactor, executablePath: process.env.CHROME || undefined });
  return ctx;
}

async function settle(page) {
  await page.waitForSelector(".lunar canvas, .lunar-poster", { timeout: 30000 });
  // Models are Draco-decoded off the main thread; give them and the first shadow pass time.
  await page.waitForTimeout(6000);
}

async function shots() {
  const views = [["desk", { width: 1440, height: 900 }], ["phone", { width: 375, height: 812 }]];
  const cases = [["moon", 0], ["rover", 0], ["iss", 0], ["moon", 1]];
  const errors = [];
  for (const [vname, viewport] of views) {
    const ctx = await open(SOFT, viewport);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
    page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
    for (const [hab, calm] of cases) {
      await page.goto(`${base}/scenes.html?scene=lunar&habitat=${hab}&calm=${calm}`);
      await settle(page);
      const file = path.join(out, `${hab}${calm ? "-calm" : ""}-${vname}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log("shot", file);
    }
    await ctx.close();
  }
  console.log("errors:", errors.length ? errors.slice(0, 10) : "none");
}

async function posters() {
  // Wide: the desk framing. Narrow: a 480-wide window gives the harness a 448x560 (4:5) box, under the 640 px
  // breakpoint, so the scene uses its phone framing; captured at 1.5x for phone screens. Convert the PNGs to WebP.
  const sets = [["", { width: 1600, height: 1000 }, 1, ["moon", "rover", "iss"]], ["-narrow", { width: 480, height: 1000 }, 1.5, ["moon", "rover"]]];
  for (const [suffix, viewport, scale, habs] of sets) {
    const ctx = await open(SOFT, viewport, scale);
    const page = await ctx.newPage();
    for (const hab of habs) {
      await page.goto(`${base}/scenes.html?scene=lunar&habitat=${hab}&calm=1&poster`);
      await settle(page);
      const el = await page.$(".lunar");
      const file = path.join(out, `lunar-${hab}${suffix}.png`);
      await el.screenshot({ path: file });
      console.log("poster", file);
    }
    await ctx.close();
  }
}

async function nogl() {
  for (const [vname, viewport] of [["desk", { width: 1440, height: 900 }], ["phone", { width: 375, height: 812 }]]) {
    const ctx = await open(["--disable-webgl", "--disable-3d-apis"], viewport);
    const page = await ctx.newPage();
    await page.goto(`${base}/scenes.html?scene=lunar&habitat=moon&calm=0`);
    await settle(page);
    const file = path.join(out, `moon-nowebgl-${vname}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("shot", file, "poster shown:", !!(await page.$(".lunar-poster")));
    await ctx.close();
  }
}

async function fps() {
  for (const [name, args] of [["gpu", GPU], ["swiftshader", SOFT]]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
      const ctx = await open(args, viewport);
      const page = await ctx.newPage();
      await page.goto(`${base}/scenes.html?scene=lunar&habitat=moon&calm=0`);
      await settle(page);
      const r = await page.evaluate(async () => {
        const c = document.querySelector(".lunar canvas");
        const gl = c.getContext("webgl2") || c.getContext("webgl");
        const info = gl && gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
        const times = [];
        let last = performance.now();
        await new Promise((done) => {
          const t0 = last;
          const tick = (t) => {
            times.push(t - last);
            last = t;
            if (t - t0 < 5000) requestAnimationFrame(tick);
            else done();
          };
          requestAnimationFrame(tick);
        });
        times.shift();
        times.sort((a, b) => a - b);
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        return { renderer, frames: times.length, fps: +(1000 / mean).toFixed(1), p95ms: +times[Math.floor(times.length * 0.95)].toFixed(1), w: innerWidth, h: innerHeight, dpr: devicePixelRatio };
      });
      console.log("fps", name, JSON.stringify(r));
      await ctx.close();
    }
  }
}

({ shots, posters, fps, nogl })[mode]().catch((e) => {
  console.error(e);
  process.exit(1);
});
