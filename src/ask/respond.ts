import { z } from "zod";
import { Claim } from "../contracts/index.ts";

export const MAX_QUESTION = 300;

/** A finding computed by code from the team's data (server/facts.ts), shown before any paper. */
const DataFact = z.object({ id: z.string(), statement: z.string(), dataset: z.string(), caveat: z.string().default(""), source: z.string() });
export type DataFact = z.infer<typeof DataFact>;
const Relation = z.enum(["explains", "supports", "contradicts", "related"]);
export type Relation = z.infer<typeof Relation>;

const AskResult = z.object({
  answer: z.string(),
  claims: z.array(Claim),
  investigationIds: z.array(z.string()),
  mode: z.enum(["live", "extractive", "mock"]),
  // Optional, so older servers still parse; a bad relation label is dropped rather than failing the answer.
  facts: z.array(DataFact).optional().catch(undefined),
  relations: z.record(z.string(), Relation.catch("related")).optional().catch(undefined),
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

/** What kind of data a computed finding comes from. */
export const factKind = (f: { dataset: string; source: string }) =>
  /dashboard/i.test(f.dataset) ? "Team dashboard" : f.source.startsWith("team:") ? "Team analysis" : f.source.startsWith("psi:") ? "PSI data" : "Data";

/** Honest label for how the answer was made. */
export const MODE_LABEL: Record<AskResult["mode"], string> = {
  extractive: "Quoted from the records (no SI summary)",
  mock: "Sample answer, the live service is off",
  live: "SI answer, built only from the quoted sources",
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
): Promise<AskOutcome> {
  let res: Response;
  try {
    res = await fetchImpl("/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, habitat }), signal });
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
): Promise<AskOutcome> {
  let out: AskOutcome;
  for (let tries = 0; ; tries++) {
    const asked = habitatNow();
    out = await askRecords(question, asked, fetchImpl, signal);
    if (signal?.aborted || habitatNow() === asked || tries >= 2) return out;
  }
}
