import { launch } from "./cdp.mjs";
const p = await launch();
await p.send("Fetch.enable", { patterns: [{ urlPattern: "*/ask", requestStage: "Request" }] });
p.on(async (m) => {
  if (m.method !== "Fetch.requestPaused") return;
  const result = { answer: "FLEX measured extinction.", claims: [{ id: "ask-1", investigationId: "PSI-159", kind: "finding", text: "x.", sourceIds: ["psi:PSI-159"], excerpt: "e" }], investigationIds: ["PSI-159"], mode: "live", model: "claude-haiku" };
  await p.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(result)).toString("base64") });
});
await p.size(1440, 900);
await p.go("http://localhost:5184/?lib=1&ask=1", 3000);
const pos = () => p.eval(`({ doc: document.scrollingElement.scrollTop, console: Math.round(document.querySelector(".console").getBoundingClientRect().top), view: document.querySelector(".console").dataset.view })`);
await p.eval(`document.getElementById("ask-compose").focus()`);
await p.send("Input.insertText", { text: "q" });
await p.key("Enter", "Enter", 13, "\r"); await p.sleep(800);
for (let n = 1; n <= 3; n++) {
  const c = await p.center(".ask-show");
  await p.click(c.x, c.y); await p.sleep(1200);
  console.log("press", n, JSON.stringify(await pos()));
  await p.shot(process.argv[2] + `/1440-show-${n}.png`);
  await p.eval(`(async () => (await import("/src/app/console.ts")).useConsole.getState().setView("stage"))()`); await p.sleep(400);
}
p.close();
