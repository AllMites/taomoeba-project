import { expect, it } from "vitest";
import { askForHabitat, askRecords, readable } from "./respond.ts";

const claim = { id: "ask-1", investigationId: "PSI-20", kind: "finding", text: "t", sourceIds: ["psi:PSI-20"], excerpt: "e" };
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const ask = (f: () => Promise<Response>) => askRecords("q", "moon", f as typeof fetch);

for (const mode of ["live", "extractive", "mock"] as const) {
  it(`returns a ${mode} answer`, async () => {
    const out = await ask(() => json({ answer: "A [psi:PSI-20].", claims: [claim], investigationIds: ["PSI-20"], mode }));
    expect(out).toMatchObject({ kind: "answer", result: { mode, investigationIds: ["PSI-20"] } });
  });
}

it("tells no-cover apart", async () => {
  const out = await ask(() => json({ answer: "The PSI records I have do not cover that.", claims: [], investigationIds: [], mode: "extractive" }));
  expect(out.kind).toBe("nocover");
});

it("maps errors to plain words", async () => {
  expect(await ask(() => json({ error: "rate_limited" }, 429))).toMatchObject({ kind: "error", reason: "rate" });
  expect(await ask(() => json({ error: "too_long" }, 400))).toMatchObject({ kind: "error", reason: "toolong" });
  expect(await ask(() => json({ error: "bad_request" }, 400))).toMatchObject({ kind: "error", reason: "failed" });
  expect(await ask(() => json({ error: "server_error" }, 500))).toMatchObject({ kind: "error", reason: "failed" });
  expect(await ask(() => Promise.reject(new TypeError("fetch failed")))).toMatchObject({ kind: "error", reason: "offline" });
});

it("treats an HTML reply (plain npm run dev) as not running, without throwing", async () => {
  const html = () => Promise.resolve(new Response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html" } }));
  expect(await ask(html)).toMatchObject({ kind: "error", reason: "unavailable", message: "The question service is not running here." });
  const notFound = () => Promise.resolve(new Response("<html>404</html>", { status: 404 }));
  expect(await ask(notFound)).toMatchObject({ kind: "error", reason: "unavailable" });
});

it("treats JSON of the wrong shape as not running", async () => {
  expect(await ask(() => json({ hello: 1 }))).toMatchObject({ kind: "error", reason: "unavailable" });
});

it("strips source ids and the quoting lead-in", () => {
  expect(readable('I am quoting the PSI records directly: "Hi there." [psi:PSI-20] "Next." [ntrs:1]')).toBe('"Hi there." "Next."');
});

it("reports a rate limit even when the 429 body is an HTML page", async () => {
  const page = () => Promise.resolve(new Response("<html>Rate limited</html>", { status: 429, headers: { "content-type": "text/html" } }));
  expect(await ask(page)).toMatchObject({ kind: "error", reason: "rate" });
});

it("re-asks when the habitat changes while the reply is on its way", async () => {
  let habitat = "iss";
  const asked: string[] = [];
  const f = (_u: unknown, init?: RequestInit) => {
    const h = JSON.parse(String(init?.body)).habitat as string;
    asked.push(h);
    if (h === "iss") habitat = "moon"; // the user picks Moon Base while the ISS reply is in flight
    return json({ answer: `For ${h}.`, claims: [claim], investigationIds: [h], mode: "live" });
  };
  const out = await askForHabitat("q", () => habitat, f as typeof fetch);
  expect(asked).toEqual(["iss", "moon"]);
  expect(out).toMatchObject({ kind: "answer", result: { investigationIds: ["moon"] } });
});

it("does not re-ask once the question was cleared", async () => {
  let habitat = "iss";
  const ctl = new AbortController();
  let calls = 0;
  const f = () => {
    calls++;
    habitat = "moon";
    ctl.abort();
    return json({ answer: "A.", claims: [], investigationIds: [], mode: "mock" });
  };
  await askForHabitat("q", () => habitat, f as typeof fetch, ctl.signal);
  expect(calls).toBe(1);
});

it("handles exactly 300 characters and a reply without claims", async () => {
  let sent = "";
  const f = (_u: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body)).question;
    return json({ answer: "A.", investigationIds: [], mode: "live" });
  };
  expect(await askRecords("x".repeat(300), "moon", f as typeof fetch)).toMatchObject({ kind: "error", reason: "unavailable" });
  expect(sent).toHaveLength(300);
});
