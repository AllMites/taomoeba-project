import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TurnView } from "./chat.tsx";
import { NO_STEPS, type AskResult } from "./respond.ts";

it("an about answer shows its paragraphs under the team label, with no steps, sources count or copy button", () => {
  const result: AskResult = { answer: "First paragraph.\n\nSecond paragraph.", claims: [], investigationIds: [], mode: "about", steps: NO_STEPS, model: null };
  const html = renderToStaticMarkup(
    <TurnView turn={{ id: 1, question: "What is this site?", outcome: { kind: "answer", result } }} titleOf={(s) => s} onOpen={() => {}} onShow={() => {}} />,
  );
  expect(html).toContain("About this site · written by the team, not from the records");
  expect(html).toContain("First paragraph.");
  expect(html).toContain("Second paragraph.");
  for (const no of ["SI wrote this answer from the checked sentences", "Steps for this answer", "Searched", "Copy answer with sources"]) expect(html).not.toContain(no);
});
