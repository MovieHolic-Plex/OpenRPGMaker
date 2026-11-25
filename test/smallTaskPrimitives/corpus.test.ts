/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { OWNERSHIP } from "@/editor/smallTask/primitives/ownership";
import { loadFixture, setupCorpusProject } from "./harness";
import { corpusFiles as files, evaluateCheck, registerCorpusShard } from "./corpusSuite";

// 사례는 corpusSuite.ts 의 CORPUS_SHARDS 로 이 파일과 corpus-2..5.test.ts 에 나뉘어 돈다(유닛 하나만: OPRN_CORPUS_UNIT).
it("작은 일 유닛마다 검수 자료 파일이 있다", () => {
  expect(files).toEqual(expect.arrayContaining(Object.keys(OWNERSHIP).map(unit => `${unit}.json`)));
});

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

registerCorpusShard(0);
