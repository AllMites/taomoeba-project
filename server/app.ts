import { Hono } from "hono";
import { z } from "zod";
import claimsFixture from "../public/data/fixtures/claims.fixture.json";
import sourcesFixture from "../public/data/fixtures/sources.fixture.json";
import { HabitatId } from "../src/contracts/habitat.ts";
import { ask, type AskEnv } from "./ask.ts";
import { buildIndex, type Bm25Index, type Chunk } from "./bm25.ts";
import { verify } from "./verify.ts";

export type Env = AskEnv & {
  TYPESAFE_API_KEY?: string;
  // Static-assets binding (Lane O): used to load /data/index.json built by Lane B.
  ASSETS?: { fetch: (r: Request | string) => Promise<Response> };
};

export const MAX_QUESTION = 300;
const BUCKET_CAPACITY = 10; // requests of burst per IP
const REFILL_PER_SEC = 1 / 6; // one request every 6 s sustained
const CACHE_MAX = 200;

/** Tiny index from the fixtures, used until Lane B's public/data/index.json exists. */
export function fixtureIndex(): Bm25Index {
  const invBySource = new Map<string, string>();
  for (const c of claimsFixture.items) for (const s of c.sourceIds) invBySource.set(s, c.investigationId);
  const chunks: Chunk[] = [
    ...sourcesFixture.items.map((s) => ({ id: s.id, sourceId: s.id, investigationId: invBySource.get(s.id) ?? null, text: s.excerpt })),
    ...claimsFixture.items.map((c) => ({ id: c.id, sourceId: c.sourceIds[0], investigationId: c.investigationId, text: c.text })),
  ];
  return buildIndex(chunks);
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const AskBody = z.object({ question: z.string(), habitat: HabitatId.optional() });
const VerifyBody = z.object({ text: z.string().max(2000), excerpt: z.string().max(4000), sourceText: z.string().max(200_000).optional() });

export function createApp(opts: { index?: Bm25Index } = {}) {
  // ponytail: rate limit and cache are per-isolate memory only. Ceiling: each Worker isolate has its own
  // bucket, so abuse across isolates is not capped. Move to a Durable Object or KV if abused.
  const buckets = new Map<string, { tokens: number; at: number }>();
  const cache = new Map<string, unknown>();
  let loaded: Promise<Bm25Index> | undefined;

  const getIndex = (env: Env, origin: string): Promise<Bm25Index> => {
    if (opts.index) return Promise.resolve(opts.index);
    loaded ??= (async () => {
      try {
        const r = await env.ASSETS?.fetch(new URL("/data/index.json", origin).toString());
        if (r?.ok) return (await r.json()) as Bm25Index;
      } catch {
        /* fall through to fixtures */
      }
      return fixtureIndex();
    })();
    return loaded;
  };

  const take = (ip: string) => {
    const now = Date.now();
    const b = buckets.get(ip) ?? { tokens: BUCKET_CAPACITY, at: now };
    b.tokens = Math.min(BUCKET_CAPACITY, b.tokens + ((now - b.at) / 1000) * REFILL_PER_SEC);
    b.at = now;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    buckets.set(ip, b);
    if (buckets.size > 5000) buckets.delete(buckets.keys().next().value!);
    return ok;
  };

  const app = new Hono<{ Bindings: Env }>();
  app.onError((_e, c) => c.json({ error: "server_error", message: "Something went wrong." }, 500));
  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/ask", async (c) => {
    if (!take(c.req.header("cf-connecting-ip") ?? "anon")) return c.json({ error: "rate_limited", message: "Too many questions. Try again in a few seconds." }, 429);
    const body = AskBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "bad_request", message: "Send { question: string, habitat?: HabitatId }." }, 400);
    const question = body.data.question.trim();
    if (!question) return c.json({ error: "bad_request", message: "Question is empty." }, 400);
    if (question.length > MAX_QUESTION) return c.json({ error: "too_long", message: `Question must be ${MAX_QUESTION} characters or fewer.` }, 400);

    const key = await sha256(`${question.toLowerCase().replace(/\s+/g, " ")}|${body.data.habitat ?? ""}`);
    if (cache.has(key)) return c.json(cache.get(key));
    const index = await getIndex(c.env ?? {}, new URL(c.req.url).origin);
    const { degraded, ...result } = await ask(index, question, body.data.habitat, c.env ?? {});
    if (!degraded) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, result);
    }
    return c.json(result);
  });

  app.post("/verify", async (c) => {
    const body = VerifyBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "bad_request", message: "Send { text, excerpt, sourceText? }." }, 400);
    const { usage: _usage, ...out } = await verify(body.data, { TYPESAFE_API_KEY: c.env?.TYPESAFE_API_KEY });
    return c.json(out);
  });

  app.post("/rank", (c) => c.json({ error: "not_implemented", message: "Rankings are precomputed in public/data/rank.json." }, 501));
  return app;
}


