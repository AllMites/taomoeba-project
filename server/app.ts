import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import claimsFixture from "../public/data/fixtures/claims.fixture.json";
import sourcesFixture from "../public/data/fixtures/sources.fixture.json";
import { HabitatId } from "../src/contracts/habitat.ts";
import { ask, normQuestion, type AskEnv, type AskExtras, type AskResult, type SourceInfo } from "./ask.ts";
import type { DataFact } from "./facts.ts";
import { buildIndex, type Bm25Index, type Chunk } from "./bm25.ts";
import { verify } from "./verify.ts";

export type Env = AskEnv & {
  TYPESAFE_API_KEY?: string;
  // Static-assets binding (Lane O): used to load /data/index.json built by Lane B.
  ASSETS?: { fetch: (r: Request | string) => Promise<Response> };
  // Private KV store (wrangler.toml [[kv_namespaces]] binding LIBRARY): key "restricted-index" holds the text of
  // papers NASA marks "short quotes only" (built by scripts/rag/add_papers.py). Not set = the site runs without them.
  LIBRARY?: { get: (key: string, type: "json") => Promise<unknown> };
};

export const MAX_QUESTION = 300;
const BUCKET_CAPACITY = 10; // requests of burst per IP
const REFILL_PER_SEC = 1 / 6; // one request every 6 s sustained
const CACHE_MAX = 200;
const BUCKETS_MAX = 5000;

/**
 * Rate-limit key from CF-Connecting-IP (set by Cloudflare, not spoofable; X-Forwarded-For is never read).
 * IPv6 is keyed by its /64, since one client usually holds a whole /64 and could rotate addresses inside it.
 */
