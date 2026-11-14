import type { HabitatPreset } from "../../contracts/index.ts";

/** ISS reference air for the left flame, from the same habitats file the page uses. Shared by every mount. */
let pending: Promise<HabitatPreset | undefined> | undefined;
let cached: HabitatPreset | undefined;

/** The ISS preset if it has already loaded, so a remount shows it on its first frame. */
export const issAirNow = () => cached;

/** Loads the ISS preset once. A failed or empty load is not kept, so the next mount tries again. */
export function loadIssAir(url: string, fetchFn: typeof fetch = fetch): Promise<HabitatPreset | undefined> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetchFn(url)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((d: { items?: HabitatPreset[] } | HabitatPreset[] | undefined) => (Array.isArray(d) ? d : (d?.items ?? [])).find((h) => h.id === "iss"))
    .catch(() => undefined)
    .then((h) => {
      cached = h;
      if (!h) pending = undefined;
      return h;
    });
  return pending;
}

/** Tests only. */
export function resetIssAir() {
  pending = undefined;
  cached = undefined;
}
