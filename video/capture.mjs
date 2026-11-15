// Records each shot of docs/video/SCRIPT.md from the live site as its own clip in video/out/shots/.
//   node video/capture.mjs [baseUrl] [--only=s2,s4] [--no-ask]
// Own headless Chrome (CDP port 9344, own profile in the OS temp folder), 1920x1080, software WebGL.
// Frames come from Page.startScreencast (sent on every repaint, with their timestamps) and are laid on a constant
// 30 fps grid by ffmpeg, so motion keeps its real timing.
// When the site changes: edit SEL, WAIT and the URLs in SHOTS below. Nothing else should need touching.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { launch } from "./cdp.mjs";

// ---------------------------------------------------------------------------------------------------------------
// Selectors and waits: the only things that should change when the site changes.
// A selector is { css, text? }: the first visible element matching css (and, if given, whose text matches text).
// ---------------------------------------------------------------------------------------------------------------
export const SEL = {
  carousel: { css: ".console-carousel" },
  canvas: { css: "canvas" },
  baseMoon: { css: "button.base", text: /^moon base$/i },
  navRank: { css: "button.nav-btn", text: /rank/i },
  navInterpret: { css: "button.nav-btn", text: /interpret/i },
  navModels: { css: "button.nav-btn", text: /team models/i },
  sheet: { css: ".sheet" },
  sheetBody: { css: ".sheet .sheet-body" },
  rankTitle: { css: ".sheet h1, .sheet h2", text: /experiments that fit/i },
  interpretTitle: { css: ".sheet h1, .sheet h2", text: /what the evidence says/i },
  cannotTell: { css: ".sheet h3", text: /what the data cannot tell you/i },
  modelsTitle: { css: ".sheet h1, .sheet h2", text: /what if you change the air/i },
  play: { css: "button.stage-play-btn" },
  seek: { css: "input.stage-seek" },
  scenario: { css: "button.burn-toggle" },
  respNone: { css: ".burn-panel button.spread-resp", text: /^do nothing$/i },
  respVent: { css: ".burn-panel button.spread-resp", text: /^stop the ventilation$/i },
  outcome: { css: ".spread-outcome-h" },
  stageMark: { css: ".stage-mark" },
  askInput: { css: "#ask-compose, .ask-panel textarea" },
  askSend: { css: "button.ask-go" },
  askDone: { css: ".ask-turn[data-state=done]" },
  askBody: { css: ".ask-body" },
};
export const WAIT = {
  load: 20000, // page shell + carousel
  canvasSettle: 1800, // after the canvas appears, let the 3D draw and the fonts land
  sheet: 8000, // a sheet opens
  detector: 15000, // the detector trips in the fire scenario
  outcome: 12000, // after Stop the ventilation, the flame goes out
  answer: 90000, // Ask SI answers (paid model call)
};
export const QUESTION = "Does stopping the airflow put out a flame?";
const OUTCOME_TEXT = /flame goes out/i;
const DETECT_PHASE = /detected/i; // the stage mark whose title names the detector trip
const QUENCH_S = 6; // scenario seconds from Stop the ventilation to the flame going out (src/scenes/spread/story.ts)

// ---------------------------------------------------------------------------------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out", "shots");
const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) || "https://flame-in-freefall.all-mites1.workers.dev").replace(/\/$/, "");
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const NO_ASK = args.includes("--no-ask");
const PROFILE = process.env.VIDEO_PROFILE || join(tmpdir(), "firebreak-video-chrome");
const FPS = 30;
const url = (q) => `${BASE}/?${q}`;

class ShotError extends Error {}

