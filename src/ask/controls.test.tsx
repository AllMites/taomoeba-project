import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Panel } from "./index.tsx";

const noop = () => {};
const panel = (busy: boolean, draft = "") =>
  renderToStaticMarkup(
    <Panel open turns={[]} busy={busy} draft={draft} live="" lastResult={null} titleOf={(s) => s} onDraft={noop} onSend={noop} onPick={noop} onClose={noop} onReset={noop} onOpenExperiment={noop} onShow={noop} />,
  );

// A disabled button drops keyboard focus to the page; the one just pressed must stay focusable.
it("keeps the Send button and the suggested questions focusable while waiting", () => {
  const html = panel(true, "What is a cool flame?");
  expect(html).not.toMatch(/\sdisabled=""/);
  expect(html.match(/aria-disabled="true"/g)).toHaveLength(4); // Send + 3 suggestions
});

it("labels the input and caps it at 300 characters", () => {
  const html = panel(false);
  expect(html).toContain('<label for="ask-compose" class="ask-compose-label">Your question</label>');
  expect(html).toContain('maxLength="300"');
});
