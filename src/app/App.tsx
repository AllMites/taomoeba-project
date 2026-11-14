import { useEffect, useState } from "react";
import Analyst from "../analyst/index.tsx";
import type { HabitatId } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import Evidence from "../evidence/index.tsx";
import Ranking from "../ranking/index.tsx";
import { useStore, type PdsFilter } from "./store.ts";

const ROUTES = [
  { path: "/", label: "Catalog" },
  { path: "/rank", label: "Rank" },
  { path: "/analyst", label: "Analyst" },
  { path: "/evidence", label: "Evidence" },
] as const;

function useRoute(): string {
  const read = () => window.location.hash.replace(/^#/, "") || "/";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

function Catalog({ search }: { search: string }) {
  const inv = useDataset("investigations");
  const pds = useStore((s) => s.pds);
  const setPds = useStore((s) => s.setPds);
  const selected = useStore((s) => s.selectedInvestigationId);
  const select = useStore((s) => s.setSelectedInvestigationId);
  if (inv.status === "loading") return <p>Loading catalog.</p>;
  if (inv.status === "error") return <p role="alert">{inv.error}</p>;
  const q = search.trim().toLowerCase();
  const rows = inv.data.filter(
    (i) =>
      (pds === "all" || i.pds === pds) &&
      (!q || `${i.id} ${i.title} ${i.fuel} ${i.hardware}`.toLowerCase().includes(q)),
  );
  return (
    <section aria-labelledby="catalog-h">
      <h2 id="catalog-h">Catalog</h2>
      <label className="field">
        <span>Prevention / Detection / Suppression</span>
        <select value={pds} onChange={(e) => setPds(e.target.value as PdsFilter)}>
          <option value="all">All</option>
          <option value="Prevention">Prevention</option>
          <option value="Detection">Detection</option>
          <option value="Suppression">Suppression</option>
        </select>
      </label>
      <p>{rows.length} of {inv.data.length} investigations</p>
      <ul className="cards">
        {rows.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              className="card"
              aria-pressed={selected === i.id}
              onClick={() => select(selected === i.id ? null : i.id)}
            >
              <strong>{i.title}</strong> <span className="muted">{i.id} · {i.pds}</span>
              <span className="muted block">{i.pdsBasis}</span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p>No investigations match this filter.</p>}
    </section>
  );
}

export default function App() {
  const route = useRoute();
  const [search, setSearch] = useState("");
  const habitat = useStore((s) => s.habitat);
  const setHabitat = useStore((s) => s.setHabitat);
  const habitats = useDataset("habitats");
  const inv = useDataset("investigations");
  const isFixture = (habitats.status === "ready" && habitats.isFixture) || (inv.status === "ready" && inv.isFixture);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <span className="brand">Flame in Freefall</span>
        <label className="field">
          <span>Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, fuel, hardware" />
        </label>
        <label className="field">
          <span>Habitat</span>
          <select value={habitat} onChange={(e) => setHabitat(e.target.value as HabitatId)}>
            {habitats.status === "ready" ? (
              habitats.data.map((h) => (
                <option key={h.id} value={h.id}>{h.label} ({h.o2Percent}% O2, {h.pressureKPa} kPa)</option>
              ))
            ) : (
              <option value={habitat}>{habitat}</option>
            )}
          </select>
        </label>
        {isFixture && <span className="badge">fixture data</span>}
      </header>
      <nav aria-label="Sections" className="nav">
        {ROUTES.map((r) => (
          <a key={r.path} href={`#${r.path}`} aria-current={route === r.path ? "page" : undefined}>{r.label}</a>
        ))}
      </nav>
      <main id="main" tabIndex={-1}>
        {route === "/rank" ? <Ranking /> : route === "/analyst" ? <Analyst /> : route === "/evidence" ? <Evidence mode="page" /> : <Catalog search={search} />}
      </main>
    </>
  );
}
