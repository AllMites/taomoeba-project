import { useStore } from "../app/store.ts";
import { useDataset } from "../data/useDataset.ts";

export default function Ranking() {
  const habitat = useStore((s) => s.habitat);
  const rank = useDataset("rank");
  const inv = useDataset("investigations");
  const top =
    rank.status === "ready" ? rank.data.filter((r) => r.habitat === habitat).sort((a, b) => b.score - a.score)[0] : undefined;
  const title = top && inv.status === "ready" ? inv.data.find((i) => i.id === top.investigationId)?.title : undefined;
  return (
    <section aria-labelledby="ranking-h">
      <h2 id="ranking-h">Ranking</h2>
      <p>
        {top
          ? `Top match for ${habitat}: ${title ?? top.investigationId} (score ${top.score.toFixed(2)}). ${top.rationale}`
          : "Loading ranking data."}
      </p>
    </section>
  );
}
