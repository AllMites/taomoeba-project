import type { Pds } from "../contracts/index.ts";

const PATHS: Record<Exclude<Pds, "Other">, string> = {
  Prevention: "M8 1.5 14 4v4c0 3.4-2.4 5.6-6 6.5C4.4 13.6 2 11.4 2 8V4z", // shield
  Detection: "M7 2a5 5 0 1 0 0 10A5 5 0 0 0 7 2zm3.6 8.6L14.5 14.5", // magnifier
  Suppression: "M8 1.5c2.5 3 4.5 5 4.5 7.5a4.5 4.5 0 0 1-9 0C3.5 6.5 5.5 4.5 8 1.5z", // drop
};

/** Text plus a shape, so the kind never depends on colour. */
export default function PdsTag({ pds }: { pds: Pds }) {
  return (
    <span className={`rk-tag rk-tag-${pds.toLowerCase()}`}>
      {pds !== "Other" && (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d={PATHS[pds]} className={pds === "Detection" ? "rk-tag-stroke" : "rk-tag-shape"} />
        </svg>
      )}
      {pds}
    </span>
  );
}
