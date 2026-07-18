import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { prunePipelineMaps } from "@/editor/tools/villageBuilder";

// run_village_pipeline 재시공 데이터 손실 버그 회귀 방지.
// 구버그: 재시도 시 draft.maps={}로 프로젝트 전체 맵을 삭제 → 사용자의 무관 맵까지 소실.
describe("village pipeline map prune", () => {
  it("이번 실행이 만든 맵만 지우고 사용자의 기존 맵은 보존한다", () => {
    const project = createBlankProject();
    const userMapId = project.mapTree.mapId;
    const preExisting = new Set(Object.keys(project.maps));
    expect(preExisting.has(userMapId)).toBe(true);

    // 파이프라인이 새로 만든 것처럼 마을 맵 + 그 자식 집 내부 맵 추가
    const template = project.maps[userMapId]!;
    project.maps.map_village_1 = { ...template, id: "map_village_1", name: "마을", events: [] };
    project.maps.map_house_1 = { ...template, id: "map_house_1", name: "집 내부", events: [] };
    project.mapTree.children.push({ mapId: "map_village_1", children: [{ mapId: "map_house_1", children: [] }] });

    prunePipelineMaps(project, preExisting);

    // 사용자 맵 보존, 파이프라인 맵만 제거
    expect(project.maps[userMapId]).toBeDefined();
    expect(project.maps.map_village_1).toBeUndefined();
    expect(project.maps.map_house_1).toBeUndefined();
    expect(Object.keys(project.maps)).toEqual([...preExisting]);
    // startMapId가 살아있는 맵을 가리킨다(벽돌 방지)
    expect(project.maps[project.startMapId]).toBeDefined();
  });

  it("빈 preExisting이라도 마지막 맵은 남긴다(applyMapDeletion 마지막-맵 가드)", () => {
    const project = createBlankProject();
    prunePipelineMaps(project, new Set());
    expect(Object.keys(project.maps).length).toBeGreaterThanOrEqual(1);
    expect(project.maps[project.startMapId]).toBeDefined();
  });
});
