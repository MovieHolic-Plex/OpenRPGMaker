// test/constructionToolsV3.test.ts
// 공정 프리미티브 6종 계약 테스트 (타일 툴 v3 — V3B).
// 고정하는 계약: (1) 존재하는 어휘는 soft-confirm 시공, 없는 id만 hard fail (2) layer 인자 없음 —
// 어휘 layerHome이 결정 (3) 벽 없이 지붕 거부 / 문·창은 벽 셀에만 (4) lay_path는 8-이웃
// variantMap 필수 (5) v2 배치 4종 deprecated(LLM 비노출, 실행 호환) (6) DEFAULT_MODEL 전환.

import { describe, expect, it } from "vitest";
import { getTool, runTool, toOpenAiTools, type ToolContext } from "@/editor/tools";
import { REMOVED_V2_PLACE_TOOLS } from "@/editor/tools/v2";
import { buildEightNeighborVariantMap } from "@/editor/tools/v3/rmTypeExpander";
import { DEFAULT_MODEL } from "@/ai/llmClient";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE, isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

const MAP_ID = "map_blank_start";
const WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`;
const WATER_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}lake-water-autotile`;

function context(): { ctx: ToolContext; tileset: () => TilesetDef } {
  const ctx: ToolContext = { project: createBlankProject() };
  return { ctx, tileset: () => ctx.project.tilesets[DEFAULT_TILESET_ID] };
}

function approve(tileset: TilesetDef, groupId: string): TileGroupMetadata {
  const group = tileset.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) throw new Error(`그룹 없음: ${groupId}`);
  group.origin = "user"; // 사용자 명시 수락과 동일한 표식(테스트 픽스처).
  return group;
}

// 번들 하네스 그룹은 source:"bundled-default"로 시드 승인된다(2026-07-11). soft-confirm
// 경로 자체를 검증하는 케이스는 이 헬퍼로 번들 신뢰를 제거해 미승인 상태로 되돌린다.
function forceUnapproved(tileset: TilesetDef, groupId: string): TileGroupMetadata {
  const group = tileset.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) throw new Error(`그룹 없음: ${groupId}`);
  group.origin = undefined;
  group.source = undefined;
  return group;
}

function addApprovedRoof(tileset: TilesetDef): TileGroupMetadata {
  const roof: TileGroupMetadata = {
    id: "test-roof", name: "빨간 지붕", role: "roof", defaultLayer: "upper", layerHome: "upper",
    tileIds: [60, 61, 62], description: "", placementRules: "", origin: "user",
    patternGrammar: {
      kind: "horizontal_expandable", minWidth: 2, preserveCaps: true, repeat: "body",
      parts: [{ role: "leftCap", tileIds: [60] }, { role: "repeatBody", tileIds: [61] }, { role: "rightCap", tileIds: [62] }],
    },
  };
  tileset.tileGroups!.push(roof);
  return roof;
}

describe("build_wall / build_roof (공정 1·3단계)", () => {
  it("미합의 벽 어휘는 soft-confirm으로 시공되고 vocabSoftConfirm 을 붙인다", () => {
    const { ctx, tileset } = context();
    forceUnapproved(tileset(), WALL_GROUP_ID);
    const result = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, wallVocabId: WALL_GROUP_ID });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ groupId: WALL_GROUP_ID, cells: 16 });
    const soft = (result.data as { vocabSoftConfirm?: { name?: string } }).vocabSoftConfirm;
    expect(soft?.name).toBeTruthy();
    expect(result.diff?.warnings.join(" ") ?? "").toMatch(/목업 확인 대기 재료/);
  });

  it("승인된 9분할 벽을 rect에 시공하고(lower 홈) data.wallRegion을 반환한다", () => {
    const { ctx, tileset } = context();
    const group = approve(tileset(), WALL_GROUP_ID);
    const result = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, wallVocabId: WALL_GROUP_ID });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ wallRegion: { x: 2, y: 5, w: 4, h: 4 }, cells: 16, groupId: WALL_GROUP_ID });
    const map = ctx.project.maps[MAP_ID];
    const topLeft = group.patternGrammar!.parts.find((part) => part.role === "topLeft")!.tileIds[0];
    expect(map.lowerTiles[5 * map.width + 2]).toBe(topLeft); // 벽 어휘 홈 = lower
  });

  it("벽 없이 build_roof는 거부되고('먼저 build_wall'), 벽을 지으면 자동 감지로 벽 위에 얹는다", () => {
    const { ctx, tileset } = context();
    addApprovedRoof(tileset());
    const rejected = runTool(ctx, "build_roof", { mapId: MAP_ID, roofVocabId: "test-roof" });
    expect(rejected.ok).toBe(false);
    expect(`${rejected.summary} ${JSON.stringify(rejected.issues ?? [])}`).toContain("먼저 build_wall");

    approve(tileset(), WALL_GROUP_ID);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 4, y: 6, w: 5, h: 3 }, wallVocabId: WALL_GROUP_ID }).ok).toBe(true);
    const roofed = runTool(ctx, "build_roof", { mapId: MAP_ID, roofVocabId: "test-roof" });
    expect(roofed.ok, roofed.summary).toBe(true);
    expect(roofed.data).toMatchObject({ wallRegion: { x: 4, y: 6, w: 5, h: 3 }, roofRegion: { x: 4, y: 5, w: 5, h: 1 } });
    const map = ctx.project.maps[MAP_ID];
    expect(map.upperTiles[5 * map.width + 4]).toBe(60); // 지붕 홈 = upper(벽 보존)
  });
});

