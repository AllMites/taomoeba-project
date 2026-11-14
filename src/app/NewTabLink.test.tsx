import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import NewTabLink from "./NewTabLink.tsx";

it("says a new-tab link opens a new tab, and keeps the opener cut", () => {
  const h = renderToStaticMarkup(<NewTabLink href="https://psi.nasa.gov/x">FLEX record</NewTabLink>);
  expect(h).toContain('target="_blank"');
  expect(h).toContain('rel="noopener noreferrer"');
  expect(h).toMatch(/FLEX record<span class="sr-only"> \(opens in a new tab\)<\/span><\/a>/);
});
