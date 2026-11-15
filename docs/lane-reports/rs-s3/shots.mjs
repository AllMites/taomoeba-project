// rs-s3: collapsed HUD bar. node shots.mjs <outdir>
import { launch } from "./cdp.mjs";
const OUT = process.argv[2] ?? ".";
const B = "http://localhost:5194/";
const p = await launch();
const info = () => p.eval(`JSON.stringify({center: Math.round(document.querySelector(".console-center").getBoundingClientRect().width), bar: getComputedStyle(document.querySelector(".hud-bar")).display, stageBottom: Math.round(document.querySelector(".console-center > .stage").getBoundingClientRect().bottom), barTop: Math.round(document.querySelector(".hud-bar").getBoundingClientRect().top), active: document.activeElement?.className||document.activeElement?.tagName})`);
const run = async (name, w, h, q, after) => { await p.size(w, h); await p.go(B + q, 4500); console.log(name, await info()); if (after) await after(); await p.shot(`${OUT}/${name}.png`); };

await run("390-moon-collapsed", 390, 844, "?base=moon");
// what is at the playback bar's center?
console.log("hit", await p.eval(`(() => { const out = []; for (const el of document.querySelectorAll(".stage button, .stage input[type=range], .stage select")) { const r = el.getBoundingClientRect(); if (!r.width || r.bottom > innerHeight) continue; const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); out.push((el.className || el.tagName) + " " + Math.round(r.y) + "-" + Math.round(r.bottom) + " ok=" + (el === e || el.contains(e) || e.contains(el)) + " hit=" + (e.className || e.tagName)); } return out.join(" ; "); })()`));
await run("390-moon-top3-open", 390, 844, "?base=moon", async () => { const c = await p.center('[data-card="top"]'); await p.click(c.x, c.y); await p.sleep(400); console.log("after open", await info()); });
await run("390-moon-brief-open", 390, 844, "?base=moon", async () => { const c = await p.center('[data-card="brief"]'); await p.click(c.x, c.y); await p.sleep(400); console.log("after open", await info()); });
// one at a time, Esc, focus
await p.go(B + "?base=moon", 4000);
let c = await p.center('[data-card="top"]'); await p.click(c.x, c.y); await p.sleep(300);
c = await p.center('[data-card="brief"]'); await p.click(c.x, c.y); await p.sleep(300);
console.log("swap", await p.eval(`JSON.stringify([...document.querySelectorAll(".hud-btn")].map(b=>b.dataset.card+":"+b.ariaExpanded)) + " vis " + getComputedStyle(document.querySelector(".console-overlay")).display+"/"+getComputedStyle(document.querySelector(".console-brief")).display + " focus=" + document.activeElement.className`));
await p.key("Escape", "Escape", 27); await p.sleep(300);
console.log("esc", await p.eval(`JSON.stringify([...document.querySelectorAll(".hud-btn")].map(b=>b.dataset.card+":"+b.ariaExpanded)) + " focus=" + document.activeElement.dataset.card`));
c = await p.center('[data-card="top"]'); await p.click(c.x, c.y); await p.sleep(300); await p.click(200, 300); await p.sleep(300);
console.log("outside", await p.eval(`JSON.stringify([...document.querySelectorAll(".hud-btn")].map(b=>b.dataset.card+":"+b.ariaExpanded))`));

await run("1280-iss-both-pinned", 1280, 720, "?base=iss&lib=1&ask=1");
await run("1440-iss-both-pinned", 1440, 900, "?base=iss&lib=1&ask=1");
await run("1440-iss-top3-open-pinned", 1440, 900, "?base=iss&lib=1&ask=1", async () => { const c = await p.center('[data-card="top"]'); await p.click(c.x, c.y); await p.sleep(400); });
await run("1440-iss-wide", 1440, 900, "?base=iss");
await run("1440-earth-wide", 1440, 900, "?base=earth");
await run("390-earth", 390, 844, "?base=earth", async () => { const c = await p.center('[data-card="top"]'); await p.click(c.x, c.y); await p.sleep(400); });
p.close();
