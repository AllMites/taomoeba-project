import { useDataset } from "../data/useDataset.ts";

export default function Evidence({ mode }: { mode: "page" | "drawer" }) {
  const claims = useDataset("claims");
  const first = claims.status === "ready" ? claims.data[0] : undefined;
  return (
    <aside
      className={`evidence evidence--${mode}`}
      aria-labelledby="evidence-h"
      style={mode === "drawer" ? { width: 420, maxWidth: "100%" } : undefined}
    >
      <h2 id="evidence-h">Evidence</h2>
      <p>{first ? `${first.investigationId}: ${first.text}` : "Loading evidence data."}</p>
    </aside>
  );
}
