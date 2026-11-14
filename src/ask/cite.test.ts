import { describe, expect, it } from "vitest";
import { citationText } from "./cite.ts";
import { NO_STEPS, type AskResult } from "./respond.ts";

const r = {
  steps: NO_STEPS,
  model: null,
  answer: "Helium raised the burning rate [1].",
  mode: "live",
  claims: [
    { id: "c1", text: "Helium raised the burning rate.", excerpt: "In helium the burning rate rose.", sourceIds: ["ntrs:1"], investigationId: "PSI-69" },
    { id: "c2", text: "Another.", excerpt: "x", sourceIds: ["ntrs:1"], investigationId: "PSI-69" },
  ],
  investigationIds: ["PSI-69"],
  facts: [{ id: "f", statement: "Helium runs: 20.", dataset: "FLEX runs", caveat: "", source: "psi:PSI-69" }],
  sources: { "ntrs:1": { title: "FLEX report", url: "https://ntrs.nasa.gov/1", license: "Public domain" } },
} as unknown as AskResult;

describe("copy answer with sources", () => {
  it("has the question, the data fact, the answer and each source once, numbered, with its link", () => {
    const t = citationText("Does helium matter?", r, (id) => (id === "psi:PSI-69" ? "FLEX (PSI-69)" : id), new Date("2026-11-14T12:00:00Z"));
    expect(t).toContain("Question: Does helium matter?");
    expect(t).toContain("2026-11-14");
    expect(t).toContain("Data (FLEX runs): Helium runs: 20.");
    expect(t).toContain("Helium raised the burning rate");
    expect(t).toContain("1. FLEX report. https://ntrs.nasa.gov/1 [ntrs:1]");
    expect(t).toContain("2. FLEX (PSI-69) [psi:PSI-69]");
    expect(t.match(/ntrs:1\]/g)).toHaveLength(1);
    expect(t).not.toContain("In helium the burning rate rose."); // excerpts stay on the page
  });
});
