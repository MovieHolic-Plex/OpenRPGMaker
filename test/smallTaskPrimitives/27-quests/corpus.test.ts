import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { questDefId } from "@/project/quest/questDef";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "../harness";

const corpusPath = resolve("harness-data", "small-task-corpus", "27-quests.json");
const cases: CorpusCase[] = JSON.parse(readFileSync(corpusPath, "utf8"));
const fixtures = new Map<FixtureName, Project>();

describe("퀘스트 한국어 회귀 요청", () => {
  for (const entry of cases) {
    it(entry.request, async () => {
      let before = fixtures.get(entry.fixture);
      if (!before) {
        before = loadFixture(entry.fixture);
        // The store expects normalized data when an undo check reuses this frozen fixture.
        ensureSwitchVariableSlots(before);
        removeLegacySpriteReferences(before);
        fixtures.set(entry.fixture, before);
      }
      const target = resolveTarget(before, entry.target);
      const originalQuests = structuredClone(before.quests);
      const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
      if (entry.expectRefusal) {
        expect(apply).toThrow(PrimitiveError);
        expect(entry.refusalMessage).toBeTruthy();
        expect(apply).toThrow(new RegExp(entry.refusalMessage!, "u"));
        expect(before.quests).toEqual(originalQuests);
        return;
      }
      const { after, sentence } = apply();
      expect(before.quests).toEqual(originalQuests);
      expect({ ...after, quests: before.quests }).toEqual(before);
      expect(entry.expect?.length).toBeGreaterThan(0);
      const afterById = new Map(after.quests?.map(quest => [questDefId(quest), quest]));
      const changed = originalQuests?.filter(quest => !jsonEqual(quest, afterById.get(questDefId(quest)))) ?? [];
      const added = (after.quests?.length ?? 0) - (originalQuests?.length ?? 0);
      expect(changed).toHaveLength(entry.primitive === "quest.create" ? 0 : 1);
      expect(added).toBe(entry.primitive === "quest.create" ? 1 : entry.primitive === "quest.remove" ? -1 : 0);
      expectKoreanSentence(sentence, target);
      for (const check of entry.expect ?? []) {
        const value = readCheckPath(after, check.at);
        if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
        if (check.count !== undefined) expect(value, check.at).toHaveLength(check.count);
        if (Object.hasOwn(check, "includes")) {
          const includes = typeof value === "string" && typeof check.includes === "string" ? value.includes(check.includes)
            : Array.isArray(value) && value.some(row => jsonEqual(row, check.includes));
          expect(includes, check.at).toBe(true);
        }
      }
      await expectUndoRestores(before, after, target);
    });
  }
});
