import { gasOf, isMoonLike, predict, type Sel, type WhatIfDoc } from "./logic.ts";

// Questions the Ask box can take further for the current setting. The set is small and fixed so every one can be
// saved ahead of the demo (scripts/rag/save_answers.mjs lists them all as ASK_ABOUT_QUESTIONS).
export const ASK_ABOUT_QUESTIONS = [
  "What did FLEX find about methanol droplet flames?",
  "What did FLEX find about heptane droplet flames?",
  "Does helium change droplet extinction?",
  "How does carbon dioxide affect droplet flames?",
  "Why did so many high-oxygen FLEX runs end in disruption?",
  "Can we trust the model predictions for a Moon base?",
  "Would a droplet burn faster on the Moon than on the ISS?",
  "How do measured burning rates compare with droplet combustion theory?",
] as const;

const Q = ASK_ABOUT_QUESTIONS;

/** Up to three questions: the gas or fuel, then the condition that stands out, then the physics cross-check. */
export function askAbout(doc: WhatIfDoc, s: Sel): string[] {
  const gas = gasOf(doc, s.mix);
  const out: string[] = [gas === "he" ? Q[2] : gas === "co2" ? Q[3] : doc.axes.fuel[s.fuel] === "heptane" ? Q[1] : Q[0]];
  const p = predict(doc, s);
  if (isMoonLike(doc, s)) out.push(Q[5]);
  else if (p.possible && p.pDisruption >= 0.3) out.push(Q[4]);
  out.push(gas === "n2" && !isMoonLike(doc, s) ? Q[7] : Q[6]);
  return out;
}
