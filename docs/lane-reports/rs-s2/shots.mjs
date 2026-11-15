// rs-s2: side panel states. node shots.mjs <outdir>
import { launch, move } from "./cdp.mjs";
const OUT = process.argv[2] ?? ".";
const B = "http://localhost:5181/";
const p = await launch();
const state = () => p.eval(`JSON.stringify([...document.querySelectorAll(".console-left,.console-right")].map(a => { const b = a.querySelector(".panel-box").getBoundingClientRect(); return a.className + ":" + a.dataset.mode + " box " + Math.round(b.left) + ".." + Math.round(b.right) + " vis=" + getComputedStyle(a.querySelector(".panel-box")).visibility; }).concat(["center " + Math.round(document.querySelector(".console-center").getBoundingClientRect().width), "active " + (document.activeElement?.className || document.activeElement?.tagName)]))`);
const log = async (tag) => console.log(tag, await state());

await p.size(1440, 900);
await p.go(B + "?lib=0&ask=0", 3500);
await log("min"); await p.shot(`${OUT}/1440-both-min.png`);

const ls = await p.center(".console-left .panel-strip");
await move(p, ls.x, ls.y); await p.sleep(100); await log("left hover 100ms");
await p.sleep(300); await log("left hover 400ms"); await p.shot(`${OUT}/1440-left-peek.png`);
await move(p, 700, 450); await p.sleep(150); await log("left leave 150ms");
await p.sleep(400); await log("left leave 550ms");

const rs = await p.center(".console-right .panel-strip");
await move(p, rs.x, rs.y); await p.sleep(400);
const ta = await p.center(".console-right textarea");
await move(p, ta.x, ta.y); await p.click(ta.x, ta.y); await p.sleep(100);
await p.send("Input.insertText", { text: "What is a cool flame?" });
await move(p, 700, 450); await p.sleep(700); await log("right peek typing, pointer away 700ms");
await p.shot(`${OUT}/1440-right-peek.png`);
await p.key("Escape", "Escape", 27); await p.sleep(300); await log("after Esc");
await p.eval(`document.activeElement.blur()`);

// keyboard: Tab to left strip
await p.eval(`document.querySelector(".console-rail .icon-btn").focus()`);
await p.key("Tab", "Tab", 9); await p.sleep(250); await log("tab to left strip");
await p.key("Enter", "Enter", 13, "\r"); await p.sleep(300); await log("enter pins left");
await p.key("Enter", "Enter", 13, "\r"); await p.sleep(300); await log("enter on pin unpins");
// click right strip pins
await p.click(rs.x, rs.y); await p.sleep(400); await log("click right strip");
await p.go(B + "?lib=1&ask=1", 3500);
await log("pinned"); await p.shot(`${OUT}/1440-both-pinned.png`);
await p.go(B + "?lib=1&ask=1&view=rank", 3500); await p.shot(`${OUT}/1440-pinned-rank-sheet.png`);
await p.size(1700, 950); await p.go(B + "?lib=1&ask=1", 3500); await log("1700"); await p.shot(`${OUT}/1700-both-pinned.png`);
await p.size(1024, 768); await p.go(B + "?lib=1&ask=0", 3500); await log("1024"); await p.shot(`${OUT}/1024-left-pinned.png`);
await p.size(390, 844); await p.go(B + "?lib=0&ask=0", 3500); await log("390"); await p.shot(`${OUT}/390-stage.png`);
await p.go(B + "?lib=1&ask=0", 3500); await p.shot(`${OUT}/390-library.png`);
await p.go(B + "?lib=0&ask=1", 3500); await p.shot(`${OUT}/390-ask.png`);
await p.go(B + "?view=rank&lib=0&ask=0", 3500); await p.shot(`${OUT}/390-rank.png`);
p.close();
