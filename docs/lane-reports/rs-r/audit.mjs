// rs-r: small-screen layout audit. Own headless Chrome (CDP 9342, own profile), Vite on 5202.
// node docs/lane-reports/rs-r/audit.mjs [outdir] [sizes like 390x844,320x568] [--shots]
// Prints one JSON line per state: overflow, covered controls, small targets, small inputs, clipped text,
// scrollers whose end is off screen, wide boxes without an inner scroll.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9342;
const B = "http://localhost:5202/";
const OUT = process.argv[2] ?? "docs/lane-reports/rs-r";
const SIZES = (process.argv[3] ?? "320x568,360x740,390x844,414x896,844x390,600x960,768x1024,1024x768").split(",").map((s) => s.split("x").map(Number));
const SHOTS = process.argv.includes("--shots");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
mkdirSync(OUT, { recursive: true });

const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.RS_R_PROFILE ?? process.env.TEMP + "/rs-r-chrome"}`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 50; i++) {
  try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
}
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const shot = async (path) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(r.data, "base64")); };
const click = async (sel) => {
  const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block:"nearest", inline:"nearest"}); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!c) return false;
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: c.x, y: c.y, button: "left", clickCount: 1 });
  await sleep(400);
  return true;
};
await send("Page.enable"); await send("Runtime.enable");

// Runs in the page. Returns the faults for the current state.
const AUDIT = `(() => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement;
  const name = (e) => { const c = typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\\s+/).join(".") : ""; const l = e.getAttribute("aria-label") || (e.textContent || "").trim().slice(0, 24); return e.tagName.toLowerCase() + c + (l ? " [" + l + "]" : ""); };
  const shown = (e) => { if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const sr = (e) => { const r = e.getBoundingClientRect(); return r.width <= 2 || r.height <= 2 || getComputedStyle(e).clipPath.includes("inset(50%"); };
  // Clip rect from scrolling/clipping ancestors (not the console itself).
  const clipRect = (e) => { let L = 0, T = 0, R = vw, Bm = vh; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) { const r = p.getBoundingClientRect(); L = Math.max(L, r.left); T = Math.max(T, r.top); R = Math.min(R, r.right); Bm = Math.min(Bm, r.bottom); } } return { L, T, R, B: Bm }; };
  const out = { html: { sw: de.scrollWidth, cw: de.clientWidth, sh: de.scrollHeight, ch: de.clientHeight, sx: scrollX, sy: scrollY }, covered: [], small: [], inputs: [], clipped: [], scrollEnd: [], wide: [], offscreen: [] };
  // Layers that sit over others on purpose (a sheet, an open panel, an open popover, an open HUD card).
  const OVER = ".sheet, .console-left[data-mode=pinned], .console-right[data-mode=pinned], .console-left[data-mode=peek], .console-right[data-mode=peek], details[open] > :not(summary), .console-hud[data-open=brief] .console-brief, .console-hud[data-open=top] .console-overlay, .evidence, [role=dialog]";
  const memo = new Map();
  const isScroller = (p) => { if (!memo.has(p)) { const ps = getComputedStyle(p); memo.set(p, /(auto|scroll)/.test(ps.overflowX + ps.overflowY) ? 2 : /(auto|scroll)/.test(ps.overflowX) ? 1 : 0); } return memo.get(p); };
  const scrolls = (e) => { for (let p = e.parentElement; p; p = p.parentElement) if (isScroller(p)) return true; return false; };
  const ctrls = [...document.querySelectorAll("button, a[href], summary, input:not([type=hidden]), select, textarea, [role=button], [role=tab], label:has(> input.sr-only)")];
  for (const e of ctrls) {
    if (!shown(e)) continue;
    if (e.matches("input.sr-only, .sr-only")) continue;
    if (e.closest("[inert], [aria-hidden=true], details:not([open]) > :not(summary), .skip")) continue;
    if (e.matches("input[type=checkbox], input[type=radio]") && e.closest("label")) continue;
    const r = e.getBoundingClientRect();
    if (e.matches("input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]), select, textarea") && !sr(e)) { const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 16) out.inputs.push(name(e) + " font " + fs + "px"); }
    if (sr(e)) continue;
    const c = clipRect(e);
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    if (cx < c.L || cx > c.R || cy < c.T || cy > c.B) { if (cx < 0 || cx > vw || cy < 0 || cy > vh) { if (!scrolls(e)) out.offscreen.push(name(e) + " @" + Math.round(cx) + "," + Math.round(cy)); } continue; }
    const hit = document.elementFromPoint(cx, cy);
    const over = hit && hit.closest(OVER);
    const modal = over && !over.contains(e);
    if (hit && !modal && !(hit === e || e.contains(hit) || hit.contains(e) || (e.tagName === "LABEL" && e.control === hit))) out.covered.push(name(e) + " by " + name(hit));
    const inline = e.tagName === "A" && e.closest("p, li, dd, td") && getComputedStyle(e).display === "inline";
    if (!inline && (r.width < 43.5 || r.height < 43.5)) out.small.push(name(e) + " " + Math.round(r.width) + "x" + Math.round(r.height));
  }
  for (const e of document.querySelectorAll("body *")) {
    if (!shown(e)) continue;
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    // scrollers whose box runs past the screen: their end cannot be reached
    if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1 && (r.bottom > vh + 1 || r.top < -1) && !scrolls(e)) out.scrollEnd.push(name(e) + " box " + Math.round(r.top) + "-" + Math.round(r.bottom) + " of " + vh);
    if (/(auto|scroll)/.test(s.overflowX) && r.right > vw + 1 && !scrolls(e)) out.scrollEnd.push(name(e) + " x-box right " + Math.round(r.right) + " of " + vw);
    // text clipped by a hidden/clip box (not an ellipsis by design)
    if (/(hidden|clip)/.test(s.overflowX) && s.textOverflow !== "ellipsis" && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && !sr(e) && e.childElementCount < 40 && !e.matches(".console, .console-center, .sheet, .stage, .stage *, canvas")) out.clipped.push(name(e).slice(0, 70) + " sw " + e.scrollWidth + " cw " + e.clientWidth);
    // wide boxes with no scrolling ancestor
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !sr(e) && !e.closest(".stage") && s.position !== "fixed") {
      const scroller = scrolls(e);
      if (!scroller && ["TABLE", "SVG", "svg", "CANVAS", "PRE", "UL", "OL", "DL", "SECTION", "DIV", "FIGURE", "P"].includes(e.tagName)) {
        const c = clipRect(e);
        if (r.right > c.R + 1 || r.left < c.L - 1) out.wide.push(name(e).slice(0, 70) + " " + Math.round(r.left) + "-" + Math.round(r.right));
      }
    }
  }
  // de-noise: keep only outermost wide boxes
  out.wide = [...new Set(out.wide)].slice(0, 12);
  return out;
})()`;

const results = [];
const record = async (size, state) => {
  const a = await ev(AUDIT);
  const ov = a.html.sw > a.html.cw || a.html.sx !== 0 || a.html.sy !== 0;
  const row = { size, state, overflow: ov ? a.html : undefined, ...Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== "html" && v.length)) };
  results.push(row);
  console.log(JSON.stringify(row));
  writeFileSync(`${OUT}/audit.json`, JSON.stringify(results, null, 1));
  if (SHOTS) await shot(`${OUT}/${size}-${state.replace(/[^a-z0-9]+/gi, "-")}.png`);
};

const VIEWS = ["interpret", "rank", "compare", "materials", "models", "graph"];
for (const [w, h] of SIZES) {
  const size = `${w}x${h}`;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Emulation.setTouchEmulationEnabled", { enabled: w < 768 });
  const go = async (q, wait = 2500) => { await send("Page.navigate", { url: B + q }); await sleep(wait); };
  const want = (s) => !ONLY || ONLY.split("|").some((o) => s.includes(o));
  if (want("stage")) {
    for (const base of ["iss", "moon", "rover", "earth"]) {
      await go(`?base=${base}&view=stage&lib=0&ask=0`);
      await record(size, `stage-${base}`);
      if (base === "iss" || base === "moon") {
        // the scene picker: open, list, pick the other scene
        if (await click(".stage-pick-btn")) {
          await record(size, `stage-${base}-picker-open`);
          const n = await ev(`document.querySelectorAll(".stage-pick-opt").length`);
          if (n > 1 && (await click(".stage-pick-opt:not(:has(input:checked))"))) { await sleep(1500); await record(size, `stage-${base}-scene2`); }
        }
      }
    }
    await go(`?base=iss&view=stage&lib=0&ask=0`);
    if (await click('[data-card="top"]')) await record(size, "hud-top3");
    if (await click('[data-card="brief"]')) await record(size, "hud-brief");
    await go(`?base=earth&view=stage&lib=0&ask=0`);
    if (await click('[data-card="top"]')) await record(size, "hud-earth");
    // carousel: last base reachable
    await go(`?base=iss&view=stage&lib=0&ask=0`);
    console.log("carousel", size, await ev(`JSON.stringify([...document.querySelectorAll(".base")].map(b => { b.scrollIntoView({inline:"nearest", block:"nearest"}); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return b.textContent.trim().slice(0,10) + ":" + (b === e || b.contains(e)) + ":" + Math.round(r.width) + "x" + Math.round(r.height); }))`));
    console.log("nav", size, await ev(`JSON.stringify([...document.querySelectorAll(".console-nav .nav-btn, .console-top .ask-pill")].map(b => { b.scrollIntoView({inline:"nearest", block:"nearest"}); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return b.textContent.trim().slice(0,12) + ":" + (b === e || b.contains(e)) + ":" + Math.round(r.x) + "-" + Math.round(r.right); }))`));
  }
  for (const v of VIEWS) {
    if (!want(v)) continue;
    await go(`?base=iss&view=${v}&lib=0&ask=0`);
    await record(size, `sheet-${v}`);
    // scroll the sheet to its end and check the last child is in view
    console.log("sheet-end", size, v, await ev(`(() => { const b = document.querySelector(".sheet-body"); if (!b) return "no sheet"; b.scrollTop = b.scrollHeight; const last = b.lastElementChild; const lr = last?.getBoundingClientRect(), br = b.getBoundingClientRect(); return JSON.stringify({ body: [Math.round(br.top), Math.round(br.bottom)], last: lr && [Math.round(lr.top), Math.round(lr.bottom)], vh: innerHeight, reach: lr ? lr.bottom <= Math.min(br.bottom, innerHeight) + 1 : null }); })()`));
  }
  if (want("lib")) {
    await go(`?base=iss&view=stage&lib=1&ask=0`);
    await record(size, "library");
    console.log("lib-end", size, await ev(`(() => { const b = document.querySelector(".console-left .panel-scroll"); if (!b) return "none"; b.scrollTop = b.scrollHeight; const br = b.getBoundingClientRect(); return JSON.stringify({ box: [Math.round(br.top), Math.round(br.bottom)], vh: innerHeight, sh: b.scrollHeight, ch: b.clientHeight }); })()`));
  }
  if (want("ask")) {
    await go(`?base=iss&view=stage&lib=0&ask=1`);
    await ev(`(() => { const t = document.querySelector(".console-right textarea"); if (!t) return; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(t, "Which fire experiment flew closest to a real cabin, and how sure is that ranking?"); t.dispatchEvent(new Event("input", { bubbles: true })); t.focus(); })()`);
    await sleep(300);
    await record(size, "ask-typed");
    if (want("ask-rank")) { await go(`?base=iss&view=rank&lib=0&ask=1`); await record(size, "ask-over-rank"); }
  }
}
writeFileSync(`${OUT}/audit.json`, JSON.stringify(results, null, 1));
ws.close(); proc.kill();
