// A fixed "about this site" answer, written by the team. Returned with no search and no model call.
// Questions about the site itself can never be answered from the papers, so Ask SI says so plainly here.
import { inScope } from "./checks.ts";

const ABOUT: RegExp[] = [
  /\b(?:this|the|your|entire|whole)\s+(?:(?:entire|whole)\s+)?(?:project|site|website|app|tool|dashboard|console)\b/i,
  /\bfirebreak\b/i,
  /\bask si\b/i,
  /\bwhat (?:is|does) si\b/i,
  /\bwho (?:made|built|created) (?:this|it|you)\b/i,
  /\bwhat can (?:you|this|i) do\b/i,
  /\bhow do i use (?:this|it)\b/i,
  /^\s*what is this\s*[?!.]*\s*$/i,
];

// "Which experiment ranks highest for ISS on the dashboard?" names the dashboard but asks for the ranking: not an about question.
const DATA_QUESTION = /\b(?:which|rank\w*|highest|lowest|top)\b/i;

/**
 * True when the question is about the site, not the science: it matches an about pattern and has no fire-science
 * word. "Firebreak" starts with "fire", so the site's own name is taken out before the science check.
 */
export function isAboutQuestion(q: string): boolean {
  return ABOUT.some((re) => re.test(q)) && !DATA_QUESTION.test(q) && !inScope(q.replace(/firebreak/gi, " "));
}

/** Numbers the caller reads from data the server already loaded. */
export type AboutCounts = { experiments: number; sources: number };

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The answer as short paragraphs. */
export function aboutAnswer(c: AboutCounts): string[] {
  return [
    "Firebreak gathers NASA's open fire experiments in space. For the air of one habitat, it shows which experiments matter, what they mean and what is not known.",
    `It is built from ${n(c.experiments, "NASA experiment record")} and the ${n(c.sources, "source")} Ask SI searches. The models are CatBoost, TypeSafe and Claude. Numbers come from the tables, not from the model.`,
    "Ask SI searches the sources, picks passages, writes an answer, then checks each sentence against its source. It refuses what the records do not cover.",
    "To start, pick a base, then follow the guide: rank, what it means, the fire scenario, ask.",
  ];
}
