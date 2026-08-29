import { describe, expect, it } from "vitest";
import { createActionCombatDemoProject } from "@/project/defaults/actionCombatDemoProject";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { createSkyStairProject } from "@/editor/content/skyStairGame";
import { createBlankProject } from "@/project/defaults";
import { validateProjectReferences } from "@/project/io/references";
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
