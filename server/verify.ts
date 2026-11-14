// Core of POST /verify, exported as a plain function so scripts can reuse it.
export type VerifyInput = { text: string; excerpt: string; sourceText?: string };
export type Verdict = "supports" | "contradicts" | "unrelated";
export type VerifyResult = {
  verbatim: boolean;
  verdict?: Verdict;
  confidence?: number;
  flagged: boolean;
  usage?: { input_tokens: number; output_tokens: number };
};
export type VerifyEnv = { TYPESAFE_API_KEY?: string; fetchImpl?: typeof fetch };

export const FLAG_BELOW = 0.8;
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_MODEL = "jev-latest";

/** Lenient: NFKC folds ligatures (fi, fl), drops soft hyphens and hyphenated line breaks, collapses whitespace. */
export function norm(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/­/g, "")
    .replace(/-\s*\n\s*/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const WORD = /[\p{L}\p{N}]/u;

/** Normalized excerpt occurs in the normalized source on word boundaries (no match starting or ending mid-word). */
export function containsVerbatim(source: string, excerpt: string): boolean {
  const s = norm(source);
  const e = norm(excerpt);
  if (!e) return false;
  for (let i = s.indexOf(e); i !== -1; i = s.indexOf(e, i + 1)) {
    const before = s[i - 1] ?? " ";
    const after = s[i + e.length] ?? " ";
    if (!(WORD.test(before) && WORD.test(e[0])) && !(WORD.test(after) && WORD.test(e[e.length - 1]))) return true;
  }
  return false;
}

export async function judge(
  text: string,
  excerpt: string,
  env: VerifyEnv,
): Promise<{ verdict: Verdict; confidence: number; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await (env.fetchImpl ?? fetch)(TYPESAFE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      model: TYPESAFE_MODEL,
      state: { claim: text, section: excerpt },
      questions: {
        relation: {
          type: "choice",
          instructions: "How does the section relate to the claim?",
          criteria: {
            supports: "The section states the claim or directly implies that it is true",
            contradicts: "The section states the opposite of the claim or implies it is false",
            says_nothing: "The section does not address what the claim asserts, either way",
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`typesafe_${res.status}`);
  const j = (await res.json()) as {
    answers: { relation: { choice: string; confidence: number } };
    usage: { input_tokens: number; output_tokens: number };
  };
  const a = j.answers.relation;
  return {
    verdict: a.choice === "says_nothing" ? "unrelated" : (a.choice as Verdict),
    confidence: a.confidence,
    usage: j.usage,
  };
}

export async function verify(input: VerifyInput, env: VerifyEnv = {}): Promise<VerifyResult> {
  // Without sourceText there is nothing to match the excerpt against: report not-verbatim, but do not flag on that alone.
  const verbatim = input.sourceText !== undefined && containsVerbatim(input.sourceText, input.excerpt);
  const missingSource = input.sourceText === undefined;
  if (!env.TYPESAFE_API_KEY) return { verbatim, flagged: true }; // unchecked = flagged
  try {
    const j = await judge(input.text, input.excerpt, env);
    return {
      verbatim,
      verdict: j.verdict,
      confidence: j.confidence,
      usage: j.usage,
      flagged: (!verbatim && !missingSource) || j.verdict !== "supports" || j.confidence < FLAG_BELOW,
    };
  } catch {
    return { verbatim, flagged: true };
  }
}
