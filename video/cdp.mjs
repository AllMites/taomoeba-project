// Minimal CDP driver for the video rig: own headless Chrome on port 9344, own profile.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9344;
// WebGL: the GPU through ANGLE/D3D11 by default (smooth); VIDEO_GL=swiftshader forces software GL (slow, but always there).
const GL = process.env.VIDEO_GL === "swiftshader"
  ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-gl=angle"]
  : ["--use-angle=d3d11", "--use-gl=angle", "--enable-gpu"];

export async function launch({ profile, width = 1920, height = 1080 } = {}) {
  mkdirSync(profile, { recursive: true });
  const args = ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run",
    "--no-default-browser-check", "--mute-audio", ...GL, "--ignore-gpu-blocklist",
    "--enable-webgl", `--window-size=${width},${height}`, "about:blank"];
  const proc = spawn(CHROME, args, { stdio: "ignore" });
  let ok = false;
  for (let i = 0; i < 75; i++) {
    try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); ok = true; break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!ok) throw new Error(`Chrome did not open its debugging port ${PORT}`);
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
    else if (msg.method) for (const l of listeners) l(msg);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = {
    send, sleep,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async size(w, h) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
    async eval(expr) { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)); return r.result.value; },
    async shot(path) { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(r.data, "base64")); },
    close() { try { ws.close(); } catch {} proc.kill(); },
  };
  await send("Page.enable"); await send("Runtime.enable");
  await page.size(width, height);
  return page;
}
