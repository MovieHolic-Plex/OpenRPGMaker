import { describe, expect, it } from "vitest";
import { PLACEMENT_TOOLS } from "@/editor/tools/placementTools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolDefinition, ToolExecResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project, TileGroupMetadata } from "@/project/types";

const GROUP_ID = "tree_pair";
const TREE_TOP = 260;
const TREE_BOTTOM = 290;
const OVERLAY_GROUP_ID = "roof_overlay";
const ROOF_TILES = [100, 101, 102, 103] as const;
const EAVE_LEFT = 390;
const EAVE_RIGHT = 391;
const JUNCTION_GROUP_ID = "wall_junction";
const WALL_TILES = [110, 111, 112, 113, 114, 115, 116, 117, 118] as const;
const ROOF_NEIGHBOR = 119;

type PlacementData = {
  readonly placed: number;
  readonly requested: number;
  readonly skipped: number;
};

type Origin = {
  readonly x: number;
  readonly y: number;
};

type RecordValue = {
  readonly [key: string]: unknown;
};
type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function placementData(data: unknown): PlacementData {
  if (
    !isRecord(data) ||
    typeof data.placed !== "number" ||
    typeof data.requested !== "number" ||
    typeof data.skipped !== "number"
  ) {
    throw new Error("scatter_object data shape mismatch");
  }
  return { placed: data.placed, requested: data.requested, skipped: data.skipped };
}

function scatterTool(): ToolDefinition {
  const tool = PLACEMENT_TOOLS.find((entry) => entry.name === "scatter_object");
  if (!tool) throw new Error("scatter_object tool missing");
  return tool;
}

function createProject(width = 20, height = 20): { readonly project: Project; readonly map: GameMap } {
  const context = { project: createBlankProject() };
  const result = runTool(context, "create_map", { id: "map_scatter", name: "배치 테스트", width, height });
  expect(result.ok, result.summary).toBe(true);
  const map = context.project.maps.map_scatter;
  addTreeGroup(context.project, map.tilesetId);
  return { project: context.project, map };
}

function addTreeGroup(project: Project, tilesetId: string): void {
  const tileset = project.tilesets[tilesetId];
  expect(tileset).toBeDefined();
  tileset.priority[TREE_TOP] = "upper";
  tileset.priority[TREE_BOTTOM] = "upper";
  const group: TileGroupMetadata = {
    id: GROUP_ID,
    name: "테스트 나무",
    role: "prop",
    defaultLayer: "upper",
    tileIds: [TREE_TOP, TREE_BOTTOM],
    description: "1x2 나무",
    placementRules: "상단/하단을 한 세트로 배치",
    patternGrammar: {
      axis: "vertical",
      kind: "vertical_expandable",
      minHeight: 2,
      minWidth: 1,
      parts: [
        { role: "top", tileIds: [TREE_TOP] },
        { role: "bottom", tileIds: [TREE_BOTTOM] },
      ],
      preserveCaps: true,
      repeat: "body",
    },
  };
  tileset.tileGroups = [...(tileset.tileGroups ?? []).filter((entry) => entry.id !== GROUP_ID), group];
}

function addGrammarlessTreeGroup(project: Project, tilesetId: string, defaultLayer: TileGroupMetadata["defaultLayer"] = "upper"): void {
  const tileset = project.tilesets[tilesetId];
  expect(tileset).toBeDefined();
  tileset.priority[TREE_TOP] = "upper";
  tileset.priority[TREE_BOTTOM] = "upper";
  const group: TileGroupMetadata = {
    id: GROUP_ID,
    name: "문법 없는 테스트 나무",
    role: "prop",
    defaultLayer,
    tileIds: [TREE_TOP, TREE_BOTTOM],
    description: "문법 없는 1x2 나무",
    placementRules: "상단/하단을 한 세트로 배치",
  };
  tileset.tileGroups = [...(tileset.tileGroups ?? []).filter((entry) => entry.id !== GROUP_ID), group];
}

function addOverlayGroup(project: Project, tilesetId: string): void {
  const tileset = project.tilesets[tilesetId];
  expect(tileset).toBeDefined();
  for (const tile of [...ROOF_TILES, EAVE_LEFT, EAVE_RIGHT]) tileset.priority[tile] = "lower";
  const group: TileGroupMetadata = {
    id: OVERLAY_GROUP_ID,
    name: "처마 테스트 지붕",
    role: "roof",
    defaultLayer: "lower",
    tileIds: [...ROOF_TILES],
    description: "4칸 지붕",
    placementRules: "양 끝 처마를 upper overlay로 올린다",
    overlays: [{ tileIds: [EAVE_LEFT, EAVE_RIGHT], when: "eaveEnd" }],
  };
  tileset.tileGroups = [...(tileset.tileGroups ?? []).filter((entry) => entry.id !== OVERLAY_GROUP_ID), group];
}

