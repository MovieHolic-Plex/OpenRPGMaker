// test/bootNormalizerReferenceSafety.test.ts
// 계약: 부팅 정규화기는 프로젝트의 참조 무결성을 깨지 않는다.
//
// 현재 계약(2026-09-05): 기존 행의 이미지 연결만 보정하고 삭제한 카탈로그는 복구하지 않는다.
// 과거 결함 근거(2026-08-30): `ensureDefaultDatabaseIconResources` 는 이름과 달리 기본 아이템 카탈로그
// 187종을 프로젝트에 밀어넣는다. 그 아이템들은 기본 스킬·상태를 참조하므로, 자기 스킬·상태 세트가
// 더 작은 프로젝트(예제 어드벤처 = 이슬 장터: items 21 / skills 21 / states 5)에 아이템만 넣으면
// 참조 위반이 82건 생겼다. 그 상태에서 AI 런의 run_lint 가 레이어 검증을 3회 연속 실패시켜 런이
// 죽었고, 에이전트가 고아 레코드를 지우려 하면 커밋 게이트가 같은 왕복 오류로 거부해 청소가
// 불가능한 교착이 됐다.

import { describe, expect, it } from "vitest";
import { createBlankProject, createSampleAdventureProject } from "@/project/defaults";
import { ensureBundledBattleAnimations } from "@/project/defaults/defaultDatabase";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { projectLint } from "@/project/lint/projectLint";

/** store.normalizeCurrentProject 가 부팅마다 도는 두 DB 정규화기(선언 순서 그대로). */
function runBootDatabaseNormalizers(project: ReturnType<typeof createBlankProject>): void {
  ensureDefaultDatabaseIconResources(project);
  ensureBundledBattleAnimations(project);
}

const lintErrors = (project: ReturnType<typeof createBlankProject>): string[] =>
  projectLint(project).filter((issue) => issue.severity === "error").map((issue) => issue.message);

describe("boot normalizers keep reference integrity", () => {
  it("예제 어드벤처: 정규화 전 0건 → 정규화 후에도 참조 위반 0건", () => {
    const project = createSampleAdventureProject();
    expect(collectProjectReferenceIssues(project)).toEqual([]);

    runBootDatabaseNormalizers(project);

    expect(collectProjectReferenceIssues(project)).toEqual([]);
    expect(lintErrors(project)).toEqual([]);
  });

  it("빈 프로젝트도 정규화 후 참조 위반 0건 (기본 세트 자체는 자기충족적이다)", () => {
    const project = createBlankProject();
    runBootDatabaseNormalizers(project);
    expect(collectProjectReferenceIssues(project)).toEqual([]);
  });

  it("아이콘 보정은 삭제한 카탈로그 행이나 그 의존성을 재주입하지 않는다", () => {
    const project = createBlankProject();
    project.database.items = [];
    project.database.equipment = [];
    project.database.skills = [];
    project.database.states = [];

    expect(ensureDefaultDatabaseIconResources(project)).toBe(false);

    expect(project.database.items).toEqual([]);
    expect(project.database.equipment).toEqual([]);
    expect(project.database.skills).toEqual([]);
    expect(project.database.states).toEqual([]);
  });

  it("기존 아이템의 스킬·상태 참조를 유지한다", () => {
    const project = createSampleAdventureProject();
    // 아이콘 연결만 보정한 뒤에도 모든 기존 효과 참조가 유효하다.
    ensureDefaultDatabaseIconResources(project);
    const skillIds = new Set(project.database.skills.map((skill) => skill.id));
    const stateIds = new Set([...project.database.states.map((state) => state.id), "state_death"]);
    for (const item of project.database.items) {
      for (const id of [item.skillId, item.learnedSkillId, item.activateSkillId]) {
        if (typeof id === "string" && id !== "") expect(skillIds.has(id)).toBe(true);
      }
      for (const effect of item.stateEffects) expect(stateIds.has(effect.stateId)).toBe(true);
      for (const id of item.healStateIds) expect(stateIds.has(id)).toBe(true);
    }
  });
});
