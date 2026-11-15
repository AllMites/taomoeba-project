import { z } from "zod";
import { Claim } from "../contracts/index.ts";

export const MAX_QUESTION = 300;
export const MAX_ANSWER = 1200;
export const MAX_HISTORY = 4;
/** The server takes at most this many experiment ids as the scope of one question (server/app.ts). */
export const MAX_ABOUT = 5;
/** The server refuses a body over 8 KB (server/app.ts). Kept a little under, for the habitat and the JSON around it. */
export const MAX_BODY_BYTES = 8 * 1024 - 256;

/** One earlier turn as the server wants it. */
export type HistoryTurn = { question: string; answer: string };

/** What the server really did for one answer (server/ask.ts AskSteps). Zeros read as "nothing counted". */
const StepsShape = z.object({
  searched: z.number().catch(0),
  matched: z.number().catch(0),
  facts: z.number().catch(0),
  reranked: z.number().catch(0),
  kept: z.number().catch(0),
  dropped: z.number().catch(0),
  checked: z.number().catch(0),
});
export type AskSteps = z.infer<typeof StepsShape>;
export const NO_STEPS: AskSteps = { searched: 0, matched: 0, facts: 0, reranked: 0, kept: 0, dropped: 0, checked: 0 };

/** A finding computed by code from the team's data (server/facts.ts), shown before any paper. */
const DataFact = z.object({ id: z.string(), statement: z.string(), dataset: z.string(), caveat: z.string().default(""), source: z.string() });
export type DataFact = z.infer<typeof DataFact>;
const Relation = z.enum(["explains", "supports", "contradicts", "related"]);
export type Relation = z.infer<typeof Relation>;

const AskResult = z.object({
  answer: z.string(),
  claims: z.array(Claim),
  investigationIds: z.array(z.string()),
  mode: z.enum(["live", "extractive", "mock", "saved"]),
  steps: StepsShape.catch(NO_STEPS).default(NO_STEPS),
  /** The model that wrote the answer; null when none did. */
  model: z.string().nullable().catch(null).default(null),
  /** True when the live writer failed and the server quoted the records instead. */
  degraded: z.boolean().optional().catch(undefined),
  savedAt: z.string().optional().catch(undefined),
  /** SI's direct answer, written from the kept sentences only. */
  summary: z.string().optional().catch(undefined),
  // Optional, so older servers still parse; a bad relation label is dropped rather than failing the answer.
  facts: z.array(DataFact).optional().catch(undefined),
  relations: z.record(z.string(), Relation.catch("related")).optional().catch(undefined),
  // Title, link and licence of cited sources (some papers have no public file the page could look them up in).
  sources: z
    .record(z.string(), z.object({ title: z.string(), url: z.string().catch(""), license: z.string().catch("") }))
    .optional()
    .catch(undefined),
});
export type AskResult = z.infer<typeof AskResult>;

export type AskOutcome =
  | { kind: "answer"; result: AskResult }
  | { kind: "nocover"; result: AskResult }
  | { kind: "error"; reason: "rate" | "toolong" | "offline" | "unavailable" | "failed"; message: string };

const err = (reason: Extract<AskOutcome, { kind: "error" }>["reason"], message: string): AskOutcome => ({ kind: "error", reason, message });

/** What the server says when the records hold nothing on the question (server/ask.ts NO_COVER). */
export const isNoCover = (answer: string) => answer.startsWith("The PSI records I have do not cover");

/** What the server says when the data has a finding but no paper explains it (server/ask.ts DATA_ONLY). */
export const isDataOnly = (answer: string) => answer.startsWith("No paper in the library explains");

/** How a paper relates to the data finding, in plain words. */
export const RELATION_LABEL: Record<Relation, string> = {
  explains: "Explains the finding",
  supports: "Agrees with the finding",
  contradicts: "Disagrees with the finding",
  related: "Related background",
};

/** What kind of source an id points to: a PSI record, a NASA report, or the team's own analysis. */
export const sourceKind = (id: string) =>
  id.startsWith("psi:") ? "PSI record" : id.startsWith("ntrs:") ? "NASA report" : id.startsWith("team:") ? "Team analysis" : "Source";