function addJunctionGroup(project: Project, tilesetId: string): void {
  const tileset = project.tilesets[tilesetId];
  expect(tileset).toBeDefined();
  for (const tile of [...WALL_TILES, ROOF_NEIGHBOR]) tileset.priority[tile] = "lower";
  const roof: TileGroupMetadata = {
    id: "roof_neighbor",
    name: "인접 지붕",
    role: "roof",
    defaultLayer: "lower",
    tileIds: [ROOF_NEIGHBOR],
    description: "junction 조건용 지붕",
    placementRules: "벽 아래 인접 조건 제공",
  };
  const wall: TileGroupMetadata = {
    id: JUNCTION_GROUP_ID,
    name: "처마 생략 벽",
    role: "wall",
    defaultLayer: "lower",
    tileIds: [...WALL_TILES],
    description: "3x3 벽",
    placementRules: "아래에 지붕이 닿으면 하단 처마를 생략",
    patternGrammar: wallGrammar(),
    junctions: [{ action: "omit", atRoles: ["bottomLeft", "bottom", "bottomRight"], side: "below", withRole: "roof" }],
  };
  tileset.tileGroups = [...(tileset.tileGroups ?? []).filter((entry) => entry.id !== roof.id && entry.id !== wall.id), roof, wall];
}

function runScatter(project: Project, args: Record<string, unknown>): ToolExecResult {
  return scatterTool().run(project, args);
}

function treeOrigins(map: GameMap): readonly Origin[] {
  const origins: Origin[] = [];
  for (let y = 0; y < map.height - 1; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (map.upperTiles[y * map.width + x] === TREE_TOP && map.upperTiles[(y + 1) * map.width + x] === TREE_BOTTOM) {
        origins.push({ x, y });
      }
    }
  }
  return origins;
}

function horizontalTreePairs(map: GameMap): readonly Origin[] {
  const origins: Origin[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width - 1; x += 1) {
      if (map.upperTiles[y * map.width + x] === TREE_TOP && map.upperTiles[y * map.width + x + 1] === TREE_BOTTOM) {
        origins.push({ x, y });
      }
    }
  }
  return origins;
}

function roofOrigins(map: GameMap): readonly Origin[] {
  const origins: Origin[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x <= map.width - ROOF_TILES.length; x += 1) {
      if (ROOF_TILES.every((tile, offset) => map.lowerTiles[y * map.width + x + offset] === tile)) origins.push({ x, y });
    }
  }
  return origins;
}

function gapBetweenTrees(a: Origin, b: Origin): number {
  const ax1 = a.x;
  const ax2 = a.x + 1;
  const ay1 = a.y;
  const ay2 = a.y + 2;
  const bx1 = b.x;
  const bx2 = b.x + 1;
  const by1 = b.y;
  const by2 = b.y + 2;
  return Math.max(Math.max(bx1 - ax2, ax1 - bx2, 0), Math.max(by1 - ay2, ay1 - by2, 0));
}

function expectNoProtectedCellCovered(map: GameMap, protectedCells: readonly Origin[]): void {
  for (const cell of protectedCells) {
    expect(map.upperTiles[cell.y * map.width + cell.x]).not.toBe(TREE_TOP);
    expect(map.upperTiles[cell.y * map.width + cell.x]).not.toBe(TREE_BOTTOM);
  }
}

function event(id: string, x: number, y: number): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [] };
}

function part(role: PatternGrammar["parts"][number]["role"], tile: number): PatternGrammar["parts"][number] {
  return { role, tileIds: [tile] };
}

function wallGrammar(): PatternGrammar {
  return {
    axis: "both",
    kind: "nine_slice_expandable",
    minHeight: 3,
    minWidth: 3,
    parts: [
      part("topLeft", WALL_TILES[0]),
      part("top", WALL_TILES[1]),
      part("topRight", WALL_TILES[2]),
      part("left", WALL_TILES[3]),
      part("center", WALL_TILES[4]),
      part("right", WALL_TILES[5]),
      part("bottomLeft", WALL_TILES[6]),
      part("bottom", WALL_TILES[7]),
      part("bottomRight", WALL_TILES[8]),
    ],
    preserveCaps: true,
    repeat: "center",
  };
}

