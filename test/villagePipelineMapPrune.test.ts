import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { snapshotProjectMaps, wipeAttemptMaps } from "@/editor/tools/villageBuilder";

// run_village_pipeline 재시공 데이터 손실 버그 회귀 방지.
// 구버그: 재시도 시 draft.maps={}로 프로젝트 전체 맵을 삭제 → 사용자의 무관 맵까지 소실.
describe("village pipeline map prune", () => {
  it("이번 실행이 만든 맵만 지우고 사용자의 기존 맵은 보존한다", () => {
    const project = createBlankProject();
    const userMapId = project.mapTree.mapId;
    const baseline = snapshotProjectMaps(project);
    expect(baseline.mapIds.has(userMapId)).toBe(true);

    // 파이프라인이 새로 만든 것처럼 마을 맵 + 그 자식 집 내부 맵 추가
    const template = project.maps[userMapId]!;
    project.maps.map_village_1 = { ...template, id: "map_village_1", name: "마을", events: [] };
    project.maps.map_house_1 = { ...template, id: "map_house_1", name: "집 내부", events: [] };
    project.mapTree.children.push({ mapId: "map_village_1", children: [{ mapId: "map_house_1", children: [] }] });

    wipeAttemptMaps(project, baseline);

    // 사용자 맵 보존, 파이프라인 맵만 제거
    expect(project.maps[userMapId]).toBeDefined();
    expect(project.maps.map_village_1).toBeUndefined();
    expect(project.maps.map_house_1).toBeUndefined();
    expect(Object.keys(project.maps)).toEqual([...baseline.mapIds]);
    // startMapId가 살아있는 맵을 가리킨다(벽돌 방지)
    expect(project.maps[project.startMapId]).toBeDefined();
  });

  it("파이프라인이 트리·시작점을 바꿨어도 기준선으로 복원한다", () => {
    const project = createBlankProject();
    const baseline = snapshotProjectMaps(project);
    const originalStart = project.startMapId;

    const template = project.maps[originalStart]!;
    project.maps.map_village_1 = { ...template, id: "map_village_1", name: "마을", events: [] };
    (project as { startMapId: string }).startMapId = "map_village_1";
    project.startPos = { x: 9, y: 9 };
    project.mapTree = { mapId: "map_village_1", children: [] };

    wipeAttemptMaps(project, baseline);

    expect(project.startMapId).toBe(originalStart);
    expect(project.mapTree.mapId).toBe(baseline.mapTree.mapId);
    expect(project.maps[project.startMapId]).toBeDefined();
  });
});
