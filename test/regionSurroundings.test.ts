// 영역 주변 브리핑 계약. 이 브리핑이 「다듬기」 지시의 본문이므로, 여기서 틀리면 모델은
// 주변을 잘못 본 채로 영역 안을 다시 짠다 — 화면에는 그럴듯하게 나오고 이음새만 어긋난다.
import { describe, expect, it } from "vitest";
import {
  analyzeRegionSurroundings,
  formatRegionSurroundingsBrief,
  regionBorderPairs,
  regionSurroundingMargin,
} from "@/editor/regionTask/regionSurroundings";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { runTool } from "@/editor/tools/toolRunner";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { createBlankProject, TILE } from "@/project/defaults";
import type { Project } from "@/project/types";

const MAP_ID = "map_surround";
const W = 20;
const H = 20;
const REGION: RegionRect = { x: 8, y: 8, width: 4, height: 4 };

function makeProject(): Project {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: MAP_ID, name: "주변 테스트", width: W, height: H });
  expect(created.ok, created.summary).toBe(true);
  return context.project;
}

/** 브리핑 라벨은 describeChipsetTile 이 매긴다 — 테스트도 같은 원본을 본다. */
function labelOf(tileId: number): string {
  return describeChipsetTile(tileId).label;
}

function fillRect(project: Project, rect: RegionRect, tileId: number, layer: "lower" | "upper" = "lower"): void {
  const map = project.maps[MAP_ID];
  const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) tiles[y * W + x] = tileId;
  }
}

describe("regionSurroundingMargin", () => {
  it("영역 크기에 비례하고 2~6칸으로 묶인다", () => {
    expect(regionSurroundingMargin({ x: 0, y: 0, width: 1, height: 1 })).toBe(2);
    expect(regionSurroundingMargin({ x: 0, y: 0, width: 4, height: 4 })).toBe(2);
    expect(regionSurroundingMargin({ x: 0, y: 0, width: 12, height: 3 })).toBe(4);
    expect(regionSurroundingMargin({ x: 0, y: 0, width: 40, height: 40 })).toBe(6);
  });
});

describe("regionBorderPairs", () => {
  it("경계 안쪽 셀과 바로 밖 이웃을 짝지으며 맵 밖 쌍은 만들지 않는다", () => {
    const pairs = regionBorderPairs({ width: 10, height: 10 }, { x: 0, y: 0, width: 3, height: 3 });
    // north(y=-1) 와 west(x=-1) 는 맵 밖이라 빠지고 south 3 + east 3 만 남는다.
    expect(pairs).toHaveLength(6);
    for (const pair of pairs) {
      expect(pair.outside.x).toBeGreaterThanOrEqual(0);
      expect(pair.outside.y).toBeGreaterThanOrEqual(0);
      expect(["south", "east"]).toContain(pair.edge);
    }
  });
});

