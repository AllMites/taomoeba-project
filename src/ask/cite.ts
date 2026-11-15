import { isNoCover, modeLabel, readable, type AskResult } from "./respond.ts";

/**
 * Plain text a researcher can paste into notes: the question, the data facts, the answer and a numbered source list
 * (title and link only; quoted excerpts stay on the page because some reports allow short quotes only).
 */
export function citationText(question: string, r: AskResult, titleOf: (id: string) => string, when = new Date()): string {
  const day = when.toISOString().slice(0, 10);
  const lines = [`Question: ${question}`, `Answer from Firebreak "Ask the records" (${modeLabel(r)}), ${day}:`];
  for (const f of r.facts ?? []) lines.push(`- Data (${f.dataset}): ${f.statement}${f.caveat ? ` Caveat: ${f.caveat}` : ""}`);
  if (r.summary) lines.push(r.summary);
  const text = readable(r.answer).trim();
  if (text && !isNoCover(r.answer)) lines.push(text);
  const ids: string[] = [];
  for (const c of r.claims) {
    const id = c.sourceIds[0];
    if (id && !ids.includes(id)) ids.push(id);
  }
  for (const f of r.facts ?? []) if (f.source && !ids.includes(f.source)) ids.push(f.source);
  if (ids.length) {
    lines.push("Sources:");
    ids.forEach((id, i) => {
      const s = r.sources?.[id];
      lines.push(`${i + 1}. ${s?.title ?? titleOf(id)}${s?.url ? `. ${s.url}` : ""} [${id}]`);
    });
  }
  return lines.join("\n");
}

/** Every source and experiment an answer used, as research-graph ids (a PSI record "psi:PSI-69" is the experiment "PSI-69"). */
export function answerSourceIds(result: Pick<AskResult, "claims" | "investigationIds" | "facts">): string[] {
  const ids = [
    ...result.claims.flatMap((c) => c.sourceIds),
    ...result.investigationIds,
    ...(result.facts ?? []).map((f) => f.source),
  ].map((id) => id.replace(/^psi:/, ""));
  return [...new Set(ids.filter(Boolean))];
}
