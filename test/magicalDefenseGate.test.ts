// magical 속성의 mind(마법 방어력) 라우팅은 battleModel="gen1" 에서만 활성이어야 한다.
//
// 회귀: 게이트 없이 적용되어 있었다. normalizeElementKind 의 폴백이 "magical" 이고
// 기본 속성 17개 중 13개(fire/ice/thunder/water/earth/wind/holy/dark/...)가 magical 이라,
// 저장된 모든 RM2k3 프로젝트의 마법 스킬 데미지가 마이그레이션 없이 바뀌는 상태였다.
// `.omo/plans/pokemon-clone-feature.md` task 1 "Must NOT change RM2k3 behavior",
// task 2 "defense mis-wire — fix in gen1 path" 와도 어긋난다.
import { describe, expect, it } from "vitest";
import { usesMagicalDefense } from "@/battle/battleDamage";
import { createBlankProject } from "@/project/defaults/defaultProject";
import type { Project } from "@/project/types";

function projectWithModel(model?: "rm2k3" | "gen1"): Project {
  const project = createBlankProject();
  if (model) project.system.battleModel = model;
  else delete project.system.battleModel;
  return project;
}

describe("magical 방어 라우팅 게이트", () => {
  it("rm2k3(기본/생략)에서는 magical 속성도 defense 를 쓴다", () => {
    expect(usesMagicalDefense(projectWithModel(), "fire")).toBe(false);
    expect(usesMagicalDefense(projectWithModel("rm2k3"), "fire")).toBe(false);
  });

  it("gen1 에서만 magical 속성이 mind 로 라우팅된다", () => {
    expect(usesMagicalDefense(projectWithModel("gen1"), "fire")).toBe(true);
  });

  it("gen1 이어도 physical 속성과 무속성은 defense 를 쓴다", () => {
    const project = projectWithModel("gen1");
    expect(usesMagicalDefense(project, "sword")).toBe(false);
    expect(usesMagicalDefense(project, undefined)).toBe(false);
    expect(usesMagicalDefense(project, "does_not_exist")).toBe(false);
  });

  it("predict 와 runtime 이 동일 판정을 공유한다(데미지 parity)", async () => {
    const { isMagicalElement } = await import("@/battle/battlePredict");
    for (const model of [undefined, "rm2k3", "gen1"] as const) {
      const project = projectWithModel(model);
      for (const elementId of ["fire", "sword", undefined]) {
        expect(isMagicalElement(project, elementId)).toBe(usesMagicalDefense(project, elementId));
      }
    }
  });
});
