/** @vitest-environment happy-dom */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readCheckPath, resolveTarget, type Check, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { OWNERSHIP } from "@/editor/smallTask/primitives/ownership";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture, setupCorpusProject } from "./harness";

// Vitest transforms import.meta.url into a browser URL in happy-dom.
const directory = resolve("harness-data/small-task-corpus");
const files = readdirSync(directory).filter(file => file.endsWith(".json")).sort();
const unit = process.env.OPRN_CORPUS_UNIT;
const selectedFiles = unit === undefined ? files : files.filter(file => file === `${unit}.json`);
if (!selectedFiles.length) throw new Error(`검수 자료 유닛을 찾을 수 없어요: ${unit}`);
const suites = selectedFiles.map(file => {
  const cases: CorpusCase[] = JSON.parse(readFileSync(join(directory, file), "utf8"));
  if (!Array.isArray(cases)) throw new Error(`검수 자료는 배열이어야 합니다: ${file}`);
  return { file, cases };
});

const fixtures = new Map<FixtureName, Project>();
beforeAll(() => {
  const names = new Set(suites.flatMap(({ cases }) => cases.map(entry => entry.fixture)));
  for (const name of names) {
    const fixture = loadFixture(name);
    // Match the editor's normalization before the first case reads or hashes a command.
    ensureSwitchVariableSlots(fixture);
    removeLegacySpriteReferences(fixture);
    fixtures.set(name, fixture);
  }
}, 240_000);

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

it("사례별 시드를 순서대로 적용한 뒤 새로 추가한 자료 행을 선택한다", () => {
  const fixture = loadFixture("blank");
  const entry = {
    request: "장비 칸 이름을 고쳐 줘",
    fixture: "blank",
    seed: { variables: [{ id: "test_var", name: "검수 변수" }], database: { equipmentSlots: [{ id: "gear", label: "장구" }] } },
    setup: { database: { equipmentSlots: [{ id: "gear", label: "장비" }] } },
    target: { kind: "dbEntry", collection: "equipmentSlots", id: "gear" },
    primitive: "db.equipmentSlots.update",
    args: { label: "새 장비" },
  } satisfies CorpusCase;
  const project = setupCorpusProject(fixture, entry);
  expect(resolveTarget(project, entry.target)).toMatchObject({ label: "장비 슬롯 · 장비" });
  expect(project.variables.at(-1)?.id).toBe("test_var");
  expect(fixture.database.equipmentSlots?.some(slot => slot.id === "gear") ?? false).toBe(false);
  expect(entry.seed.database.equipmentSlots[0]?.label).toBe("장구");
});

function expectCorpusRefusal(apply: () => unknown, reason?: string): void {
  expect(apply).toThrow(PrimitiveError);
  if (reason) expect(apply).toThrow(new RegExp(reason, "u"));
}

for (const { file, cases } of suites) {
  if (!cases.length) continue;
  describe(file, () => {
    for (const entry of cases) {
      it(entry.request, async () => {
        const fixture = fixtures.get(entry.fixture)!;
        const before = setupCorpusProject(fixture, entry);
        const target = resolveTarget(before, entry.target);
        const apply = () => runPrimitive(before, target, entry.primitive, entry.args, entry.selection);
        const seededSuccess = entry.expectRefusal && entry.expect?.length && (entry.setup || entry.seed);
        if (seededSuccess) {
          expectCorpusRefusal(() => runPrimitive(fixture, resolveTarget(fixture, entry.target), entry.primitive, entry.args, entry.selection),
            entry.refusalMessage);
        } else if (entry.expectRefusal) {
          expectCorpusRefusal(apply, entry.refusalMessage);
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
