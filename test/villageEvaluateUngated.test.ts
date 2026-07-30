// 마을 품질 게이트가 "생성기 도장" 없이도 작동하는지 지키는 가드.
//
// 실측 배경(2026-07-26): 13개 품질 검사 전체가 `layoutPlan.kind === "village-harness-natural-v2"`
// 조건 안에 갇혀 있었다. 그래서 손으로 만든 맵·AI가 만든 맵은 전부 무검사 통과했다.
// 실제 샘플 마을(이슬 장터 100×100)은 96타일 직선 도로 + NPC 일정 0개인데 "지적 1건" 으로 통과했다.
import { describe, expect, it } from "vitest";
import { evaluateVillageLook } from "@/editor/tools/villageEvaluate";
import { createBlankProject } from "@/project/defaults/defaultProject";
import type { GameMap, Project } from "@/project/types";

const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const SAND_BODY = 364; // 모래 몸통 — roadCells 로 집계되는 길 재질
const FENCE = 378;

/** 문 쌍 N개 + 아주 긴 직선 길을 가진 맵. layoutPlan 은 일부러 없다(손으로 만든 맵 모사). */
function settlementMap(houses: number, options: { straightRoad: number; fenceCells: number }): GameMap {
  const width = 60;
  const height = 30;
  const project = createBlankProject();
  const base = project.maps[project.startMapId]!;
  const lowerTiles = new Array<number>(width * height).fill(base.lowerTiles[0]!);
  const upperTiles = new Array<number>(width * height).fill(-1);
  // 한 줄로 쭉 뻗은 길 — meander_roads 검사 대상.
  for (let x = 0; x < Math.min(width, options.straightRoad); x += 1) lowerTiles[10 * width + x] = SAND_BODY;
  // 집마다 문 한 쌍(위/아래). 문 타일은 lowerTiles 에 있다(collectMetrics 가 그렇게 센다).
  // 문 앞 좌표는 타일이 아니라 door/문 이름의 이벤트에서 유추한다(inferDoorFronts).
  const events: GameMap["events"] = [];
  for (let i = 0; i < houses; i += 1) {
    const x = 2 + i * 4;
    lowerTiles[3 * width + x] = DOOR_TOP;
    lowerTiles[4 * width + x] = DOOR_BOTTOM;
    // 문 앞은 길이어야 도달성 검사가 성립한다 — 길 행(y=10)까지 이어 준다.
    for (let y = 5; y <= 10; y += 1) lowerTiles[y * width + x] = SAND_BODY;
    events.push({ ...(base.events[0] ?? ({} as GameMap["events"][number])), id: `door_${i}`, x, y: 4 });
  }
  for (let i = 0; i < options.fenceCells; i += 1) {
    upperTiles[20 * width + (i % (width - 1))] = FENCE;
  }
  return { ...base, id: "map_test_village", name: "테스트 마을", width, height, lowerTiles, upperTiles, events };
}

function projectWith(map: GameMap): Project {
  const project = createBlankProject();
  project.maps = { ...project.maps, [map.id]: map };
  project.startMapId = map.id;
  project.startPos = { x: 0, y: 10 };
  return project;
}

function issueText(map: GameMap): string {
  const report = evaluateVillageLook({ project: projectWith(map), mapId: map.id });
  return report.issues.join(" | ");
}

describe("마을 품질 게이트 — 생성기 도장 없이도 검사한다", () => {
  it("layoutPlan 이 없어도 긴 직선 도로를 지적한다", () => {
    const text = issueText(settlementMap(4, { straightRoad: 60, fenceCells: 0 }));
    expect(text).toContain("도로 직선 구간이 너무 길다");
  });

  it("layoutPlan 이 없어도 NPC 시간표 부재를 지적한다", () => {
    const text = issueText(settlementMap(4, { straightRoad: 20, fenceCells: 0 }));
    expect(text).toContain("시간표가 있는 주민이 부족하다");
  });

  it("문 쌍으로 집 수를 세므로 울타리 과다를 지적할 수 있다", () => {
    // houseRegions(설계도)는 0 이지만 문 쌍 4개 → 울타리 한도 32칸. 50칸이면 과다.
    const text = issueText(settlementMap(4, { straightRoad: 20, fenceCells: 50 }));
    expect(text).toContain("울타리가 필지를 과도하게 둘러싼다");
  });

  it("설계도가 없으면 집 형태·키트·층수는 지적하지 않는다 — 관찰할 수 없는 것을 지적하면 거짓말이다", () => {
    const text = issueText(settlementMap(4, { straightRoad: 20, fenceCells: 0 }));
    expect(text).not.toContain("집 형태가 단조롭다");
    expect(text).not.toContain("집 키트가 단조롭다");
    expect(text).not.toContain("다층 집이 없어");
  });

  it("정착지가 아닌 맵(문 쌍 0)은 마을 품질을 따지지 않는다", () => {
    const map = settlementMap(0, { straightRoad: 60, fenceCells: 0 });
    const text = issueText(map);
    // 직선 도로가 60칸이지만 집이 없으므로 마을 검사 대상이 아니다.
    expect(text).not.toContain("도로 직선 구간이 너무 길다");
  });

  it("집이 한 채면 아직 정착지로 보지 않는다", () => {
    const text = issueText(settlementMap(1, { straightRoad: 60, fenceCells: 0 }));
    expect(text).not.toContain("도로 직선 구간이 너무 길다");
  });
});
