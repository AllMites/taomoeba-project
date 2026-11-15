import NewTabLink from "../app/NewTabLink.tsx";
import { safeHref } from "./brief.ts";
import type { CitedRecord } from "./overview.ts";

/** "How we know": the quoted records behind a statement and their sources. Shared by takeaway cards and the overview. */
export default function HowWeKnow({ records }: { records: CitedRecord[] }) {
  if (!records.length) return null;
  return (
    <details className="brief-how">
      <summary>How we know</summary>
      {records.map((r, i) => (
        <div key={i} className="brief-record">
          {r.summary && <p className="brief-summary">{r.summary}</p>}
          <p className="brief-excerpt">{r.quote}</p>
          {r.cited.length > 0 && (
            <ul className="brief-sources">
              {r.cited.map((s, j) => {
                const href = s.url ? safeHref(s.url) : null;
                return <li key={j}>{href ? <NewTabLink href={href}>{s.title}</NewTabLink> : s.title}</li>;
              })}
            </ul>
          )}
        </div>
      ))}
    </details>
  );
}