export function clientKey(ip: string | undefined): string {
  if (!ip) return "anon";
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

/** Tiny index from the fixtures, used until Lane B's public/data/index.json exists. */
export function fixtureIndex(): Bm25Index {
  const invBySource = new Map<string, string>();
  for (const c of claimsFixture.items) for (const s of c.sourceIds) invBySource.set(s, c.investigationId);
  const chunks: Chunk[] = [
    ...sourcesFixture.items.map((s) => ({ id: s.id, sourceId: s.id, investigationId: invBySource.get(s.id) ?? null, text: s.excerpt })),
    ...claimsFixture.items.map((c) => ({ id: c.id, sourceId: c.sourceIds[0], investigationId: c.investigationId, text: c.text, derived: true })),
  ];
  return buildIndex(chunks);
}

type ClaimRow = { id: string; investigationId?: string; kind?: string; habitat?: string; text: string; sourceIds: string[] };

/**
 * Adds our own checked sentences (habitat takeaways, findings, summaries) to the searchable text, so a question
 * like "which experiments reached 30% oxygen" can be answered from the counted brief, not only from abstracts.
 */
export function withClaims(base: Bm25Index, claims: unknown): Bm25Index {
  const rows = (Array.isArray(claims) ? claims : ((claims as { items?: unknown[] })?.items ?? [])) as ClaimRow[];
  const extra: Chunk[] = rows
    .filter((c) => c?.text && c.sourceIds?.[0])
    .map((c) => ({ id: c.id, sourceId: c.sourceIds[0], investigationId: c.investigationId || null, text: c.text, habitat: c.habitat, derived: true }));
  return buildIndex([...base.chunks, ...extra]);
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// fresh: skip saved answers and the cache (used by scripts/rag/save_answers.mjs to record new answers).
const AskBody = z.object({ question: z.string(), habitat: HabitatId.optional(), fresh: z.boolean().optional() });
const VerifyBody = z.object({ text: z.string().max(2000), excerpt: z.string().max(4000), sourceText: z.string().max(200_000).optional() });

/** Licenses by source id from sources.json, so copyrighted sources are paraphrased only. */
export function licensesFrom(sources: unknown): Record<string, string> {
  const rows = (Array.isArray(sources) ? sources : ((sources as { items?: unknown[] })?.items ?? [])) as { id?: string; license?: string }[];
  return Object.fromEntries(rows.filter((r) => r?.id).map((r) => [r.id!, r.license ?? ""]));
}

/** Title, link and licence by source id, from sources.json and library.json (metadata only, no paper text). */
export function sourceInfoFrom(...lists: unknown[]): Record<string, SourceInfo> {
  const out: Record<string, SourceInfo> = {};
  for (const list of lists) {
    const rows = (Array.isArray(list) ? list : ((list as { items?: unknown[] })?.items ?? [])) as Partial<SourceInfo & { id: string }>[];
    for (const r of rows) if (r?.id && r.title) out[r.id] = { title: r.title, url: r.url ?? "", license: r.license ?? "" };
  }
  return out;
}

/** Saved demo answers by normalized question. Only well-formed live answers are used; anything else is ignored. */
export function savedFrom(raw: unknown): Record<string, AskResult> {
  const doc = raw as { made?: string; items?: { question?: unknown; result?: Partial<AskResult> }[] } | null;
  const out: Record<string, AskResult> = {};
  for (const it of doc?.items ?? []) {
    const r = it?.result;
    if (typeof it?.question !== "string" || typeof r?.answer !== "string" || !Array.isArray(r.claims) || !Array.isArray(r.investigationIds)) continue;
    out[normQuestion(it.question)] = { ...(r as AskResult), savedAt: doc?.made };
  }
  return out;
}

/** Private library chunks from KV, marked restricted. Anything unexpected = no private papers, never an error. */
export function restrictedChunks(raw: unknown): Chunk[] {
  const rows = ((raw as { chunks?: unknown[] })?.chunks ?? []) as Partial<Chunk>[];
  return rows
    .filter((c) => typeof c?.id === "string" && typeof c.sourceId === "string" && typeof c.text === "string")
    .map((c) => ({ id: c.id!, sourceId: c.sourceId!, investigationId: c.investigationId ?? null, text: c.text!, restricted: true }));
}

export function createApp(
  opts: {
    index?: Bm25Index;
    facts?: DataFact[];
    licenses?: Record<string, string>;
    sources?: Record<string, SourceInfo>;
    saved?: Record<string, AskResult>;
  } = {},
) {
  // ponytail: rate limit and cache are per-isolate memory only. Ceiling: each Worker isolate has its own
  // bucket, so abuse across isolates is not capped. Move to a Durable Object or KV if abused.
  const buckets = new Map<string, { tokens: number; at: number }>();
  const cache = new Map<string, unknown>();
  let loaded: Promise<Bm25Index> | undefined;
  let extrasLoaded: Promise<AskExtras> | undefined;

  /** Data facts (public/data/facts.json) and source licenses (sources.json); missing files mean none, never an error. */
  const getExtras = (env: Env, origin: string): Promise<AskExtras> => {
    if (opts.index) return Promise.resolve({ facts: opts.facts ?? [], licenses: opts.licenses ?? {}, sources: opts.sources ?? {}, saved: opts.saved ?? {} });
    extrasLoaded ??= (async () => {
      const get = async (path: string) => {
        try {
          const r = await env.ASSETS?.fetch(new URL(path, origin).toString());
          return r?.ok ? await r.json() : null;
        } catch {
          return null;
        }
      };
      const [facts, sources, library, saved] = await Promise.all([
        get("/data/facts.json"),
        get("/data/sources.json"),
        get("/data/library.json"),
        get("/data/saved-answers.json"),
      ]);
      return {
        saved: savedFrom(saved),
        facts: Array.isArray(facts) ? (facts as DataFact[]) : [],
        licenses: { ...licensesFrom(sources), ...licensesFrom(library) },
        sources: sourceInfoFrom(sources, library),
      };
    })();
    return extrasLoaded;
  };

  const getIndex = (env: Env, origin: string): Promise<Bm25Index> => {
    if (opts.index) return Promise.resolve(opts.index);
    loaded ??= (async () => {
      try {
        const r = await env.ASSETS?.fetch(new URL("/data/index.json", origin).toString());
        if (r?.ok) {
          const base = (await r.json()) as Bm25Index;
          const cr = await env.ASSETS?.fetch(new URL("/data/claims.json", origin).toString());
          let priv: Chunk[] = [];
          try {
            priv = restrictedChunks(await env.LIBRARY?.get("restricted-index", "json"));
          } catch {
            /* no private library: the public one still works */
          }
          return withClaims({ ...base, chunks: [...base.chunks, ...priv] }, cr?.ok ? await cr.json() : []);
        }
      } catch {
        /* fall through to fixtures */
      }
      return fixtureIndex();
    })();
    return loaded;
  };

  const take = (key: string) => {
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: BUCKET_CAPACITY, at: now };
    b.tokens = Math.min(BUCKET_CAPACITY, b.tokens + ((now - b.at) / 1000) * REFILL_PER_SEC);
    b.at = now;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    buckets.delete(key); // re-insert so Map order is least-recently-used first
    buckets.set(key, b);
    if (buckets.size > BUCKETS_MAX) buckets.delete(buckets.keys().next().value!);
    return ok;
  };
  const limited = (route: string, c: Context) => !take(`${route}|${clientKey(c.req.header("cf-connecting-ip"))}`);
  const tooBig = (maxSize: number) =>
    bodyLimit({ maxSize, onError: (c) => c.json({ error: "too_large", message: "Request body is too large." }, 413) });

  const app = new Hono<{ Bindings: Env }>();
  app.onError((_e, c) => c.json({ error: "server_error", message: "Something went wrong." }, 500));
  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/ask", tooBig(4 * 1024), async (c) => {
    if (limited("ask", c)) return c.json({ error: "rate_limited", message: "Too many questions. Try again in a few seconds." }, 429);
    const body = AskBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "bad_request", message: "Send { question: string, habitat?: HabitatId }." }, 400);
    const question = body.data.question.trim();
    if (!question) return c.json({ error: "bad_request", message: "Question is empty." }, 400);
    if (question.length > MAX_QUESTION) return c.json({ error: "too_long", message: `Question must be ${MAX_QUESTION} characters or fewer.` }, 400);

    const key = await sha256(`${question.toLowerCase().replace(/\s+/g, " ")}|${body.data.habitat ?? ""}`);
    const fresh = body.data.fresh === true;
    if (!fresh && cache.has(key)) return c.json(cache.get(key));
    const origin = new URL(c.req.url).origin;
    const [index, extras] = await Promise.all([getIndex(c.env ?? {}, origin), getExtras(c.env ?? {}, origin)]);
    const { degraded, ...result } = await ask(index, question, body.data.habitat, c.env ?? {}, extras, fresh);
    if (!degraded) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, result);
    }
    return c.json(result);
  });

  app.post("/verify", tooBig(1024 * 1024), async (c) => {
    if (limited("verify", c)) return c.json({ error: "rate_limited", message: "Too many checks. Try again in a few seconds." }, 429);
    const body = VerifyBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "bad_request", message: "Send { text, excerpt, sourceText? }." }, 400);
    const { usage: _usage, ...out } = await verify(body.data, { TYPESAFE_API_KEY: c.env?.TYPESAFE_API_KEY });
    return c.json(out);
  });

  app.post("/rank", (c) => c.json({ error: "not_implemented", message: "Rankings are precomputed in public/data/rank.json." }, 501));
  return app;
}


