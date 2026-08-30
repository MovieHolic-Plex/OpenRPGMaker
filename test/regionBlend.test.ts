// 이음새 마감 + 어울림 검증 계약.
//
// 이 두 함수가 다듬기의 "결과가 정말 이어졌는가" 를 책임진다. 특히 polishRegionSeams 는
// 영역 **밖 1칸**을 건드리는 유일한 경로라, 재질까지 바꾸지 않는다는 계약이 깨지면
// 하드 스코프(clipMapCellsToRegion)를 우회해 맵을 오염시키는 구멍이 된다.
import { describe, expect, it } from "vitest";
import {
  analyzeRegionBlend,
  describeBlendBreak,
  describeBlockedEntrance,
  expandRegion,
  polishRegionSeams,
} from "@/editor/regionTask/regionBlend";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, TILE } from "@/project/defaults";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import type { Project } from "@/project/types";

const MAP_ID = "map_blend";
const W = 20;
const REGION: RegionRect = { x: 8, y: 8, width: 4, height: 4 };

function makeProject(): Project {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: MAP_ID, name: "어울림 테스트", width: W, height: W });
  expect(created.ok, created.summary).toBe(true);
  context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
  return context.project;
}

/** 이 맵의 오토타일 그룹이 관리하는 타일 id 전체 — "재질 집합" 판정의 기준. */
function autotileMemberIds(project: Project): Set<number> {
  const map = project.maps[MAP_ID];
  const ids = new Set<number>();
  for (const group of autotileGroupsForTileset(project.tilesets[map.tilesetId])) {
    for (const id of group.memberTileIds) ids.add(id);
  }
  return ids;
}

function fill(project: Project, rect: RegionRect, tileId: number): void {
  const map = project.maps[MAP_ID];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) map.lowerTiles[y * W + x] = tileId;
  }
}

describe("expandRegion", () => {
  it("margin 만큼 키우고 맵 안으로 자른다", () => {
    expect(expandRegion({ x: 5, y: 5, width: 2, height: 2 }, 2)).toEqual({ x: 3, y: 3, width: 6, height: 6 });
    // 좌상단에 붙으면 음수로 나가지 않고 폭이 줄어든다(오른쪽·아래는 그대로 자란다).
    expect(expandRegion({ x: 0, y: 0, width: 2, height: 2 }, 2, { width: 10, height: 10 }))
      .toEqual({ x: 0, y: 0, width: 4, height: 4 });
    expect(expandRegion({ x: 8, y: 8, width: 2, height: 2 }, 2, { width: 10, height: 10 }))
      .toEqual({ x: 6, y: 6, width: 4, height: 4 });
  });
});

describe("polishRegionSeams", () => {
  it("계단식 모래 경계의 변형을 다시 계산하고 재질 집합은 바꾸지 않는다", () => {
    const project = makeProject();
    // 영역 안을 통째로 기본 모래 id 로 칠한다 — 변형이 전부 «가운데» 라 경계가 직각으로 굳는다.
    fill(project, REGION, TILE.SAND);
    const before = project.maps[MAP_ID].lowerTiles.slice();
    const members = autotileMemberIds(project);

    const result = polishRegionSeams(project, MAP_ID, REGION);

    expect(result.polishedCells).toBeGreaterThan(0);
    // 입력은 변형되지 않는다(순수).
    expect(project.maps[MAP_ID].lowerTiles).toEqual(before);
    const after = result.project.maps[MAP_ID].lowerTiles;
    // 바뀐 칸은 모두 오토타일 그룹 멤버 사이의 이동이다 — 잔디가 모래로 뒤바뀌지 않는다.
    for (let index = 0; index < after.length; index += 1) {
      if (after[index] === before[index]) continue;
      expect(members.has(before[index]!)).toBe(true);
      expect(members.has(after[index]!)).toBe(true);
    }
  });

  it("멱등이다 — 승인 시 재검토에서 다시 돌려도 결과가 같다", () => {
    const project = makeProject();
    fill(project, REGION, TILE.SAND);
    const once = polishRegionSeams(project, MAP_ID, REGION);
    const twice = polishRegionSeams(once.project, MAP_ID, REGION);
    expect(twice.project.maps[MAP_ID].lowerTiles).toEqual(once.project.maps[MAP_ID].lowerTiles);
    expect(twice.seamCells).toBe(0);
  });

  it("없는 맵이면 입력을 그대로 돌려준다", () => {
    const project = makeProject();
    const result = polishRegionSeams(project, "map_missing", REGION);
    expect(result.project).toBe(project);
    expect(result.seamCells).toBe(0);
  });

  it("이음새로 바뀐 영역 밖 칸은 확장 스코프에서 region-scope-violation 이 되지 않는다", () => {
    const base = makeProject();
    fill(base, REGION, TILE.SAND);
    // 영역 밖 한 줄도 모래로 — polishMapTerrain 이 8-이웃 링까지 재검사하므로 밖에서도 변형이 바뀐다.
    fill(base, { x: REGION.x, y: REGION.y + REGION.height, width: REGION.width, height: 1 }, TILE.SAND);
    const seamed = polishRegionSeams(base, MAP_ID, REGION);
    expect(seamed.seamCells).toBeGreaterThan(0);

    const scoped = reviewRegionDraft({
      base,
      draft: seamed.project,
      mapId: MAP_ID,
      region: REGION,
      scopeRegion: expandRegion(REGION, 1, base.maps[MAP_ID]),
    });
    expect(scoped.report.issues.filter((issue) => issue.code === "region-scope-violation")).toEqual([]);

    // 같은 초안을 원래 사각형 기준으로 보면 error 로 잡힌다 — 확장 스코프가 실제로 필요했다는 증거.
    const strict = reviewRegionDraft({ base, draft: seamed.project, mapId: MAP_ID, region: REGION });
    expect(strict.report.issues.some((issue) => issue.code === "region-scope-violation")).toBe(true);
  });
});