describe("place_door / place_window (공정 2단계 — 벽 셀에만)", () => {
  it("벽 셀이 아니면 거부하고, 벽 셀에는 어휘 layerHome대로 설치한다", () => {
    const { ctx, tileset } = context();
    approve(tileset(), WALL_GROUP_ID);
    const door: TileGroupMetadata = {
      id: "test-door", name: "나무문", role: "prop", defaultLayer: "lower", layerHome: "lower",
      tileIds: [30, 31], description: "", placementRules: "", origin: "user",
      patternGrammar: {
        kind: "vertical_expandable", minHeight: 2, preserveCaps: true, repeat: "body",
        parts: [{ role: "top", tileIds: [30] }, { role: "bottom", tileIds: [31] }],
      },
    };
    tileset().tileGroups!.push(door);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, wallVocabId: WALL_GROUP_ID }).ok).toBe(true);

    const offWall = runTool(ctx, "place_door", { mapId: MAP_ID, at: { x: 0, y: 0 }, doorVocabId: "test-door" });
    expect(offWall.ok).toBe(false);
    expect(`${offWall.summary} ${JSON.stringify(offWall.issues ?? [])}`).toContain("벽 셀");

    const onWall = runTool(ctx, "place_door", { mapId: MAP_ID, at: { x: 3, y: 8 }, doorVocabId: "test-door" });
    expect(onWall.ok, onWall.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID];
    expect(map.lowerTiles[8 * map.width + 3]).toBe(31); // 문 하단(1×2 세로 규약)
    expect(map.lowerTiles[7 * map.width + 3]).toBe(30); // 문 상단
  });
});

describe("lay_path / place_props (공정 4·5단계)", () => {
  function addApprovedPath(tileset: TilesetDef, withAutotile: boolean): void {
    const memberTileIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    tileset.tileGroups!.push({
      id: "test-path", name: "흙길", role: "terrain", defaultLayer: "lower",
      tileIds: memberTileIds, description: "", placementRules: "", origin: "user",
    });
    if (withAutotile) {
      tileset.autotileGroups = [{
        id: "test-path-8", name: "흙길8", neighborhood: 8, memberTileIds,
        variantMap: buildEightNeighborVariantMap(
          { body: 1, edgeN: 2, edgeS: 3, edgeW: 4, edgeE: 5, cornerNW: 6, cornerNE: 7, cornerSW: 8, cornerSE: 9 },
          { innerNW: 10, innerNE: 11, innerSW: 12, innerSE: 13 }
        ),
      }];
    }
  }

  it("8-이웃 variantMap 오토타일 정의가 없으면 거부한다(승인 시 오토타일 정의 필요)", () => {
    const { ctx, tileset } = context();
    addApprovedPath(tileset(), false);
    const result = runTool(ctx, "lay_path", { mapId: MAP_ID, points: [{ x: 1, y: 12 }, { x: 10, y: 12 }], pathVocabId: "test-path" });
    expect(result.ok).toBe(false);
    expect(`${result.summary} ${JSON.stringify(result.issues ?? [])}`).toContain("8-이웃 variantMap");
  });

  it("승인 어휘 + 8-이웃 variantMap이면 결정론(seed)으로 길을 깔고 외곽/inner corner를 재계산한다", () => {
    const { ctx, tileset } = context();
    addApprovedPath(tileset(), true);
    const args = { mapId: MAP_ID, points: [{ x: 1, y: 12 }, { x: 10, y: 12 }], pathVocabId: "test-path", naturalness: 0, seed: 7 };
    const result = runTool(ctx, "lay_path", args);
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { pathCells: number; reshaped: number };
    expect(data.pathCells).toBeGreaterThanOrEqual(10);
    expect(data.reshaped).toBeGreaterThan(0);
    const map = ctx.project.maps[MAP_ID];
    const members = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(members.has(map.lowerTiles[12 * map.width + 5])).toBe(true);
    // 같은 입력/시드 = 같은 결과(결정론).
    const { ctx: ctx2, tileset: tileset2 } = context();
    addApprovedPath(tileset2(), true);
    expect(runTool(ctx2, "lay_path", args).ok).toBe(true);
    expect(ctx2.project.maps[MAP_ID].lowerTiles).toEqual(map.lowerTiles);
  });

  it("place_props: 미합의 소품도 soft-confirm으로 배치되고, 승인 그룹도 동일 엔진으로 배치된다", () => {
    const { ctx, tileset } = context();
    const treeId = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;
    forceUnapproved(tileset(), treeId);
    const soft = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 1, y: 1, w: 16, h: 10 }, propVocabId: treeId, count: 4, seed: 3 });
    expect(soft.ok, soft.summary).toBe(true);
    expect((soft.data as { vocabSoftConfirm?: { groupId?: string } }).vocabSoftConfirm?.groupId).toBe(treeId);
    const softPlaced = (soft.data as { placed?: number } | undefined)?.placed ?? 0;
    expect(softPlaced).toBeGreaterThan(0);

    approve(tileset(), treeId);
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 1, y: 1, w: 16, h: 10 }, propVocabId: treeId, count: 4, seed: 3 });
    expect(result.ok, result.summary).toBe(true);
    const placed = (result.data as { placed?: number } | undefined)?.placed ?? 0;
    expect(placed).toBeGreaterThan(0);
    expect((result.data as { vocabSoftConfirm?: unknown }).vocabSoftConfirm).toBeUndefined();
  });

  it("place_props: 존재하지 않는 그룹 id는 하드 실패한다", () => {
    const { ctx } = context();
    const missing = runTool(ctx, "place_props", {
      mapId: MAP_ID,
      area: { x: 1, y: 1, w: 8, h: 8 },
      propVocabId: "no-such-tree-group",
      count: 1,
    });
    expect(missing.ok).toBe(false);
  });
});

