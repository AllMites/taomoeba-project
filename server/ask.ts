import type { Claim } from "../src/contracts/claim.ts";
import type { HabitatId } from "../src/contracts/habitat.ts";
import { score, type Bm25Index } from "./bm25.ts";

export type AskMode = "live" | "extractive" | "mock";
export type AskResult = { answer: string; claims: Claim[]; investigationIds: string[]; mode: AskMode };
export type AskEnv = { ANTHROPIC_API_KEY?: string; TYPESAFE_API_KEY?: string; SPEND_MODE?: string; fetchImpl?: typeof fetch };

export const NO_COVER = "The PSI records I have do not cover that.";
const MODEL = "claude-haiku-5-5";

const ID_RE = /\[([^\]\s]+)\]/g;

export function pickMode(env: AskEnv): AskMode {
  if (env.SPEND_MODE === "mock") return "mock";
  if (env.SPEND_MODE === "extractive") return "extractive";
  if (env.ANTHROPIC_API_KEY) return "live";
  // Any other key present (TypeSafe) = honest quoting mode; no keys at all = canned.
  return env.TYPESAFE_API_KEY ? "extractive" : "mock";
}

function claimFrom(i: number, chunkText: string, sourceId: string, investigationId: string | null, text = chunkText): Claim {
  return { id: `ask-${i + 1}`, investigationId: investigationId ?? "", kind: "finding", text, sourceIds: [sourceId], excerpt: chunkText };
}

function finish(answer: string, claims: Claim[], mode: AskMode): AskResult {
  const investigationIds = [...new Set(claims.map((c) => c.investigationId).filter(Boolean))];
  return { answer, claims, investigationIds, mode };
}

export function mockAnswer(index: Bm25Index): AskResult {
  const c = index.chunks[0];
  if (!c) return finish(NO_COVER, [], "mock");
  return finish(`Mock answer (no live SI call was made): ${c.text} [${c.sourceId}]`, [claimFrom(0, c.text, c.sourceId, c.investigationId)], "mock");
}

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

export function extractive(index: Bm25Index, question: string): AskResult {
  const hits = score(index, question, 3);
  if (!hits.length) return finish(NO_COVER, [], "extractive");
  // Best sentence per chunk, then top 2 across chunks.
  const picks = hits
    .map((h) => {
      const best = sentences(h.chunk.text)
        .map((s) => ({ s, sc: score({ ...index, chunks: [{ ...h.chunk, text: s }] }, question, 1)[0]?.score ?? 0 }))
        .sort((a, b) => b.sc - a.sc)[0];
      return { chunk: h.chunk, s: best?.s ?? h.chunk.text, sc: h.score };
    })
    .slice(0, 2);
  const claims = picks.map((p, i) => claimFrom(i, p.chunk.text, p.chunk.sourceId, p.chunk.investigationId, p.s));
  const quoted = picks.map((p) => `"${p.s}" [${p.chunk.sourceId}]`).join(" ");
  return finish(`I am quoting the PSI records directly: ${quoted}`, claims, "extractive");
}

export function buildPrompt(question: string, habitat: HabitatId | undefined, ctx: Bm25Index["chunks"]) {
  const system = [
    "You answer questions about NASA microgravity combustion experiments for students and engineers.",
    "Use ONLY the excerpts provided. Never use outside knowledge.",
    "Write at most 3 short, plain sentences. Explain any jargon in a few words. Give numbers with units.",
    'Call it "SI", never "AI". Never write "according to NASA".',
    "Each sentence must end with the id of the one excerpt it rests on, in square brackets, like [SRC-01].",
    `If the excerpts do not answer the question, reply with exactly: ${NO_COVER}`,
  ].join("\n");
  const user = `${habitat ? `Habitat: ${habitat}\n` : ""}Excerpts:\n${ctx.map((c) => `[${c.sourceId}] ${c.text}`).join("\n")}\n\nQuestion: ${question}`;
  return { system, user };
}

/** Parse "... [SRC-01]" endings back into claims; ids outside the retrieved set are dropped. */
export function parseLive(text: string, ctx: Bm25Index["chunks"]): AskResult | null {
  const bySource = new Map(ctx.map((c) => [c.sourceId, c]));
  const t = text.trim();
  if (t.startsWith(NO_COVER)) return finish(NO_COVER, [], "live");
  const claims: Claim[] = [];
  for (const s of sentences(t)) {
    const ids = [...s.matchAll(ID_RE)].map((m) => m[1]).filter((id) => bySource.has(id));
    if (!ids.length) continue;
    const src = bySource.get(ids[0])!;
    claims.push({ ...claimFrom(claims.length, src.text, src.sourceId, src.investigationId, s.replace(ID_RE, "").trim()), sourceIds: [...new Set(ids)] });
  }
  return claims.length ? finish(t, claims, "live") : null; // no cited sentence = unusable, caller falls back
}

export async function live(index: Bm25Index, question: string, habitat: HabitatId | undefined, env: AskEnv): Promise<AskResult> {
  const ctx = score(index, question, 4).map((h) => h.chunk);
  if (!ctx.length) return finish(NO_COVER, [], "live");
  const { system, user } = buildPrompt(question, habitat, ctx);
  const res = await (env.fetchImpl ?? fetch)("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    // Thinking is always on for Haiku 5.5; low effort keeps spend and latency small. No temperature (400 on this model).
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, output_config: { effort: "low" }, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`anthropic_${res.status}`);
  const j = (await res.json()) as { content: { type: string; text?: string }[]; stop_reason?: string };
  if (j.stop_reason === "refusal") throw new Error("refusal");
  const text = j.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = parseLive(text, ctx);
  if (!parsed) throw new Error("unparseable");
  return parsed;
}

export async function ask(index: Bm25Index, question: string, habitat: HabitatId | undefined, env: AskEnv): Promise<AskResult & { degraded?: boolean }> {
  const mode = pickMode(env);
  if (mode === "mock") return mockAnswer(index);
  if (mode === "extractive") return extractive(index, question);
  try {
    return await live(index, question, habitat, env);
  } catch {
    return { ...extractive(index, question), degraded: true }; // live failed: stay honest, quote the records
  }
}
