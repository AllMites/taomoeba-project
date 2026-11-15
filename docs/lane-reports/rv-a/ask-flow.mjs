// Ask panel behaviour in the real console, driven through CDP. /ask is stubbed with Fetch.requestPaused.
import { launch } from "./cdp.mjs";
const OUT = process.argv[2];
const BASE = "http://localhost:5184/";
const p = await launch();
const log = (k, v) => console.log(k.padEnd(44), JSON.stringify(v));

const bodies = [];
await p.send("Fetch.enable", { patterns: [{ urlPattern: "*/ask", requestStage: "Request" }] });
p.on(async (m) => {
  if (m.method === "Fetch.requestPaused") {
    bodies.push(JSON.parse(m.params.request.postData ?? "{}"));
    const result = {
      answer: "FLEX-2 burned fuel droplets in microgravity and measured how big they were when the flame went out.",
      claims: [{ id: "ask-1", investigationId: "PSI-69", kind: "finding", text: "FLEX-2 measured extinction diameters.", sourceIds: ["psi:PSI-69"], excerpt: "Droplet extinction diameters were measured." }],
      investigationIds: ["PSI-69"], mode: "live", model: "claude-haiku", steps: { searched: 64, matched: 6, facts: 0, reranked: 6, kept: 1, dropped: 0, checked: 1 },
    };
    await p.sleep(400);
    await p.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(result)).toString("base64") });
  }
});

await p.size(1440, 900);
await p.go(BASE + "?lib=1&ask=1", 3000);
const chips = () => p.eval(`[...document.querySelectorAll(".ask-about-chip .ask-about-name")].map(e => e.textContent)`);

// 1. chips add once
let c = await p.center(".top-row:nth-child(1) .top-ask");
await p.click(c.x, c.y); await p.sleep(200);
await p.click(c.x, c.y); await p.sleep(200);
log("chips after two presses on the same row", await chips());
c = await p.center(".lib-row:nth-child(2) .lib-ask");
await p.click(c.x, c.y); await p.sleep(200);
log("chips after a Library press", await chips());
log("focus after a chip is added", await p.eval(`document.activeElement?.id`));
await p.shot(`${OUT}/1440-chips.png`);
c = await p.center(".ask-about-chip:nth-child(2) .ask-about-x");
await p.click(c.x, c.y); await p.sleep(200);
log("chips after remove", await chips());

// 2. send with chip: about goes to /ask
await p.eval(`document.getElementById("ask-compose").focus()`);
await p.send("Input.insertText", { text: "What did it find?" });
await p.key("Enter", "Enter", 13, "\r"); await p.sleep(1200);
log("request body", bodies.at(-1));
log("turn about line", await p.eval(`document.querySelector(".ask-q-about")?.textContent`));
log("chips kept after send", await chips());
await p.shot(`${OUT}/1440-scoped-answer.png`);

// 3. close keeps it mounted and the thread
c = await p.center(".ask-panel-actions .ask-btn:last-child");
await p.click(c.x, c.y); await p.sleep(300);
log("after Close: panel in DOM, hidden", await p.eval(`(() => { const s = document.querySelector(".ask-panel"); return { inDom: !!s, hidden: s?.hidden, asideHidden: document.querySelector(".console-right")?.hidden ?? null, turns: document.querySelectorAll(".ask-turn").length }; })()`));

// 4. what-if "Ask about this" (askRequest) opens and sends
await p.eval(`(async () => { const m = await import("/src/app/console.ts"); m.useConsole.getState().setView("models"); })()`);
await p.sleep(1500);
await p.eval(`document.querySelector(".whatif-chip")?.scrollIntoView({block:"center"})`); await p.sleep(300);
const wf = await p.center(".whatif-chip");
log("what-if chip found", wf);
if (wf) { await p.click(wf.x, wf.y); await p.sleep(1200); }
log("after what-if ask: panel open, turns, last body", await p.eval(`(() => ({ open: !document.querySelector(".ask-panel").hidden, turns: [...document.querySelectorAll(".ask-q")].map(e => e.textContent) }))()`));
log("what-if request body", bodies.at(-1));
await p.shot(`${OUT}/1440-whatif-asked.png`);

// 5. New chat clears chips and thread
await p.eval(`(async () => { const m = await import("/src/app/console.ts"); m.useConsole.getState().setView("stage"); })()`);
await p.sleep(300);
c = await p.center(".ask-panel-actions .ask-btn:first-child");
await p.click(c.x, c.y); await p.sleep(300);
log("after New chat: chips, turns", { chips: await chips(), turns: await p.eval(`document.querySelectorAll(".ask-turn").length`) });

// 6. real drag: intercept the drag Chrome starts from a Top row, then drop it on the panel
await p.send("Input.setInterceptDrags", { enabled: true });
let dragData = null;
p.on((m) => { if (m.method === "Input.dragIntercepted") dragData = m.params.data; });
const src = await p.center(".top-row:nth-child(2) .top-open");
await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: src.x, y: src.y, button: "left", clickCount: 1 });
for (let i = 1; i <= 6; i++) await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: src.x + i * 40, y: src.y - i * 10, button: "left", buttons: 1 });
await p.sleep(300);
log("drag intercepted, types", dragData?.items?.map((i) => i.mimeType));
const tgt = await p.center(".ask-body");
await p.send("Input.dispatchDragEvent", { type: "dragEnter", x: tgt.x, y: tgt.y, data: dragData });
await p.send("Input.dispatchDragEvent", { type: "dragOver", x: tgt.x, y: tgt.y, data: dragData });
await p.sleep(200);
log("while held over: data-drop", await p.eval(`document.querySelector(".ask-panel").dataset.drop ?? null`));
await p.shot(`${OUT}/1440-drop.png`);
await p.send("Input.dispatchDragEvent", { type: "drop", x: tgt.x, y: tgt.y, data: dragData });
await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: tgt.x, y: tgt.y, button: "left", clickCount: 1 });
await p.sleep(300);
log("after drop: chips, data-drop", { chips: await chips(), drop: await p.eval(`document.querySelector(".ask-panel").dataset.drop ?? null`) });
await p.shot(`${OUT}/1440-dropped.png`);

// 7. Escape closes and focus returns
await p.eval(`document.getElementById("ask-compose").focus()`);
await p.key("Escape", "Escape", 27); await p.sleep(300);
log("after Escape: hidden, focus", await p.eval(`({ hidden: document.querySelector(".ask-panel").hidden, focus: document.activeElement?.className || document.activeElement?.tagName })`));
p.close();
