import { useDataset } from "../data/useDataset.ts";

export default function Analyst() {
  const inv = useDataset("investigations");
  const first = inv.status === "ready" ? inv.data[0] : undefined;
  return (
    <section aria-labelledby="analyst-h">
      <h2 id="analyst-h">Analyst</h2>
      <p>{first ? `${first.title}: ${first.objectives}` : "Loading investigation data."}</p>
    </section>
  );
}
