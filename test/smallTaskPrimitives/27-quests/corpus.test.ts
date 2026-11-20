/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "../harness";

// Resolve via Node's filesystem path since happy-dom can turn the shared suite's relative URL into HTTP.
const corpusPath = resolve("harness-data", "small-task-corpus", "27-quests.json");
const cases: CorpusCase[] = JSON.parse(readFileSync(corpusPath, "utf8"));
const fixtures = new Map<FixtureName, Project>();

describe("퀘스트 한국어 회귀 요청", () => {
  for (const entry of cases) {
    it(entry.request, async () => {
      let before = fixtures.get(entry.fixture);
      if (!before) {
        before = loadFixture(entry.fixture);
        fixtures.set(entry.fixture, before);
      }
      const target = resolveTarget(before, entry.target);
      const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
      if (entry.expectRefusal) {
        expect(apply).toThrow(PrimitiveError);
        return;
      }
      const { after, sentence } = apply();
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
