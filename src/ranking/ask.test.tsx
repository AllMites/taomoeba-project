import { beforeEach, expect, it } from "vitest";
import { useConsole } from "../app/console.ts";
import { AskAboutButton } from "./ExperimentCard.tsx";

beforeEach(() => useConsole.setState({ askOpen: false, askAbout: [] }));

it("Ask about this scopes the next question to that experiment and opens the Ask panel", () => {
  const button = AskAboutButton({ id: "PSI-69", title: "FLEX-2" });
  expect(button.props["aria-label"]).toBe("Ask about FLEX-2");
  button.props.onClick();
  button.props.onClick(); // a second press does not add it twice
  expect(useConsole.getState()).toMatchObject({ askOpen: true, askAbout: ["PSI-69"] });
});