/** The shots, in script order. `slot` is the shot's length in the script (seconds); the cut holds it exactly. */
export const SHOTS = [
  {
    id: "s1-console",
    slot: 3.5,
    url: url("base=moon&view=stage&lib=1&ask=1&guide=0"),
    async run(a) {
      // The whole console; the pointer drags the 3D room a little so it turns.
      const c = await a.center(SEL.canvas);
      await a.hold(0.4);
      await a.moveTo(c.x - 160, c.y + 120, 0.5);
      await a.drag(c.x - 160, c.y + 120, c.x + 140, c.y + 80, 1.8);
    },
  },
  {
    id: "s2-pick-rank",
    slot: 3.5,
    url: url("base=iss&view=stage&lib=0&ask=0&guide=1"),
    async run(a) {
      await a.click(SEL.baseMoon, 0.45);
      await a.hold(0.25);
      await a.click(SEL.navRank, 0.45);
      await a.waitFor(SEL.rankTitle, WAIT.sheet);
      await a.hold(0.3);
      await a.wheel(SEL.sheetBody, 420, 0.9);
    },
  },
  {
    id: "s3-interpret",
    slot: 3.5,
    url: url("base=moon&view=rank&lib=0&ask=0&guide=2"),
    async run(a) {
      await a.waitFor(SEL.rankTitle, WAIT.sheet);
      await a.click(SEL.navInterpret, 0.45);
      await a.waitFor(SEL.interpretTitle, WAIT.sheet);
      await a.hold(1.0); // the lead sentence
      await a.scrollTo(SEL.sheetBody, SEL.cannotTell, 1.0);
    },
  },
  {
    id: "s4-fire",
    slot: 7.0,
    url: url("base=iss&view=stage&lib=0&ask=0&guide=4"),
    async prepare(a) {
      // Off camera: set the response to Do nothing (so pressing Stop the ventilation changes it), close the panel,
      // and park the timeline a few scenario seconds before the detector trips.
      await a.jsClick(SEL.scenario);
      await a.waitFor(SEL.respNone, WAIT.sheet);
      await a.jsClick(SEL.respNone);
      await a.sleep(300);
      await a.jsClick(SEL.scenario);
      a.detect = await a.detectAt();
      await a.setSeek(Math.max(0, a.detect - 10)); // about 3 s of spread on screen before the detector
      await a.sleep(700);
    },
    async run(a) {
      await a.click(SEL.play, 0.45);
      await a.hold(0.3);
      await a.click(SEL.scenario, 0.5);
      await a.waitUntil("the detector trips", `(() => { const s = ${a.q(SEL.seek)}; return s && Number(s.value) >= ${a.detect}; })()`, WAIT.detector);
      await a.click(SEL.respVent, 0.4);
      await a.waitFor({ ...SEL.outcome, text: OUTCOME_TEXT }, WAIT.outcome);
      await a.waitUntil("the flame goes out", `(() => { const s = ${a.q(SEL.seek)}; return s && Number(s.value) >= ${a.detect - 1 + QUENCH_S}; })()`, WAIT.outcome);
      await a.hold(0.5);
    },
  },
  {
    id: "s5-ask-models",
    slot: 4.5,
    url: url("base=moon&view=stage&lib=0&ask=1&guide=5"),
    async run(a) {
      await a.click(SEL.askInput, 0.4);
      await a.type(QUESTION, 1.2);
      if (NO_ASK) {
        console.log("  --no-ask: not sending the question");
        await a.hold(1.2);
      } else {
        await a.click(SEL.askSend, 0.25);
        a.rec.pause(); // the wait for the model is not filmed
        await a.waitFor(SEL.askDone, WAIT.answer);
        await a.sleep(800);
        await a.eval(`(() => { const b = ${a.q(SEL.askBody)}; const t = document.querySelector(".ask-turn:last-child"); if (b && t) b.scrollTop = t.offsetTop - b.offsetTop - 8; })()`);
        await a.sleep(400);
        a.rec.resume();
        await a.hold(1.0);
        await a.wheel(SEL.askBody, 260, 0.6);
      }
      await a.click(SEL.navModels, 0.45);
      await a.waitFor(SEL.modelsTitle, WAIT.sheet);
      await a.hold(0.9);
    },
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Pointer ring: drawn in the page, follows the synthetic mouse, shrinks on press.
const RING = `(() => {
  if (window.__vring) return; window.__vring = 1;
  const add = () => {
    const r = document.createElement("div"); const d = document.createElement("div");
    r.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;opacity:0;transform:translate(-200px,-200px)";
    d.style.cssText = "width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;border:3px solid rgba(255,255,255,.96);box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 22px rgba(110,160,255,.75);background:rgba(110,160,255,.12);transition:transform .12s ease-out,background .12s";
    r.appendChild(d); document.documentElement.appendChild(r);
    addEventListener("mousemove", (e) => { r.style.opacity = 1; r.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, true);
    addEventListener("mousedown", () => { d.style.transform = "scale(.7)"; d.style.background = "rgba(110,160,255,.45)"; }, true);
    addEventListener("mouseup", () => { d.style.transform = "scale(1)"; d.style.background = "rgba(110,160,255,.12)"; }, true);
  };
  document.documentElement ? add() : addEventListener("DOMContentLoaded", add);
})()`;

/** Screencast recorder: keeps every frame with its time; pause() drops what follows until resume(). */
function recorder(page, dir) {
  const frames = [];
  let on = false, paused = false, pausedFor = 0, pausedAt = 0, t0 = 0, stopAt = 0, n = 0;
  const off = page.on((m) => {
    if (m.method !== "Page.screencastFrame") return;
    page.send("Page.screencastFrameAck", { sessionId: m.params.sessionId }).catch(() => {});
    if (!on || paused) return;
    const ts = m.params.metadata.timestamp;
    if (!t0) t0 = ts;
    const file = join(dir, `f${String(n++).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(m.params.data, "base64"));
    frames.push({ file, t: ts - t0 - pausedFor });
  });
  const now = () => Date.now() / 1000;
  return {
    async start() {
      on = true;
      await page.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
      const s = now(); while (!frames.length && now() - s < 5) await page.sleep(20);
      if (!frames.length) throw new Error("screencast sent no frame");
      this.wall0 = now();
    },
    elapsed() { return now() - this.wall0 - pausedFor; },
    pause() { paused = true; pausedAt = now(); },
    resume() { paused = false; pausedFor += now() - pausedAt; },
    async stop() { stopAt = this.elapsed(); on = false; await page.send("Page.stopScreencast"); off(); return { frames, end: Math.max(stopAt, frames.at(-1).t + 1 / FPS) }; },
  };
}

function encode(frames, end, dir, out) {
  const list = [];
  for (let i = 0; i < frames.length; i++) {
    const dur = (i + 1 < frames.length ? frames[i + 1].t : end) - frames[i].t;
    list.push(`file '${frames[i].file.replace(/\\/g, "/")}'`, `duration ${Math.max(dur, 0.001).toFixed(4)}`);
  }
  list.push(`file '${frames.at(-1).file.replace(/\\/g, "/")}'`);
  const lf = join(dir, "list.txt");
  writeFileSync(lf, list.join("\n"));
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lf, "-vf", `fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-an", out], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${out}`);
}

/** Actions for one shot. Every failure names the shot and the selector or condition. */
function actor(page, shot) {
  const fail = (msg) => { throw new ShotError(`[${shot.id}] ${msg}`); };
  const q = (s) => `[...document.querySelectorAll(${JSON.stringify(s.css)})].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ${s.text ? `${s.text}.test(e.innerText.trim())` : "true"}; })`;
  const desc = (s) => `${s.css}${s.text ? ` with text ${s.text}` : ""}`;
  let mx = 960, my = 600;
  /** Calls f(k) with k from 0 to 1 over sec seconds of wall time, as often as the browser keeps up. */
  const tween = async (sec, f) => {
    const s = Date.now(), ms = sec * 1000;
    for (;;) { const k = Math.min(1, (Date.now() - s) / ms); await f(k); if (k >= 1) return; await page.sleep(12); }
  };
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const a = {
    q, rec: null, detect: 0,
    sleep: (ms) => page.sleep(ms),
    eval: (js) => page.eval(js),
    log(what) { if (a.rec) console.log(`  ${a.rec.elapsed().toFixed(2)} s  ${what}`); },
    async hold(sec) { await page.sleep(sec * 1000); },
    async waitUntil(what, js, ms) {
      const s = Date.now();
      while (Date.now() - s < ms) { if (await page.eval(js).catch(() => false)) return; await page.sleep(50); }
      fail(`timed out after ${ms} ms waiting for ${what}`);
    },
    async waitFor(s, ms = WAIT.sheet) { a.log(`wait ${desc(s)}`); await a.waitUntil(desc(s), `!!(${q(s)})`, ms); },
    async center(s) {
      await a.waitFor(s);
      const c = await page.eval(`(() => { const e = ${q(s)}; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!c) fail(`not found: ${desc(s)}`);
      return c;
    },
    async moveTo(x, y, sec, buttons = 0) {
      const x0 = mx, y0 = my;
      await tween(sec, async (k) => {
        const e = ease(k);
        mx = x0 + (x - x0) * e; my = y0 + (y - y0) * e;
        await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mx, y: my, buttons, button: buttons ? "left" : "none" });
      });
    },
    async press() {
      await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: mx, y: my, button: "left", buttons: 1, clickCount: 1 });
      await page.sleep(90);
      await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mx, y: my, button: "left", buttons: 0, clickCount: 1 });
    },
    async click(s, sec = 0.5) { a.log(`click ${desc(s)}`); const c = await a.center(s); await a.moveTo(c.x, c.y, sec); await page.sleep(80); await a.press(); },
    async jsClick(s) { await a.waitFor(s); await page.eval(`(${q(s)}).click()`); },
    async drag(x0, y0, x1, y1, sec) {
      await a.moveTo(x0, y0, 0.05);
      await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", buttons: 1, clickCount: 1 });
      await a.moveTo(x1, y1, sec, 1);
      await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", buttons: 0, clickCount: 1 });
    },
    async wheel(s, dy, sec) {
      // The pointer moves into the box first: a wheel scrolls what is under the pointer.
      const c = await a.center(s);
      await a.moveTo(c.x + 120, c.y + 60, 0.3);
      let done = 0;
      await tween(sec, async (k) => {
        const d = dy * ease(k) - done; done += d;
        if (d) await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: mx, y: my, deltaX: 0, deltaY: d });
      });
    },
    async scrollTo(box, target, sec) {
      await a.waitFor(target);
      const dy = await page.eval(`(() => { const b = ${q(box)}; const t = ${q(target)}; return t.getBoundingClientRect().top - b.getBoundingClientRect().top - 40; })()`);
      const from = await page.eval(`(${q(box)}).scrollTop`);
      await tween(sec, (k) => page.eval(`(${q(box)}).scrollTop = ${from + dy * ease(k)}`));
    },
    async type(text, sec) {
      let n = 0;
      await tween(sec, async (k) => { const to = Math.round(text.length * k); if (to > n) { await page.send("Input.insertText", { text: text.slice(n, to) }); n = to; } });
    },
    async detectAt() {
      const r = await page.eval(`(() => { const s = ${q(SEL.seek)}; const m = [...document.querySelectorAll(${JSON.stringify(SEL.stageMark.css)})].find((e) => ${DETECT_PHASE}.test(e.title)); if (!s || !m) return null; return Number(s.min) + (Number(s.max) - Number(s.min)) * parseFloat(m.style.left) / 100; })()`);
      if (r == null) fail(`no detector mark: ${SEL.stageMark.css} with title ${DETECT_PHASE}, or no ${SEL.seek.css}`);
      return r;
    },
    async setSeek(v) {
      await page.eval(`(() => { const s = ${q(SEL.seek)}; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(s, ${v}); s.dispatchEvent(new Event("input", { bubbles: true })); s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    },
  };
  return a;
}

async function capture(page, shot) {
  console.log(`${shot.id}: ${shot.url}`);
  await page.send("Page.navigate", { url: shot.url });
  const a = actor(page, shot);
  await a.waitFor(SEL.carousel, WAIT.load);
  await a.waitFor(SEL.canvas, WAIT.load);
  await page.eval("document.fonts.ready.then(() => 1)");
  await page.sleep(WAIT.canvasSettle);
  if (shot.prepare) await shot.prepare(a);
  const dir = join(OUT, `${shot.id}.frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  a.rec = recorder(page, dir);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 960, y: 600 });
  await a.rec.start();
  await shot.run(a);
  // Never shorter than the slot: keep filming the live page (not a frozen frame) until the slot is full.
  while (a.rec.elapsed() < shot.slot + 0.25) await page.sleep(30);
  const { frames, end } = await a.rec.stop();
  const out = join(OUT, `${shot.id}.mp4`);
  encode(frames, end, dir, out);
  rmSync(dir, { recursive: true, force: true });
  const fps = frames.length / end;
  console.log(`  ${out}: ${end.toFixed(2)} s, ${frames.length} screencast frames (${fps.toFixed(1)} per second on average)`);
  writeFileSync(join(OUT, `${shot.id}.json`), JSON.stringify({ id: shot.id, slot: shot.slot, seconds: end, frames: frames.length, sourceFps: fps }, null, 2));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const page = await launch({ profile: PROFILE });
  try {
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: RING });
    for (const shot of SHOTS) if (!ONLY.length || ONLY.some((o) => shot.id.startsWith(o))) await capture(page, shot);
  } finally {
    page.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main().then(() => process.exit(0), (e) => { console.error(e instanceof ShotError ? `FAILED ${e.message}` : e); process.exit(1); });
