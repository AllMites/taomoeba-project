// Target sizes, overflow, tab order and states for Top, Brief line, Library and Ask.
import { launch } from "./cdp.mjs";
const OUT = process.argv[2];
const tag = process.argv[3] ?? "";
const p = await launch();
const BASE = "http://localhost:5184/";
const MEASURE = `(() => {
  const roots = [".top", ".briefline", ".lib", ".ask-panel"];
  const vw = innerWidth;
  const small = [], over = [];
  for (const r of roots) for (const root of document.querySelectorAll(r)) {
    if (!root.offsetParent && getComputedStyle(root).position !== "fixed") continue;
    for (const el of root.querySelectorAll("button, a[href], input, textarea, select, summary")) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || el.closest("[hidden]")) continue;
      if (b.width < 44 || b.height < 44) small.push(r + " " + (el.className || el.tagName) + " '" + (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30) + "' " + Math.round(b.width) + "x" + Math.round(b.height));
    }
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > vw + 0.5 || b.left < -0.5)) over.push(r + " " + (el.className || el.tagName) + " " + Math.round(b.left) + ".." + Math.round(b.right));
    }
  }
  const doc = document.scrollingElement;
  return { vw, docScroll: [doc.scrollWidth, doc.clientWidth, doc.scrollHeight, doc.clientHeight], small: [...new Set(small)].slice(0, 40), over: [...new Set(over)].slice(0, 20) };
})()`;
const TAB = `(() => document.activeElement && ((document.activeElement.closest(".top,.briefline,.lib,.ask-panel")?.className.split(" ")[0] ?? "-") + " " + (document.activeElement.className || document.activeElement.tagName) + " '" + (document.activeElement.textContent || document.activeElement.getAttribute("aria-label") || "").trim().slice(0, 24) + "'"))()`;

for (const [w, h, q] of [[1440, 900, "lib=1&ask=1"], [1440, 900, "base=rover&lib=1&ask=1"], [390, 844, "lib=0&ask=0"], [390, 844, "lib=1&ask=0"], [390, 844, "lib=0&ask=1"], [320, 640, "lib=0&ask=0"], [320, 640, "lib=1&ask=0"], [320, 640, "lib=0&ask=1"]]) {
  await p.size(w, h);
  await p.go(BASE + "?" + q, 3000);
  console.log(`\n== ${w}x${h} ${q}`);
  console.log(JSON.stringify(await p.eval(MEASURE), null, 1));
  await p.shot(`${OUT}/${tag}${w}-${q.replace(/[=&]/g, "_")}.png`);
}

// Tab order at 1440, both panels open: first 40 stops
await p.size(1440, 900);
await p.go(BASE + "?lib=1&ask=1", 3000);
const stops = [];
for (let i = 0; i < 0; i++) { await p.key("Tab", "Tab", 9); stops.push(await p.eval(TAB)); }
console.log("\n== tab order\n" + stops.map((s, i) => `${i + 1} ${s}`).join("\n"));
p.close();
