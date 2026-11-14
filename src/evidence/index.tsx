import { useStore } from "../app/store.ts";

export default function Evidence() {
  const id = useStore((s) => s.selectedInvestigationId);
  return id ? <aside aria-label="Experiment detail">{id}</aside> : null;
}