/** Papers NASA marks "short quotes only": the page shows a short quote and says so. */
export const isShortQuotesOnly = (license: string | undefined) => !!license && !/^(CC0|Public domain)/i.test(license);

/** What kind of data a computed finding comes from. */
export const factKind = (f: { dataset: string; source: string }) =>
  /dashboard/i.test(f.dataset) ? "Team dashboard" : f.source.startsWith("team:") ? "Team analysis" : f.source.startsWith("psi:") ? "PSI data" : "Data";

/** Honest label for how the answer was made. */
export const MODE_LABEL: Record<AskResult["mode"], string> = {
  extractive: "Quoted from the records (no SI summary)",
  mock: "Sample answer, the live service is off",
  live: "SI answer, built only from the quoted sources",
  saved: "Saved SI answer, made earlier with the same checks",
};

/** "Saved SI answer from 14 Nov 2026, …" when the date is known. */
export const modeLabel = (r: { mode: AskResult["mode"]; savedAt?: string }) => {
  if (r.mode !== "saved" || !r.savedAt) return MODE_LABEL[r.mode];
  const d = new Date(`${r.savedAt}T12:00:00Z`);
  const day = Number.isNaN(d.getTime()) ? r.savedAt : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `Saved SI answer from ${day}, made with the same checks`;
};

/** The answer as plain reading text: source ids in [brackets] move to the source cards, the "quoting" lead-in is dropped. */
export const readable = (answer: string) =>
  answer
    .replace(/^I am quoting the PSI records directly:\s*/, "")
    .replace(/\s*\[[^\]\s]+\]/g, "")
    .trim();

export async function askRecords(
  question: string,
  habitat: string,
  fetchImpl: typeof fetch = (u, i) => fetch(u, i),
  signal?: AbortSignal,
  history: HistoryTurn[] = [],
  about: string[] = [],
): Promise<AskOutcome> {
  // Characters are not bytes: four long turns in a script like Japanese can pass 8 KB. Drop the oldest turns
  // until the body fits, rather than send one the server refuses on every retry.
  let earlier = history.slice(-MAX_HISTORY);
  const scope = about.slice(-MAX_ABOUT);
  const bodyOf = () => JSON.stringify({ question, habitat, ...(earlier.length ? { history: earlier } : {}), ...(scope.length ? { about: scope } : {}) });
  while (earlier.length && new TextEncoder().encode(bodyOf()).length > MAX_BODY_BYTES) earlier = earlier.slice(1);
  let res: Response;
  try {
    res = await fetchImpl("/ask", { method: "POST", headers: { "content-type": "application/json" }, body: bodyOf(), signal });
  } catch {
    return err("offline", "Could not reach the question service. Check your connection and try again.");
  }
  // Before the body: a rate limit from Cloudflare itself can come back as an HTML page.
  if (res.status === 429) return err("rate", "Too many questions at once. Wait a few seconds and try again.");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // Plain `npm run dev` has no /ask: Vite answers with index.html (or a 404 page), which is not JSON.
    return err("unavailable", "The question service is not running here.");
  }
  if (res.status === 400) {
    const code = (body as { error?: string } | null)?.error;
    if (code === "too_long") return err("toolong", `That question is too long. Keep it under ${MAX_QUESTION} characters.`);
    return err("failed", "That question could not be read. Try rewording it.");
  }
  if (!res.ok) return err("failed", "The question service had a problem. Try again in a moment.");
  const parsed = AskResult.safeParse(body);
  if (!parsed.success) return err("unavailable", "The question service is not running here.");
  return { kind: isNoCover(parsed.data.answer) ? "nocover" : "answer", result: parsed.data };
}

/**
 * Ask for the habitat picked now. If the pick changes while the reply is on its way, that reply is
 * for the old habitat, so ask again (at most 3 times) rather than show it under the new one.
 */
export async function askForHabitat(
  question: string,
  habitatNow: () => string,
  fetchImpl?: typeof fetch,
  signal?: AbortSignal,
  history: HistoryTurn[] = [],
  about: string[] = [],
): Promise<AskOutcome> {
  let out: AskOutcome;
  for (let tries = 0; ; tries++) {
    const asked = habitatNow();
    out = await askRecords(question, asked, fetchImpl, signal, history, about);
    if (signal?.aborted || habitatNow() === asked || tries >= 2) return out;
  }
}
