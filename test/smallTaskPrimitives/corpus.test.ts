/** @vitest-environment happy-dom */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readCheckPath, resolveTarget, type Check, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { OWNERSHIP } from "@/editor/smallTask/primitives/ownership";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture, setupCorpusProject } from "./harness";

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../../harness-data/small-task-corpus");
const files = readdirSync(directory).filter(file => file.endsWith(".json")).sort();

it("작은 일 유닛마다 검수 자료 파일이 있다", () => {
  expect(files).toEqual(expect.arrayContaining(Object.keys(OWNERSHIP).map(unit => `${unit}.json`)));
});

function evaluateCheck(project: unknown, check: Check) {
  const value = readCheckPath(project, check.at);
  expect(["equals", "includes", "count"].some(key => Object.hasOwn(check, key)), check.at).toBe(true);
  if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
  if (Object.hasOwn(check, "includes")) {
    const includes = typeof value === "string" && typeof check.includes === "string" ? value.includes(check.includes)
      : Array.isArray(value) && value.some(entry => jsonEqual(entry, check.includes));
    expect(includes, check.at).toBe(true);
  }
  if (check.count !== undefined) {
    expect(Array.isArray(value) || typeof value === "string" ? value.length : undefined, check.at).toBe(check.count);
  }
}

it("검사 경로와 비교 연산으로 저장된 행, 끝 위치, 본문을 검사한다", () => {
  const data = { rows: [{ id: "first", lines: ["첫 줄", "마지막 줄"] }] };
  evaluateCheck(data, { at: "rows[id=first].lines[-1]", equals: "마지막 줄", includes: "마지막" });
  evaluateCheck(data, { at: "rows[0].lines", count: 2, includes: "첫 줄" });
  expect(readCheckPath(data, "rows[id=absent]")).toBeUndefined();
  expect(() => readCheckPath(data, "rows[missing]")).toThrow("잘못된 검수 경로");
});

for (const file of files) {
  const cases: CorpusCase[] = JSON.parse(readFileSync(join(directory, file), "utf8"));
  if (!Array.isArray(cases)) throw new Error(`검수 자료는 배열이어야 합니다: ${file}`);
  if (!cases.length) continue;
  describe(file, () => {
    const fixtures = new Map<FixtureName, Project>();
    for (const entry of cases) {
      it(entry.request, async () => {
        let fixture = fixtures.get(entry.fixture);
        if (!fixture) {
          fixture = loadFixture(entry.fixture);
          fixtures.set(entry.fixture, fixture);
        }
        const before = setupCorpusProject(fixture, entry);
        const target = resolveTarget(before, entry.target);
        const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
        if (entry.expectRefusal) {
          expect(apply).toThrow(PrimitiveError);
          if (entry.refusalMessage) expect(apply).toThrow(new RegExp(entry.refusalMessage, "u"));
          return;
        }
        const { after, sentence } = apply();
        expectKoreanSentence(sentence, target);
        for (const check of entry.expect ?? []) evaluateCheck(after, check);
        await expectUndoRestores(before, after, target);
      });
    }
  });
}