describe("scatter_object", () => {
  it("preferSoftRules와 applyStructure 옵션을 스키마에 노출한다", () => {
    const props = scatterTool().parameters.properties ?? {};

    expect(props.preferSoftRules).toMatchObject({ type: "boolean", description: "soft/medium 규칙 만족을 우선(기본 true)" });
    expect(props.applyStructure).toMatchObject({ type: "boolean", description: "overlay/처마 생략 등 구조 규칙 자동 적용(기본 true)" });
  });

  it("빈 영역에 요청 개수만큼 원자적으로 배치하고 최소 간격을 지킨다", () => {
    const { project, map } = createProject();

    const result = runScatter(project, {
      mapId: map.id,
      groupId: GROUP_ID,
      area: { x: 1, y: 1, w: 16, h: 16 },
      count: 8,
      minGap: 1,
      maxGap: 3,
    });

    const data = placementData(result.data);
    expect(data).toEqual({ placed: 8, requested: 8, skipped: 0 });
    const origins = treeOrigins(map);
    expect(origins).toHaveLength(8);
    for (const origin of origins) {
      expect(map.upperTiles[origin.y * map.width + origin.x]).toBe(TREE_TOP);
      expect(map.upperTiles[(origin.y + 1) * map.width + origin.x]).toBe(TREE_BOTTOM);
    }
    for (let i = 0; i < origins.length; i += 1) {
      for (let j = i + 1; j < origins.length; j += 1) {
        expect(gapBetweenTrees(origins[i], origins[j])).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("문법 없는 2타일 prop 그룹은 가로가 아니라 위/아래 세로 한 쌍으로 배치한다", () => {
    const { project, map } = createProject(8, 8);
    addGrammarlessTreeGroup(project, map.tilesetId);

    const result = runScatter(project, {
      mapId: map.id,
      groupId: GROUP_ID,
      area: { x: 2, y: 1, w: 1, h: 2 },
      count: 1,
      minGap: 0,
      maxGap: 0,
    });

    expect(placementData(result.data)).toEqual({ placed: 1, requested: 1, skipped: 0 });
    expect(treeOrigins(map)).toEqual([{ x: 2, y: 1 }]);
    expect(horizontalTreePairs(map)).toHaveLength(0);
  });

  it("defaultLayer:lower prop 그룹도 잔디 바탕으로 여러 그루가 한 스탬프에 묶이지 않는다", () => {
    const { project, map } = createProject(12, 8);
    addGrammarlessTreeGroup(project, map.tilesetId, "lower");

    const result = runScatter(project, {
      mapId: map.id,
      groupId: GROUP_ID,
      area: { x: 1, y: 1, w: 8, h: 5 },
      count: 3,
      minGap: 0,
      maxGap: 4,
    });

    expect(placementData(result.data)).toEqual({ placed: 3, requested: 3, skipped: 0 });
    expect(treeOrigins(map)).toHaveLength(3);
  });

  it("투명 상위 prop 뒤의 빈 lower에는 잔디를 깔고 기존 lower는 보존한다", () => {
    const emptyLower = createProject(8, 8);
    addGrammarlessTreeGroup(emptyLower.project, emptyLower.map.tilesetId);
    emptyLower.map.lowerTiles.fill(TILE.EMPTY);

    runScatter(emptyLower.project, {
      mapId: emptyLower.map.id,
      groupId: GROUP_ID,
      area: { x: 2, y: 1, w: 1, h: 2 },
      count: 1,
      minGap: 0,
      maxGap: 0,
    });

    expect(emptyLower.map.lowerTiles[1 * emptyLower.map.width + 2]).toBe(TILE.GRASS);
    expect(emptyLower.map.lowerTiles[2 * emptyLower.map.width + 2]).toBe(TILE.GRASS);

    const preservedLower = createProject(8, 8);
    addGrammarlessTreeGroup(preservedLower.project, preservedLower.map.tilesetId);
    preservedLower.map.lowerTiles.fill(TILE.EMPTY);
    preservedLower.map.lowerTiles[2 * preservedLower.map.width + 2] = TILE.WATER;

    runScatter(preservedLower.project, {
      mapId: preservedLower.map.id,
      groupId: GROUP_ID,
      area: { x: 2, y: 1, w: 1, h: 2 },
      count: 1,
      minGap: 0,
      maxGap: 0,
    });

    expect(preservedLower.map.lowerTiles[1 * preservedLower.map.width + 2]).toBe(TILE.GRASS);
    expect(preservedLower.map.lowerTiles[2 * preservedLower.map.width + 2]).toBe(TILE.WATER);
  });

  it("시작칸, 이벤트칸, transfer 목적지를 보호하고 부족 수량을 반환한다", () => {
    const { project, map } = createProject(10, 10);
    project.startMapId = map.id;
    project.startPos = { x: 4, y: 2 };
    map.events.push(event("ev_guard", 4, 5), {
      id: "ev_transfer_source",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [{ kind: "transfer", mapId: map.id, x: 4, y: 8 }],
    });

    const result = runScatter(project, {
      mapId: map.id,
      groupId: GROUP_ID,
      area: { x: 4, y: 1, w: 1, h: 9 },
      count: 3,
      minGap: 1,
      maxGap: 3,
    });

    const data = placementData(result.data);
    expect(data.placed).toBeLessThan(data.requested);
    expect(data.skipped).toBe(data.requested - data.placed);
    expect(result.summary).toContain("건너뜀");
    expectNoProtectedCellCovered(map, [
      { x: 4, y: 2 },
      { x: 4, y: 5 },
      { x: 4, y: 8 },
    ]);
  });

  it("영역이 포화되면 가능한 만큼만 배치하고 조용히 성공하지 않는다", () => {
    const { project, map } = createProject(8, 8);

    const result = runScatter(project, {
      mapId: map.id,
      groupId: GROUP_ID,
      area: { x: 2, y: 1, w: 1, h: 5 },
      count: 3,
      minGap: 1,
      maxGap: 3,
    });

    const data = placementData(result.data);
    expect(data).toEqual({ placed: 2, requested: 3, skipped: 1 });
    expect(result.summary).toContain("건너뜀");
    expect(treeOrigins(map)).toHaveLength(2);
  });

  it("같은 입력은 같은 위치 결과를 만든다", () => {
    const first = createProject();
    const second = createProject();
    const args = {
      mapId: "map_scatter",
      groupId: GROUP_ID,
      area: { x: 1, y: 1, w: 16, h: 16 },
      count: 6,
      minGap: 1,
      maxGap: 3,
    };

    runScatter(first.project, args);
    runScatter(second.project, args);

    expect(treeOrigins(first.map)).toEqual(treeOrigins(second.map));
  });

  it("soft/medium 규칙이 없으면 기본 선호와 preferSoftRules:false 경로가 각각 결정적이고 동일하다", () => {
    const defaultFirst = createProject();
    const defaultSecond = createProject();
    const legacyFirst = createProject();
    const legacySecond = createProject();
    const args = {
      mapId: "map_scatter",
      groupId: GROUP_ID,
      area: { x: 1, y: 1, w: 16, h: 16 },
      count: 6,
      minGap: 1,
      maxGap: 3,
    };

    runScatter(defaultFirst.project, args);
    runScatter(defaultSecond.project, args);
    runScatter(legacyFirst.project, { ...args, preferSoftRules: false });
    runScatter(legacySecond.project, { ...args, preferSoftRules: false });

    expect(treeOrigins(defaultFirst.map)).toEqual(treeOrigins(defaultSecond.map));
    expect(treeOrigins(legacyFirst.map)).toEqual(treeOrigins(legacySecond.map));
    expect(treeOrigins(defaultFirst.map)).toEqual(treeOrigins(legacyFirst.map));
  });

  it("overlay 구조 규칙을 base paint 뒤에 upper 레이어로 적용한다", () => {
    const { project, map } = createProject(14, 8);
    addOverlayGroup(project, map.tilesetId);

    const result = runScatter(project, {
      mapId: map.id,
      groupId: OVERLAY_GROUP_ID,
      area: { x: 1, y: 1, w: 10, h: 4 },
      count: 2,
      minGap: 0,
      maxGap: 4,
    });

    expect(placementData(result.data).placed).toBe(2);
    const origins = roofOrigins(map);
    expect(origins).toHaveLength(2);
    for (const origin of origins) {
      expect(map.upperTiles[origin.y * map.width + origin.x]).toBe(EAVE_LEFT);
      expect(map.upperTiles[origin.y * map.width + origin.x + ROOF_TILES.length - 1]).toBe(EAVE_RIGHT);
    }
  });

  it("applyStructure:false이면 overlay 구조 규칙을 base paint에 섞지 않는다", () => {
    const { project, map } = createProject(8, 6);
    addOverlayGroup(project, map.tilesetId);

    runScatter(project, {
      mapId: map.id,
      groupId: OVERLAY_GROUP_ID,
      area: { x: 1, y: 1, w: 4, h: 1 },
      count: 1,
      minGap: 0,
      maxGap: 0,
      applyStructure: false,
    });

    expect(map.upperTiles[1 * map.width + 1]).toBe(TILE.EMPTY);
    expect(map.upperTiles[1 * map.width + 1 + ROOF_TILES.length - 1]).toBe(TILE.EMPTY);
  });

  it("junction omit 구조 규칙을 실제 인접 타일 기준 edit로 반영한다", () => {
    const { project, map } = createProject(8, 8);
    addJunctionGroup(project, map.tilesetId);
    for (let x = 2; x <= 4; x += 1) map.lowerTiles[5 * map.width + x] = ROOF_NEIGHBOR;

    runScatter(project, {
      mapId: map.id,
      groupId: JUNCTION_GROUP_ID,
      area: { x: 2, y: 2, w: 3, h: 3 },
      count: 1,
      minGap: 0,
      maxGap: 0,
    });

    expect(map.lowerTiles[2 * map.width + 2]).toBe(WALL_TILES[0]);
    for (let x = 2; x <= 4; x += 1) expect(map.lowerTiles[4 * map.width + x]).toBe(TILE.EMPTY);
  });
});
