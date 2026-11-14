// One Haiku call, shared by the answer, the re-ranker and the support check.
// Thinking is on by default for Haiku 5.5 and counts toward max_tokens; in measured live runs it used the whole budget
// on 4 of 10 questions, so it is turned off here (these tasks restate quoted text and need no reasoning).
export const MODEL = "claude-haiku-5-5";

export type LlmEnv = { ANTHROPIC_API_KEY?: string; fetchImpl?: typeof fetch };

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** `earlier` are already-cleaned turns of the chat, sent as alternating messages before the final user turn. */
export async function callHaiku(env: LlmEnv, system: string, user: string, maxTokens = 2000, timeoutMs = 12_000, earlier: ChatMessage[] = []): Promise<string> {
  const res = await (env.fetchImpl ?? fetch)("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, thinking: { type: "disabled" }, system, messages: [...earlier, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`anthropic_${res.status}`);
  const j = (await res.json()) as { content: { type: string; text?: string }[]; stop_reason?: string };
  // Only a finished turn is usable: max_tokens (cut off), refusal, pause_turn etc. are errors for the caller to handle.
  if (j.stop_reason !== "end_turn") throw new Error(`stop_${j.stop_reason}`);
  return j.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

/** First {...} block of a reply as JSON, or null. */
export function jsonBlock(reply: string): Record<string, unknown> | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
