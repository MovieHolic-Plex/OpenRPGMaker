// test/bootNormalizerReferenceSafety.test.ts
// 계약: 부팅 정규화기는 프로젝트의 참조 무결성을 깨지 않는다.
//
// 실측 근거(2026-08-30): `ensureDefaultDatabaseIconResources` 는 이름과 달리 기본 아이템 카탈로그
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

  it("아이템 카탈로그 주입은 필요한 기본 스킬·상태를 같이 채운다", () => {
    const project = createSampleAdventureProject();
    const skillsBefore = project.database.skills.length;
    const statesBefore = project.database.states.length;

    ensureDefaultDatabaseIconResources(project);

    // 주입된 아이템이 참조하는 상태(예: state_paralysis 를 지우는 신경 안정제)가 실제로 존재한다.
    const injected = project.database.items.find((item) => item.id === "item_gen2_nerve_tonic");
    expect(injected).toBeDefined();
    for (const stateId of injected?.healStateIds ?? []) {
      expect(project.database.states.some((state) => state.id === stateId)).toBe(true);
    }
    expect(project.database.skills.length).toBeGreaterThanOrEqual(skillsBefore);
    expect(project.database.states.length).toBeGreaterThan(statesBefore);
  });

  it("기본 세트로 채울 수 없는 참조를 가진 아이템은 주입하지 않는다", () => {
    const project = createSampleAdventureProject();
    // 기본 카탈로그가 참조하는 상태 하나를 기본 세트에서 못 찾는 상황을 만들 수는 없으므로,
    // 계약은 결과로 확인한다: 주입 후 어떤 아이템도 없는 스킬·상태를 가리키지 않는다.
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
