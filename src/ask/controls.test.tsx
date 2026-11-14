import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Controls } from "./index.tsx";

const noop = () => {};

// A disabled button drops keyboard focus to the page; the one just pressed must stay focusable.
it("keeps the Ask button and example chips focusable while waiting", () => {
  const html = renderToStaticMarkup(<Controls question="What is a cool flame?" busy onChange={noop} onSubmit={noop} onPick={noop} />);
  expect(html).not.toMatch(/\sdisabled=""/);
  expect(html.match(/aria-disabled="true"/g)).toHaveLength(4); // Ask + 3 examples
});

it("labels the input and caps it at 300 characters", () => {
  const html = renderToStaticMarkup(<Controls question="" busy={false} onChange={noop} onSubmit={noop} onPick={noop} />);
  expect(html).toContain('<label for="ask-q">Your question</label>');
  expect(html).toContain('maxLength="300"');
});