describe("analyzeRegionSurroundings", () => {
  it("없는 맵이면 null", () => {
    expect(analyzeRegionSurroundings(makeProject(), "map_missing", REGION)).toBeNull();
  });

  it("변별 우세 재료를 센다 — 위쪽만 모래로 깔면 위쪽 변에서 모래가 1위다", () => {
    const project = makeProject();
    const grass = TILE.GRASS;
    const sand = TILE.SAND;
    fillRect(project, { x: 0, y: 0, width: W, height: H }, grass);
    // 위쪽 띠(margin=2 → y 6..7)를 모래로. 영역 왼/오른쪽 변에는 걸치지 않게 x 를 영역 폭에 맞춘다.
    fillRect(project, { x: REGION.x, y: REGION.y - 2, width: REGION.width, height: 2 }, sand);

    const surroundings = analyzeRegionSurroundings(project, MAP_ID, REGION);
    expect(surroundings).not.toBeNull();
    const north = surroundings!.edges.find((edge) => edge.edge === "north");
    const south = surroundings!.edges.find((edge) => edge.edge === "south");
    expect(north?.materials[0]?.label).toBe(labelOf(sand));
    expect(north?.materials[0]?.count).toBe(REGION.width * 2);
    expect(south?.materials[0]?.label).toBe(labelOf(grass));
  });

  it("맵 경계에 붙은 변은 cells=0 이고 브리핑이 「맵 경계」로 말한다", () => {
    const project = makeProject();
    const grass = TILE.GRASS;
    fillRect(project, { x: 0, y: 0, width: W, height: H }, grass);
    const corner: RegionRect = { x: 0, y: 0, width: 4, height: 4 };

    const surroundings = analyzeRegionSurroundings(project, MAP_ID, corner)!;
    expect(surroundings.edges.find((edge) => edge.edge === "north")?.cells).toBe(0);
    expect(surroundings.edges.find((edge) => edge.edge === "west")?.cells).toBe(0);
    const brief = formatRegionSurroundingsBrief(surroundings);
    expect(brief).toContain("위쪽: 맵 경계");
    expect(brief).toContain("왼쪽: 맵 경계");
  });

  it("물이 맞닿은 변에서 crossings 를 안쪽 좌표로 기록한다", () => {
    const project = makeProject();
    const grass = TILE.GRASS;
    const water = TILE.WATER;
    fillRect(project, { x: 0, y: 0, width: W, height: H }, grass);
    // 영역 아래 한 줄을 물로 — 영역 남쪽 경계 4칸이 물과 맞닿는다.
    fillRect(project, { x: REGION.x, y: REGION.y + REGION.height, width: REGION.width, height: 1 }, water);

    const surroundings = analyzeRegionSurroundings(project, MAP_ID, REGION)!;
    const waterCrossings = surroundings.crossings.filter((crossing) => crossing.kind === "water");
    expect(waterCrossings).toHaveLength(REGION.width);
    for (const crossing of waterCrossings) {
      expect(crossing.edge).toBe("south");
      // 안쪽 좌표 = 영역 마지막 줄. 바깥(물) 좌표를 주면 모델이 영역 밖을 칠하려 든다.
      expect(crossing.y).toBe(REGION.y + REGION.height - 1);
    }
    expect(formatRegionSurroundingsBrief(surroundings)).toContain("물이 영역과 맞닿는 칸");
  });

  it("영역 안/밖 이벤트를 나눠 담고 브리핑에 안쪽 목록을 남긴다", () => {
    const project = makeProject();
    const grass = TILE.GRASS;
    fillRect(project, { x: 0, y: 0, width: W, height: H }, grass);
    const map = project.maps[MAP_ID];
    map.events = [
      { id: "ev_in", x: REGION.x + 1, y: REGION.y + 1, trigger: { kind: "action" }, commands: [] },
      { id: "ev_near", x: REGION.x - 1, y: REGION.y, trigger: { kind: "action" }, commands: [] },
      { id: "ev_far", x: 0, y: 0, trigger: { kind: "action" }, commands: [] },
    ];

    const surroundings = analyzeRegionSurroundings(project, MAP_ID, REGION)!;
    expect(surroundings.insideEvents.map((event) => event.id)).toEqual(["ev_in"]);
    expect(surroundings.neighborEvents.map((event) => event.id)).toEqual(["ev_near"]);
    const brief = formatRegionSurroundingsBrief(surroundings);
    expect(brief).toContain("[ev_in]");
    expect(brief).not.toContain("ev_far");
  });

  it("이벤트가 없으면 「영역 안 이벤트: 없음」을 명시한다 — 침묵은 «모른다»로 읽힌다", () => {
    const project = makeProject();
    const surroundings = analyzeRegionSurroundings(project, MAP_ID, REGION)!;
    expect(formatRegionSurroundingsBrief(surroundings)).toContain("영역 안 이벤트: 없음");
  });

  it("한 변 전체가 물이어도 브리핑 좌표 나열은 상한에서 접힌다", () => {
    const project = makeProject();
    const grass = TILE.GRASS;
    const water = TILE.WATER;
    fillRect(project, { x: 0, y: 0, width: W, height: H }, grass);
    const wide: RegionRect = { x: 2, y: 2, width: 16, height: 4 };
    fillRect(project, { x: wide.x, y: wide.y + wide.height, width: wide.width, height: 1 }, water);

    const surroundings = analyzeRegionSurroundings(project, MAP_ID, wide)!;
    expect(surroundings.crossings.length).toBeGreaterThan(6);
    const brief = formatRegionSurroundingsBrief(surroundings);
    expect(brief).toContain("…외");
    // 좌표를 전부 나열하면 브리핑 한 줄이 컨텍스트를 갉아먹는다.
    const crossingLine = brief.split("\n").find((line) => line.includes("물이 영역과 맞닿는 칸"))!;
    expect((crossingLine.match(/\(\d+,\d+\)/g) ?? []).length).toBeLessThanOrEqual(6);
  });
});
