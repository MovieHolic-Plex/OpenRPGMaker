import { expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";

it("includes machine-readable frozen source provenance when canonical authoring is active", () => {
  // Given
  const project = spaceCompilerFixture();
  const document = fixtureDocument(project);
  project.spatialAuthoring = { ...document, library: { ...document.library, spaces: {} } };
  const before = JSON.stringify(project);
  // When
  const context = buildSystemPrompt(project, { budgetChars: 6000 });
  // Then: parsed structural payload, not prose.
  const payload = context.match(/<spatial-authoring>(.*?)<\/spatial-authoring>/s)?.[1];
  expect(payload).toBeDefined();
  if (!payload) throw new TypeError("Missing spatial context payload");
  const parsed: unknown = JSON.parse(payload);
  expect(parsed).toMatchObject({ active: true, occurrences: expect.arrayContaining([
    expect.objectContaining({ id: "compiler-room", source: { kind: "space", id: spaceDesign, revision: 1 }, sourceMissing: true }),
  ]) });
  expect(JSON.stringify(project)).toBe(before);
});
