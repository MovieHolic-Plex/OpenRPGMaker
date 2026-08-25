import { expect, it } from "vitest";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";

it("activates quest for ring/fetch/chief Korean text", () => {
  expect(computeActiveToolDomains("촌장이 잃어버린 반지를 찾아와").has("quest")).toBe(true);
});

it("still activates quest for explicit 퀘스트 wording", () => {
  expect(computeActiveToolDomains("퀘스트 만들어줘").has("quest")).toBe(true);
});
