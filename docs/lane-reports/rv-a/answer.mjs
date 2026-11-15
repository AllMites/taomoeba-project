import { launch } from "./cdp.mjs";
const p = await launch();
await p.send("Fetch.enable", { patterns: [{ urlPattern: "*/ask", requestStage: "Request" }] });
p.on(async (m) => {
  if (m.method !== "Fetch.requestPaused") return;
  const result = { answer: "FLEX measured extinction diameters.", claims: [{ id: "ask-1", investigationId: "PSI-69", kind: "finding", text: "FLEX measured extinction.", sourceIds: ["psi:PSI-69"], excerpt: "Droplet extinction diameters were measured." }], investigationIds: ["PSI-69"], mode: "live", model: "claude-haiku", sources: { "psi:PSI-69": { title: "Flame Extinguishment Experiment (FLEX)", url: "https://example.org/flex", license: "" } } };
  await p.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(result)).toString("base64") });
});
for (const [w, h] of [[1440, 900], [320, 640]]) {
  await p.size(w, h);
  await p.go("http://localhost:5184/?lib=0&ask=1", 3000);
  await p.eval(`document.getElementById("ask-compose").focus()`);
  await p.send("Input.insertText", { text: "What did FLEX find?" });
  await p.key("Enter", "Enter", 13, "\r"); await p.sleep(900);
  await p.eval(`document.querySelectorAll(".ask-panel details").forEach(d => d.open = true)`); await p.sleep(200);
  console.log(w, JSON.stringify(await p.eval(`(() => { const out = []; const vw = innerWidth; for (const el of document.querySelectorAll(".ask-panel button, .ask-panel a[href], .ask-panel summary, .ask-panel textarea")) { const b = el.getBoundingClientRect(); if (!b.width || el.closest("[hidden]")) continue; if (b.height < 44 || b.width < 44) out.push((el.className || el.tagName) + " '" + el.textContent.trim().slice(0, 28) + "' " + Math.round(b.width) + "x" + Math.round(b.height) + " deco=" + getComputedStyle(el).textDecorationLine); if (b.right > vw + 0.5) out.push("OVER " + el.className); } return out; })()`)));
  await p.shot(process.argv[2] + `/${w}-answer-open.png`);
}
p.close();
