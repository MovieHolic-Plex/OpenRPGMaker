import { expect, it } from "vitest";
import { proposalCallChangedSomething } from "@/ai/proposalCompleteness";
import { summarizeChanges } from "@/editor/tools/changeset";
import { monsterContext } from "./monsterAiFixture";

it.each([undefined, 0, 1])("accounts for optional monster metadata changes when count is %j", count => {
  // Given an otherwise empty legacy-compatible change summary.
  const { project } = monsterContext();
  const diff = summarizeChanges(project, project);
  delete diff.monsterMetadataChanged;
  if (count !== undefined) diff.monsterMetadataChanged = count;
  // When the AI completeness consumer evaluates the change.
  const changed = proposalCallChangedSomething({ name: "metadata-edit", args: {}, result: { ok: true, diff } });
  // Then metadata-only changes count, while absence/zero stays compatible.
  expect(changed).toBe(count === 1);
});
