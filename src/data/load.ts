import { z } from "zod";
import { datasetSchemas, type DatasetName } from "../contracts/index.ts";

export type Loaded<N extends DatasetName> = { data: z.infer<(typeof datasetSchemas)[N]>[]; isFixture: boolean };
type Fetcher = (url: string) => Promise<Response>;

/** Real files may be a bare array or `{ items: [...] }`; fixtures are always `{ fixture: true, items }`. */
async function readItems(fetcher: Fetcher, url: string): Promise<unknown[] | null> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    const json: unknown = await res.json(); // a dev server may answer 200 with index.html: parse failure means "missing"
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object" && Array.isArray((json as { items?: unknown }).items)) {
      return (json as { items: unknown[] }).items;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadDataset<N extends DatasetName>(
  name: N,
  fetcher: Fetcher = (u) => fetch(u),
): Promise<Loaded<N>> {
  const schema = z.array(datasetSchemas[name]);
  const real = await readItems(fetcher, `/data/${name}.json`);
  if (real) return { data: schema.parse(real) as Loaded<N>["data"], isFixture: false };
  const fixture = await readItems(fetcher, `/data/fixtures/${name}.fixture.json`);
  if (!fixture) throw new Error(`No data for "${name}": neither /data/${name}.json nor its fixture could be loaded`);
  return { data: schema.parse(fixture) as Loaded<N>["data"], isFixture: true };
}
