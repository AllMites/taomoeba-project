import { expect, it } from "vitest";
import { askRecords, readable } from "./respond.ts";

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
