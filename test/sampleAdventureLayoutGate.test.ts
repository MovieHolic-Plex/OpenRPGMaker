// 샘플 어드벤처(= `?freshProject=1`, 에디터를 처음 열면 보이는 프로젝트)에서 AI 적용이
// 배치 게이트에 막히면 안 된다. 예전에 이 프로젝트에는 수관 아래 밑동이 없는 나무가 있어서
// validateLayoutPlacement 가 error 를 냈고, 그 결과 "이 맵에 뭘 시켜도 적용이 거부"됐다.
// 지금은 적용 경로가 repairLayoutPlacement 로 먼저 고치므로 남는 error 가 0이어야 한다.
import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults";
import { repairLayoutPlacement } from "@/project/lint/layoutPlacementRepair";
import { layoutValidationBlocking } from "@/project/lint/layoutPlacementValidate";

describe("샘플 어드벤처 배치 게이트", () => {
  it("모든 맵에서 자동 수리 후 차단 오류가 남지 않는다", () => {
    const project = createSampleAdventureProject();
    for (const mapId of Object.keys(project.maps)) {
      const repaired = repairLayoutPlacement(project, { mapId });
      const blocking = layoutValidationBlocking(repaired.remaining);
      expect(blocking.map((issue) => `${mapId}:${issue.code}@(${issue.x},${issue.y}) ${issue.message}`)).toEqual([]);
    }
  });

  it("맵 전체 검사에서도 자동 수리 후 차단 오류가 없다", () => {
    const project = createSampleAdventureProject();
    const repaired = repairLayoutPlacement(project);
    expect(layoutValidationBlocking(repaired.remaining).map((issue) => issue.message)).toEqual([]);
  });

});
