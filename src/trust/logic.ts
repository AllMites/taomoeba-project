import { z } from "zod";

// Scores of the Ask box on the team's labelled questions, written by scripts/rag/eval_ask.mjs --publish.
export const AskEval = z.object({
  date: z.string(),
  questions: z.number(),
  papers: z.object({ n: z.number(), cites_a_labelled_paper: z.number(), first_claim_cites_a_labelled_paper: z.number(), wrongly_refused: z.number() }),
  offtopic: z.object({ n: z.number(), refused: z.number() }),
  data: z.object({ n: z.number(), right_fact: z.number() }),
  model: z.object({ n: z.number(), model_fact: z.number() }),
  modes: z.record(z.string(), z.number()),
  claims: z.object({ total: z.number(), not_double_checked: z.number() }),
  latency_ms: z.object({ median: z.number(), p90: z.number() }),
  // added 14 Nov: tuning vs held-out split, and a separate reviewer's verdict (scripts/rag/judge_answers.mjs)
  papers_by_group: z.object({ tuning: z.object({ n: z.number(), hit: z.number() }), held_out: z.object({ n: z.number(), hit: z.number() }) }).optional(),
  judged: z.object({ n: z.number(), yes: z.number(), partly: z.number(), no: z.number(), model: z.string() }).optional(),
});
export type AskEval = z.infer<typeof AskEval>;

export const parseEval = (raw: unknown): AskEval | null => {
  const r = AskEval.safeParse(raw);
  return r.success ? r.data : null;
};

export const share = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : "–");

/** Score lines for the Ask box, in plain words, every number from the file. */
export function evalLines(e: AskEval): { big: string; text: string }[] {
  const live = e.modes.live ?? 0;
  const out = [
    {
      big: share(e.papers.cites_a_labelled_paper, e.papers.n),
      text: `of ${e.papers.n} research questions got an answer citing a paper the team had marked as the right one before testing (a lower bound: other papers can also be right).`,
    },
    ...(e.papers_by_group
      ? [
          {
            big: share(e.papers_by_group.held_out.hit, e.papers_by_group.held_out.n),
            text: `on the ${e.papers_by_group.held_out.n} of those questions that were never used to tune the search (held out).`,
          },
        ]
      : []),
    ...(e.judged
      ? [
          {
            big: share(e.judged.yes, e.judged.n),
            text: `of ${e.judged.n} research answers directly answer the question, as judged by a separate, larger AI reviewer (${e.judged.partly} more answer it in part).`,
          },
        ]
      : []),
    { big: share(e.offtopic.refused, e.offtopic.n), text: `of ${e.offtopic.n} off-topic questions (Mars travel, lunar crops…) were refused instead of answered.` },
    { big: share(e.data.right_fact, e.data.n), text: `of ${e.data.n} questions about the team's data brought up the right computed fact.` },
  ];
  if (e.model.n > 0) out.push({ big: share(e.model.model_fact, e.model.n), text: `of ${e.model.n} questions about the team's models brought up a model fact.` });
  if (e.claims.total > 0)
    out.push({
      big: share(e.claims.total - e.claims.not_double_checked, e.claims.total),
      text: `of ${e.claims.total} quoted claims passed the second check; the rest are shown marked "not double-checked".`,
    });
  out.push({ big: share(live, e.questions), text: `of answers were written live; the rest fell back to quoting the records.` });
  return out;
}

/** What each kind of number on the page is. Order: most to least grounded. */
export const KINDS = [
  { name: "Data", text: "Computed in code from NASA PSI tables. SI never writes these numbers." },
  { name: "Model prediction", text: "From team models trained on FLEX runs and tested on whole test days they never saw." },
  { name: "SI answer", text: "Written by SI only from quoted sentences; each claim is checked against its quote." },
  { name: "Theory estimate", text: "Textbook physics (droplet theory, buoyancy scaling). Not data; used as a cross-check." },
  { name: "Illustration", text: "Drawn to explain, not measured: flame shapes, colours, habitat views." },
] as const;
