import { describe, expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/21-db-life-farm";
import type { Project } from "@/project/types";
import casesJson from "../../../harness-data/small-task-corpus/21-db-life-farm.json";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "../harness";

type SeededCase = CorpusCase & { setup?: { database: Partial<Project["database"]> } };

// Use the same database setup format as the shot harness until the common corpus runner accepts it.
const cases = casesJson as SeededCase[];
const fixtures = new Map<CorpusCase["fixture"], Project>();

export function testSeededCorpus() {
  describe("생활 자료집 한국어 요청", () => {
    it("동작마다 적어도 여덟 건과 한두 건의 거절 사례를 둔다", () => {
      for (const primitive of PRIMITIVES) {
        const matching = cases.filter(entry => entry.primitive === primitive.id);
        expect(matching.length, primitive.id).toBeGreaterThanOrEqual(8);
        const refused = matching.filter(entry => entry.expectRefusal).length;
        expect(refused, primitive.id).toBeGreaterThanOrEqual(1);
        expect(refused, primitive.id).toBeLessThanOrEqual(2);
      }
    });

    it.each(cases)("$request", async entry => {
      let fixture = fixtures.get(entry.fixture);
      if (!fixture) {
        const original = loadFixture(entry.fixture);
        fixture = {
          ...original,
          tilesets: Object.fromEntries(Object.entries(original.tilesets)
            .map(([id, tileset]) => [id, { ...tileset, referenceDocuments: [] }])),
        };
        fixtures.set(entry.fixture, fixture);
      }
      const before = { ...fixture, database: { ...fixture.database, ...entry.setup?.database } };
      const target = resolveTarget(before, entry.target);
      const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
      if (entry.expectRefusal) {
        expect(apply).toThrow(PrimitiveError);
        expect(apply).toThrow(/[가-힣]/u);
        return;
      }
      const { after, sentence } = apply();
      expectKoreanSentence(sentence, target);
      expect(entry.expect?.length).toBeGreaterThan(0);
      for (const check of entry.expect ?? []) {
        const value = readCheckPath(after, check.at);
        if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
        if (check.count !== undefined) expect(value, check.at).toHaveLength(check.count);
      }
      await expectUndoRestores(before, after, target);
    });
  });
}
