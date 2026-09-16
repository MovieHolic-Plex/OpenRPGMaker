import { describe, expect, it } from "vitest";
import { createActionCombatDemoProject } from "@/project/defaults/actionCombatDemoProject";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { createSkyStairProject } from "@/editor/content/skyStairGame";
import { createBlankProject } from "@/project/defaults";
import { collectProjectReferenceIssues, validateProjectReferences } from "@/project/io/references";
import type { Project } from "@/project/types";

/**
 * 아이템 목록을 화이트리스트로 좁힌 프로젝트에 사라진 아이템을 가리키는 DB 행이 남으면
 * `validateProjectReferences` 가 하드 실패해 프로젝트가 아예 열리지 않는다. 기본 DB 에
 * 작물을 더하는 것만으로 emberQuest 가 dangling 4건으로 깨진 적이 있다.
 */
const BUILDERS: ReadonlyArray<readonly [string, () => Project]> = [
  ["blank", createBlankProject],
  ["emberQuest", createEmberQuestProject],
  ["modernNocturne", createModernNocturneProject],
  ["skyStair", createSkyStairProject],
  ["actionCombatDemo", createActionCombatDemoProject],
];

describe("쇼케이스 프로젝트 참조 무결성", () => {
  for (const [name, build] of BUILDERS) {
    it(`${name} 프로젝트는 참조 오류 없이 성립한다`, () => {
      expect(() => validateProjectReferences(build())).not.toThrow();
    });
  }

  it("아이템을 좁힌 프로젝트에는 씨앗이 사라진 작물 행이 남지 않는다", () => {
    for (const [name, build] of BUILDERS) {
      const project = build();
      const itemIds = new Set(project.database.items.map((item) => item.id));
      const dangling = (project.database.crops ?? []).filter(
        (crop) => !itemIds.has(crop.seedItemId) || !itemIds.has(crop.harvestItemId)
      );
      expect(dangling.map((crop) => `${name}:${crop.id}`)).toEqual([]);
    }
  });
});

/**
 * 정규화를 거치지 않은 프로젝트(옛 JSON 저장본·e2e 시드)는 레코드에 필드가 없다.
 * 참조 검증은 그 사실을 **이슈로 보고**해야지, 던져서 에디터 부팅(refreshAuthoringJourney)
 * 을 죽이면 안 된다 — 실측: initialEquipment 없는 배우에서 Object.values(undefined),
 * learnedSkills 없는 클래스에서 .map(undefined) 이 Uncaught TypeError 로 부팅을 멈췄다.
 */
describe("비정규 프로젝트 참조 검증", () => {
  function stripFields(): Project {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    const klass = project.database.classes[0];
    expect(actor, "빈 프로젝트에 배우가 있어야 이 회귀를 재현할 수 있다").toBeDefined();
    expect(klass, "빈 프로젝트에 클래스가 있어야 이 회귀를 재현할 수 있다").toBeDefined();
    const actorRecord = actor as unknown as Record<string, unknown>;
    const classRecord = klass as unknown as Record<string, unknown>;
    delete actorRecord.initialEquipment;
    delete classRecord.learnedSkills;
    delete classRecord.battleCommands;
    delete classRecord.equipmentPermissions;
    return project;
  }

  it("레코드에 필드가 없어도 던지지 않고 이슈 목록을 돌려준다", () => {
    const issues = collectProjectReferenceIssues(stripFields());
    expect(Array.isArray(issues)).toBe(true);
  });

  it("initialEquipment 가 없는 배우는 장비 이슈가 아니라 조용히 통과한다", () => {
    const issues = collectProjectReferenceIssues(stripFields());
    expect(issues.filter((issue) => issue.includes("initialEquipment"))).toEqual([]);
  });
});