describe("analyzeRegionBlend", () => {
  it("주변과 같은 재질이면 만점이다", () => {
    const project = makeProject();
    const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
    expect(report.totalEdgeCells).toBe(REGION.width * 2 + REGION.height * 2);
    expect(report.matchedEdgeCells).toBe(report.totalEdgeCells);
    expect(report.score).toBe(100);
    expect(report.brokenCrossings).toEqual([]);
  });

  it("바깥 길이 영역 안에서 끊기면 brokenCrossings 로 좌표를 남긴다", () => {
    const project = makeProject();
    // 영역 위쪽 바로 밖 한 줄을 길로 — 영역 안은 잔디라 길이 끊긴다.
    fill(project, { x: REGION.x, y: REGION.y - 1, width: REGION.width, height: 1 }, TILE.PATH);

    const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
    expect(report.brokenCrossings).toHaveLength(REGION.width);
    for (const crossing of report.brokenCrossings) {
      expect(crossing.kind).toBe("road");
      expect(crossing.y).toBe(REGION.y);
    }
    expect(report.score).toBeLessThan(100);
    expect(describeBlendBreak(report.brokenCrossings[0])).toContain(`(${REGION.x},${REGION.y})`);
  });

  it("길을 영역 안까지 이으면 끊김이 사라진다", () => {
    const project = makeProject();
    fill(project, { x: REGION.x, y: REGION.y - 1, width: REGION.width, height: 1 }, TILE.PATH);
    fill(project, REGION, TILE.PATH);
    const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
    expect(report.brokenCrossings).toEqual([]);
  });

  it("원래부터 벽이던 경계는 newlyBlockedEntrances 에 들어가지 않는다", () => {
    const base = makeProject();
    // 영역 첫 줄을 벽으로 — base 에서도 막혀 있다.
    fill(base, { x: REGION.x, y: REGION.y, width: REGION.width, height: 1 }, TILE.WALL);
    const report = analyzeRegionBlend({ project: base, mapId: MAP_ID, region: REGION, base });
    expect(report.newlyBlockedEntrances).toEqual([]);
  });

  it("걸어 들어오던 칸을 이 초안이 막으면 새로 막힌 진입으로 센다", () => {
    const base = makeProject();
    const draft: Project = structuredClone(base);
    fill(draft, { x: REGION.x, y: REGION.y, width: REGION.width, height: 1 }, TILE.WALL);

    const report = analyzeRegionBlend({ project: draft, mapId: MAP_ID, region: REGION, base });
    // 북쪽 변 4칸 + 서/동 변의 첫 줄 2칸이 벽이 된다.
    expect(report.newlyBlockedEntrances.length).toBeGreaterThanOrEqual(REGION.width);
    for (const point of report.newlyBlockedEntrances) expect(point.y).toBe(REGION.y);
    expect(describeBlockedEntrance(report.newlyBlockedEntrances[0])).toContain("새로 막혔습니다");
  });

  it("없는 맵이면 0점 빈 리포트", () => {
    const report = analyzeRegionBlend({ project: makeProject(), mapId: "map_missing", region: REGION });
    expect(report).toEqual({
      score: 0,
      matchedEdgeCells: 0,
      totalEdgeCells: 0,
      brokenCrossings: [],
      newlyBlockedEntrances: [],
    });
  });
});
