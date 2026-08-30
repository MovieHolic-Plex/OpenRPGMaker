import { expect, it } from "vitest";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";

it("activates quest for ring/fetch/chief Korean text", () => {
  expect(computeActiveToolDomains("촌장이 잃어버린 반지를 찾아와").has("quest")).toBe(true);
});

it("still activates quest for explicit 퀘스트 wording", () => {
  expect(computeActiveToolDomains("퀘스트 만들어줘").has("quest")).toBe(true);
});

it.each(["회상", "플래시백", "과거", "무비", "동영상"])(
  "%s intent opens the event tool bucket with script_cutscene visible",
  (userMessage) => {
    const domains = computeActiveToolDomains(userMessage);
    const exposedNames = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
    expect(domains.has("event"), `${userMessage} should activate the event domain`).toBe(true);
    expect(exposedNames, `${userMessage} should expose script_cutscene`).toContain("script_cutscene");
  },
);
