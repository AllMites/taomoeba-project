import type { Pds } from "../contracts/index.ts";

/** Shape per kind: shield Prevention, eye Detection, drop Suppression. */
function Shape({ pds }: { pds: Exclude<Pds, "Other"> }) {
  return (
    <svg className="rk-tag-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      {pds === "Prevention" && <path className="rk-tag-shape" d="M8 1.5 14 4v4c0 3.4-2.4 5.6-6 6.5C4.4 13.6 2 11.4 2 8V4z" />}
      {pds === "Detection" && (
        <>
          <path className="rk-tag-stroke" d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
          <circle className="rk-tag-shape" cx="8" cy="8" r="2.2" />
        </>
      )}
      {pds === "Suppression" && <path className="rk-tag-shape" d="M8 1.5c2.5 3 4.5 5 4.5 7.5a4.5 4.5 0 0 1-9 0C3.5 6.5 5.5 4.5 8 1.5z" />}
    </svg>
  );
}

/** Word plus a shape, so the kind never depends on colour. */
export default function PdsTag({ pds }: { pds: Pds }) {
  return (
    <span className={`rk-tag rk-tag-${pds.toLowerCase()}`}>
      {pds !== "Other" && <Shape pds={pds} />}
      {pds}
    </span>
  );
}