describe("fill_region / tile_erase (면 채우기·부분 보호)", () => {
  it("fill_region: 10×8 rect를 물 오토타일로 채우면 80칸 전부 물이고 통행 불가, 경계 quarter가 정합된다", () => {
    const { ctx, tileset } = context();
    ctx.project.startPos = { x: 0, y: 0 };
    approve(tileset(), WATER_GROUP_ID);
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 10, h: 8 }, tileVocabId: WATER_GROUP_ID });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ filled: 80, requested: 80, groupId: WATER_GROUP_ID, layer: "lower" });
    const map = ctx.project.maps[MAP_ID];
    for (let y = 4; y < 12; y += 1) {
      for (let x = 5; x < 15; x += 1) {
        const tile = map.lowerTiles[y * map.width + x];
        expect(isLakeAutotileTile(tile), `${x},${y}`).toBe(true);
        expect(isPassable(ctx.project, map, x, y), `${x},${y}`).toBe(false);
      }
    }
    expect(lakeAutotileQuarterSources(map, 5, 4).map((part) => part.tile)).toEqual([
      LAKE_AUTOTILE_TILE.OUTER_CORNER,
      LAKE_AUTOTILE_TILE.EDGE_NORTH,
      LAKE_AUTOTILE_TILE.EDGE_WEST,
      LAKE_AUTOTILE_TILE.BODY,
    ]);
  });

  it("fill_region shape=circle: 9×9 박스 안 원만 채우고 모서리는 비운다(원형 호수)", () => {
    const { ctx, tileset } = context();
    ctx.project.startPos = { x: 0, y: 0 };
    approve(tileset(), WATER_GROUP_ID);
    const rect = { x: 5, y: 5, w: 9, h: 9 };
    const result = runTool(ctx, "fill_region", {
      mapId: MAP_ID,
      rect,
      tileVocabId: WATER_GROUP_ID,
      shape: "circle",
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ shape: "circle", bboxCells: 81 });
    const filled = Number((result.data as { filled?: number }).filled ?? 0);
    expect(filled).toBeGreaterThan(40);
    expect(filled).toBeLessThan(81); // 원형은 네모보다 적게
    const map = ctx.project.maps[MAP_ID];
    // 네 모서리는 원 밖
    for (const [x, y] of [
      [5, 5],
      [13, 5],
      [5, 13],
      [13, 13],
    ] as const) {
      expect(isLakeAutotileTile(map.lowerTiles[y * map.width + x]), `corner ${x},${y}`).toBe(false);
    }
    // 중심은 원 안
    expect(isLakeAutotileTile(map.lowerTiles[9 * map.width + 9])).toBe(true);
  });

  it("place_props: 물 위에는 나무를 올리지 않는다", () => {
    const { ctx, tileset } = context();
    ctx.project.startPos = { x: 0, y: 0 };
    approve(tileset(), WATER_GROUP_ID);
    const treeId = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;
    approve(tileset(), treeId);
    // 중앙 넓은 호수
    const fill = runTool(ctx, "fill_region", {
      mapId: MAP_ID,
      rect: { x: 4, y: 4, w: 12, h: 10 },
      tileVocabId: WATER_GROUP_ID,
      shape: "rect",
    });
    expect(fill.ok, fill.summary).toBe(true);
    const props = runTool(ctx, "place_props", {
      mapId: MAP_ID,
      area: { x: 4, y: 4, w: 12, h: 10 },
      propVocabId: treeId,
      count: 20,
      seed: 1,
    });
    expect(props.ok, props.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID];
    // 물 칸 위 upper 에 소품이 있으면 안 됨
    let treesOnWater = 0;
    for (let y = 4; y < 14; y += 1) {
      for (let x = 4; x < 16; x += 1) {
        const i = y * map.width + x;
        if (isLakeAutotileTile(map.lowerTiles[i]) && map.upperTiles[i] !== TILE.EMPTY) treesOnWater += 1;
      }
    }
    expect(treesOnWater).toBe(0);
    // 호수 안 전부에 강제 산포하면 0개일 수 있음 — 그게 올바른 동작
    expect((props.data as { placed?: number }).placed ?? 0).toBe(0);
  });

  it("fill_region: transfer 목적지가 통행 불가가 될 때 해당 칸만 제외하고 warning으로 통과한다", () => {
    const { ctx, tileset } = context();
    ctx.project.startPos = { x: 0, y: 0 };
    approve(tileset(), WATER_GROUP_ID);
    const map = ctx.project.maps[MAP_ID];
    map.events.push({
      id: "ev_transfer_source",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [{ kind: "transfer", mapId: MAP_ID, x: 7, y: 7 }],
    });

    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 5, w: 5, h: 5 }, tileVocabId: WATER_GROUP_ID });
    const after = ctx.project.maps[MAP_ID];
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings).toContain("(7,7)은 transfer 목적지라 제외했습니다");
    expect(result.data).toMatchObject({ filled: 24, requested: 25 });
    expect(isLakeAutotileTile(after.lowerTiles[5 * after.width + 5])).toBe(true);
    expect(isLakeAutotileTile(after.lowerTiles[7 * after.width + 7])).toBe(false);
    expect(isPassable(ctx.project, after, 7, 7)).toBe(true);
  });

  it("tile_erase: transfer 목적지 통행을 막는 셀만 제외하고 나머지는 지운다", () => {
    const { ctx } = context();
    ctx.project.startPos = { x: 0, y: 0 };
    const map = ctx.project.maps[MAP_ID];
    map.events.push({
      id: "ev_transfer_source",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [{ kind: "transfer", mapId: MAP_ID, x: 7, y: 7 }],
    });
    for (let y = 6; y < 9; y += 1) {
      for (let x = 6; x < 9; x += 1) map.lowerTiles[y * map.width + x] = TILE.GRASS;
    }

    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 6, y: 6, w: 3, h: 3 }, layer: "lower" });
    const after = ctx.project.maps[MAP_ID];
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings).toContain("(7,7)은 transfer 목적지라 제외했습니다");
    expect(result.data).toMatchObject({ cleared: 8, requested: 9, skipped: 1 });
    expect(after.lowerTiles[6 * after.width + 6]).toBe(TILE.EMPTY);
    expect(after.lowerTiles[7 * after.width + 7]).toBe(TILE.GRASS);
    expect(isPassable(ctx.project, after, 7, 7)).toBe(true);
  });
});

describe("구 v2 배치 제거 + v3 정공법 (스택 단순화)", () => {
  it("구 v2 배치 이름은 레지스트리에서 제거되고 v3 공정 툴은 노출된다", () => {
    const exposed = new Set(toOpenAiTools().map((tool) => tool.function.name));
    for (const [v2Name, next] of REMOVED_V2_PLACE_TOOLS) {
      expect(getTool(v2Name), v2Name).toBeUndefined();
      expect(exposed.has(v2Name), v2Name).toBe(false);
      expect(getTool(next), `${v2Name}→${next}`).toBeDefined();
    }
    for (const name of ["build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props", "fill_region", "tile_erase"]) {
      expect(exposed.has(name), name).toBe(true);
      expect(getTool(name)?.version, name).toBe(3);
    }
  });

  it("DEFAULT_MODEL은 minimax/minimax-m3다 (v3 설계 축 7)", () => {
    expect(DEFAULT_MODEL).toBe("minimax/minimax-m3");
  });
});
