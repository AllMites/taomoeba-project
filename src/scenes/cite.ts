// The records a stage caption cites, resolved once for "How we know" (the Interpret sheet's resolver, read only).
import { useEffect, useState } from "react";
import { resolveRef, type CitedRecord, type OverviewDb, type Ref } from "../brief/overview.ts";

let pending: Promise<OverviewDb> | null = null;

const get = (name: string) =>
  fetch(`/data/${name}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
const items = (j: unknown) => (Array.isArray(j) ? j : j && typeof j === "object" && Array.isArray((j as { items?: unknown }).items) ? (j as { items: unknown[] }).items : []);

function load(): Promise<OverviewDb> {
  pending ??= Promise.all([get("claims"), get("sources"), get("facts"), get("solids")]).then(([claims, sources, facts, solids]) => ({
    claims: items(claims) as OverviewDb["claims"],
    sources: items(sources) as OverviewDb["sources"],
    facts: items(facts) as OverviewDb["facts"],
    solids: solids && typeof solids === "object" && "saffire" in solids ? (solids as OverviewDb["solids"]) : null,
    earth: [],
    investigations: [],
    habitats: [],
  }));
  return pending;
}

/** The cited records for a caption's refs; empty until the data has loaded or when there are none. */
export function useCited(refs: string[] | undefined): CitedRecord[] {
  const [db, setDb] = useState<OverviewDb | null>(null);
  const want = !!refs?.length;
  useEffect(() => {
    if (!want || db) return;
    let live = true;
    void load().then((d) => live && setDb(d));
    return () => {
      live = false;
    };
  }, [want, db]);
  return db && refs ? refs.flatMap((r) => resolveRef(r as Ref, db) ?? []) : [];
}
