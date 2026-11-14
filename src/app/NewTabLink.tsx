import type { ReactNode } from "react";

/** A link that opens a new tab and says so to screen readers (the words are visually hidden). */
export default function NewTabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
