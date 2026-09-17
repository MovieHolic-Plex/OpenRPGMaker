// test/constructionToolsV3.test.ts
// 공정 프리미티브 6종 계약 테스트 (타일 툴 v3 — V3B).
// 고정하는 계약: (1) 존재하는 어휘는 soft-confirm 시공, 없는 id만 hard fail (2) layer 인자 없음 —
// 어휘 layerHome이 결정 (3) 벽 없이 지붕 거부 / 문·창은 벽 셀에만 (4) lay_path는 8-이웃
// variantMap 필수 (5) v2 배치 4종 deprecated(LLM 비노출, 실행 호환) (6) DEFAULT_MODEL 전환.

import { describe, expect, it } from "vitest";
import { getTool, runTool, toOpenAiTools, type ToolContext } from "@/editor/tools";
import { REMOVED_V2_PLACE_TOOLS } from "@/editor/tools/v2";
import { buildEightNeighborVariantMap } from "@/editor/tools/v3/rmTypeExpander";
import { DEFAULT_LITE_MODEL, DEFAULT_MODEL } from "@/ai/llmClient";
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
    tileIds: [60, 61, 62], description: "빨간 지붕 재료", placementRules: "", origin: "user",
    patternGrammar: {
      kind: "horizontal_expandable", minWidth: 2, preserveCaps: true, repeat: "body",
      parts: [{ role: "leftCap", tileIds: [60] }, { role: "repeatBody", tileIds: [61] }, { role: "rightCap", tileIds: [62] }],
    },
  };
  tileset.tileGroups!.push(roof);
  tileset.tileMeta ??= [];
  for (const tile of [60, 61, 62]) {
    tileset.tileMeta[tile] = {
      ...(tileset.tileMeta[tile] ?? {}),
      label: "빨간 지붕",
      description: "빨간 지붕 재료",
      role: "roof",
      origin: "user",
      source: "user",
    };
  }
  return roof;
}

describe("build_wall / build_roof (공정 1·3단계)", () => {
  it("미합의 벽 어휘는 soft-confirm으로 시공되고 vocabSoftConfirm 을 붙인다", () => {
    const { ctx, tileset } = context();
    forceUnapproved(tileset(), WALL_GROUP_ID);
    const result = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, material: "흰 집 벽" });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ groupId: WALL_GROUP_ID, cells: 16 });
    const soft = (result.data as { vocabSoftConfirm?: { name?: string } }).vocabSoftConfirm;
    expect(soft?.name).toBeTruthy();
    expect(result.diff?.warnings.join(" ") ?? "").toMatch(/목업 확인 대기 재료/);
  });

  it("승인된 9분할 벽을 rect에 시공하고(lower 홈) data.wallRegion을 반환한다", () => {
    const { ctx, tileset } = context();
    const group = approve(tileset(), WALL_GROUP_ID);
    const result = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, material: "흰 집 벽" });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ wallRegion: { x: 2, y: 5, w: 4, h: 4 }, cells: 16, groupId: WALL_GROUP_ID });
    const map = ctx.project.maps[MAP_ID];
    const topLeft = group.patternGrammar!.parts.find((part) => part.role === "topLeft")!.tileIds[0];
    expect(map.lowerTiles[5 * map.width + 2]).toBe(topLeft); // 벽 어휘 홈 = lower
  });

  it("벽 없이 build_roof는 거부되고('먼저 build_wall'), 벽을 지으면 자동 감지로 벽 위에 얹는다", () => {
    const { ctx, tileset } = context();
    addApprovedRoof(tileset());
    const rejected = runTool(ctx, "build_roof", { mapId: MAP_ID, material: "빨간 지붕" });
    expect(rejected.ok).toBe(false);
    expect(`${rejected.summary} ${JSON.stringify(rejected.issues ?? [])}`).toContain("먼저 build_wall");

    approve(tileset(), WALL_GROUP_ID);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 4, y: 6, w: 5, h: 3 }, material: "흰 집 벽" }).ok).toBe(true);
    const roofed = runTool(ctx, "build_roof", { mapId: MAP_ID, material: "빨간 지붕" });
    expect(roofed.ok, roofed.summary).toBe(true);
    expect(roofed.data).toMatchObject({ wallRegion: { x: 4, y: 6, w: 5, h: 3 }, roofRegion: { x: 4, y: 5, w: 5, h: 1 } });
    const map = ctx.project.maps[MAP_ID];
    expect(map.upperTiles[5 * map.width + 4]).toBe(60); // 지붕 홈 = upper(벽 보존)
  });
});

describe("incremental primitives versus recorded completed houses", () => {
  it.each([
    { name: "build_wall", args: { rect: { x: 4, y: 6, w: 5, h: 3 }, material: "돌벽" } },
    { name: "build_roof", args: { material: "빨간 지붕" } },
    { name: "place_door", args: { at: { x: 5, y: 8 }, material: "문/입구" } },
    { name: "place_window", args: { at: { x: 6, y: 7 }, material: "창문" } },
  ])("$name remains incremental without metadata and rejects the same recorded-house write", ({ name, args }) => {
    const { ctx, tileset } = context();
    approve(tileset(), WALL_GROUP_ID);
    addApprovedRoof(tileset());
    const wall = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 4, y: 6, w: 5, h: 3 }, material: "흰 집 벽" });
    expect(wall.ok, JSON.stringify(wall.issues)).toBe(true);
    const unfinished = structuredClone(ctx.project);
    const incremental = runTool(ctx, name, { mapId: MAP_ID, ...args });
    expect(incremental.ok, JSON.stringify(incremental.issues)).toBe(true);
    expect(incremental.diff?.tilesChanged).toBeGreaterThan(0);
    ctx.project = unfinished;
    const map = ctx.project.maps[MAP_ID];
    map.layoutPlan = { version: 1, kind: "completed", regions: [
      { id: "complete", role: "house", label: "Complete", x: 4, y: 5, w: 5, h: 4 },
    ] };
    const before = structuredClone(ctx.project);
    const recorded = runTool(ctx, name, { mapId: MAP_ID, ...args });
    expect(recorded.issues?.[0]?.code).toBe("protected-house-write");
    expect(ctx.project).toEqual(before);
  });
});

describe("missing 어휘 실패 시 유사 그룹 후보 제시", () => {
  it("build_wall을 존재하지 않는 material로 호출하면 비슷한 라벨 후보를 에러 메시지에 담는다", () => {
    const { ctx } = context();
    const result = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, material: "없는벽재료xyz999" });
    expect(result.ok).toBe(false);
    const message = `${result.summary} ${JSON.stringify(result.issues ?? [])}`;
    expect(message).toMatch(/비슷한 라벨|비슷한 그룹|labels|찾지 못했/);
  });

  it("material \"돌벽\" 은 석벽/목골 라벨 매칭으로 시공된다(그룹 id 불필요)", () => {
    const { ctx } = context();
    const result = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, material: "돌벽" });
    expect(result.ok, result.summary).toBe(true);
  });
});

describe("place_door / place_window (공정 2단계 — 벽 셀에만)", () => {
  it("벽 셀이 아니면 거부하고, 벽 셀에는 어휘 layerHome대로 설치한다", () => {
    const { ctx, tileset } = context();
    approve(tileset(), WALL_GROUP_ID);
    const door: TileGroupMetadata = {
      id: "test-door", name: "나무문", role: "prop", defaultLayer: "lower", layerHome: "lower",
      tileIds: [30, 31], description: "테스트 나무문", placementRules: "", origin: "user",
      patternGrammar: {
        kind: "vertical_expandable", minHeight: 2, preserveCaps: true, repeat: "body",
        parts: [{ role: "top", tileIds: [30] }, { role: "bottom", tileIds: [31] }],
      },
    };
    tileset().tileGroups!.push(door);
    tileset().tileMeta ??= [];
    for (const tile of [30, 31]) {
      tileset().tileMeta[tile] = {
        ...(tileset().tileMeta[tile] ?? {}),
        label: "테스트 나무문",
        description: "테스트 나무문",
        role: "prop",
        origin: "user",
        source: "user",
      };
    }
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, material: "흰 집 벽" }).ok).toBe(true);

    const offWall = runTool(ctx, "place_door", { mapId: MAP_ID, at: { x: 0, y: 0 }, material: "테스트 나무문" });
    expect(offWall.ok).toBe(false);
    expect(`${offWall.summary} ${JSON.stringify(offWall.issues ?? [])}`).toContain("벽 셀");

    const onWall = runTool(ctx, "place_door", { mapId: MAP_ID, at: { x: 3, y: 8 }, material: "테스트 나무문" });
    expect(onWall.ok, onWall.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID];
    expect(map.lowerTiles[8 * map.width + 3]).toBe(31); // 문 하단(1×2 세로 규약)
    expect(map.lowerTiles[7 * map.width + 3]).toBe(30); // 문 상단
  });
});

describe("lay_path / place_props (공정 4·5단계)", () => {
  function addApprovedPath(tileset: TilesetDef, withAutotile: boolean): void {
    // 번들 오토타일(builtin_snow/builtin_undergrowth 등)이 점유하지 않은 id만 쓴다 —
    // 겹치면 "오토타일 정의 없음" 케이스가 번들 그룹을 주워 통과해 버린다.
    const memberTileIds = [1, 2, 3, 4, 5, 7, 10, 12, 13, 14, 18, 19, 20];
    tileset.tileGroups!.push({
      id: "test-path", name: "테스트흙길", role: "terrain", defaultLayer: "lower",
      tileIds: memberTileIds, description: "테스트 전용 흙길", placementRules: "", origin: "user",
    });
    tileset.tileMeta ??= [];
    for (const tile of memberTileIds) {
      tileset.tileMeta[tile] = {
        ...(tileset.tileMeta[tile] ?? {}),
        label: "테스트흙길",
        description: "테스트 전용 흙길",
        role: "terrain",
        origin: "user",
        source: "user",
      };
    }
    if (withAutotile) {
      tileset.autotileGroups = [{
        id: "test-path-8", name: "테스트흙길8", neighborhood: 8, memberTileIds,
        variantMap: buildEightNeighborVariantMap(
          { body: 1, edgeN: 2, edgeS: 3, edgeW: 4, edgeE: 5, cornerNW: 7, cornerNE: 10, cornerSW: 12, cornerSE: 13 },
          { innerNW: 14, innerNE: 18, innerSW: 19, innerSE: 20 }
        ),
      }];
    }
  }

  it("8-이웃 variantMap 오토타일 정의가 없으면 거부한다(승인 시 오토타일 정의 필요)", () => {
    const { ctx, tileset } = context();
    addApprovedPath(tileset(), false);
    const result = runTool(ctx, "lay_path", { mapId: MAP_ID, points: [{ x: 1, y: 12 }, { x: 10, y: 12 }], material: "테스트흙길" });
    expect(result.ok).toBe(false);
    expect(`${result.summary} ${JSON.stringify(result.issues ?? [])}`).toContain("8-이웃 variantMap");
  });

  it("승인 어휘 + 8-이웃 variantMap이면 결정론(seed)으로 길을 깔고 외곽/inner corner를 재계산한다", () => {
    const { ctx, tileset } = context();
    addApprovedPath(tileset(), true);
    const args = { mapId: MAP_ID, points: [{ x: 1, y: 12 }, { x: 10, y: 12 }], material: "테스트흙길", naturalness: 0, seed: 7 };
    const result = runTool(ctx, "lay_path", args);
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { pathCells: number; reshaped: number };
    expect(data.pathCells).toBeGreaterThanOrEqual(10);
    expect(data.reshaped).toBeGreaterThan(0);
    const map = ctx.project.maps[MAP_ID];
    const members = new Set([1, 2, 3, 4, 5, 7, 10, 12, 13, 14, 18, 19, 20]);
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
    const soft = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 1, y: 1, w: 16, h: 10 }, material: "침엽수", count: 4, seed: 3 });
    expect(soft.ok, soft.summary).toBe(true);
    expect((soft.data as { vocabSoftConfirm?: { groupId?: string } }).vocabSoftConfirm?.groupId).toBe(treeId);
    const softPlaced = (soft.data as { placed?: number } | undefined)?.placed ?? 0;
    expect(softPlaced).toBeGreaterThan(0);

    approve(tileset(), treeId);
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 1, y: 1, w: 16, h: 10 }, material: "침엽수", count: 4, seed: 3 });
    expect(result.ok, result.summary).toBe(true);
    const placed = (result.data as { placed?: number } | undefined)?.placed ?? 0;
    expect(placed).toBeGreaterThan(0);
    expect((result.data as { vocabSoftConfirm?: unknown }).vocabSoftConfirm).toBeUndefined();
  });

  it("place_props: 존재하지 않는 라벨은 하드 실패한다", () => {
    const { ctx } = context();
    const missing = runTool(ctx, "place_props", {
      mapId: MAP_ID,
      area: { x: 1, y: 1, w: 8, h: 8 },
      material: "존재하지않는소품xyz",
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
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 4, w: 10, h: 8 }, material: "물" });
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
      material: "물",
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
      material: "물",
      shape: "rect",
    });
    expect(fill.ok, fill.summary).toBe(true);
    const props = runTool(ctx, "place_props", {
      mapId: MAP_ID,
      area: { x: 4, y: 4, w: 12, h: 10 },
      material: "침엽수",
      count: 20,
      seed: 1,
    });
    // 2026-09-18: 호수 안에 자리가 없으면 거부 대신 영역을 넓혀 물가에 놓는다 — 물 위에는 여전히 한 그루도 없어야 한다.
    expect(props.ok, props.summary).toBe(true);
    expect(props.summary).toContain("넓힘");
    const map = ctx.project.maps[MAP_ID];
    let treesOnWater = 0;
    for (let y = 4; y < 14; y += 1) {
      for (let x = 4; x < 16; x += 1) {
        const i = y * map.width + x;
        if (isLakeAutotileTile(map.lowerTiles[i]) && map.upperTiles[i] !== TILE.EMPTY) treesOnWater += 1;
      }
    }
    expect(treesOnWater).toBe(0);
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

    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 5, y: 5, w: 5, h: 5 }, material: "물" });
    const after = ctx.project.maps[MAP_ID];
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings).toContain("(7,7)은 transfer 목적지라 제외했습니다");
    expect(result.data).toMatchObject({ filled: 24, requested: 25 });
    expect(isLakeAutotileTile(after.lowerTiles[5 * after.width + 5])).toBe(true);
    expect(isLakeAutotileTile(after.lowerTiles[7 * after.width + 7])).toBe(false);
    expect(isPassable(ctx.project, after, 7, 7)).toBe(true);
  });

  it("tile_erase: upper 지우기가 통행을 막을 때만 transfer 목적지 셀을 제외한다", () => {
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
    // 물 위 통행 가능한 upper 발판 — 지우면 목적지가 막히므로 그 칸은 보호되어야 한다.
    map.lowerTiles.fill(TILE.WATER);
    for (let y = 6; y < 9; y += 1) {
      for (let x = 6; x < 9; x += 1) map.upperTiles[y * map.width + x] = TILE.PATH;
    }

    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 6, y: 6, w: 3, h: 3 }, layer: "upper" });
    const after = ctx.project.maps[MAP_ID];
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings).toContain("(7,7)은 transfer 목적지라 제외했습니다");
    expect(result.data).toMatchObject({ cleared: 8, requested: 9, skipped: 1 });
    expect(after.lowerTiles).toEqual(map.lowerTiles);
    expect(after.upperTiles[6 * after.width + 6]).toBe(TILE.EMPTY);
    expect(after.upperTiles[7 * after.width + 7]).toBe(TILE.PATH);
    expect(isPassable(ctx.project, after, 7, 7)).toBe(true);
  });

  it("tile_erase: 지운 하위 칸은 빈 칸이 아니라 맵의 기본 바닥이다 — 바닥에 구멍을 남기지 않는다", () => {
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
      for (let x = 6; x < 9; x += 1) map.lowerTiles[y * map.width + x] = TILE.PATH;
    }

    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 6, y: 6, w: 3, h: 3 }, layer: "lower" });
    const after = ctx.project.maps[MAP_ID];
    expect(result.ok, result.summary).toBe(true);
    // 기본 바닥(잔디)은 통행 가능하니 보호할 칸이 없다 — 9칸 전부 지면으로 되돌아간다.
    expect(result.data).toMatchObject({ cleared: 9, requested: 9, skipped: 0, groundTile: TILE.GRASS });
    for (let y = 6; y < 9; y += 1) {
      for (let x = 6; x < 9; x += 1) {
        expect(after.lowerTiles[y * after.width + x], `${x},${y}`).toBe(TILE.GRASS);
      }
    }
    expect(isPassable(ctx.project, after, 7, 7)).toBe(true);
  });

  it("tile_erase: 기본 바닥은 rect 밖 최빈값 — 실내 바닥 맵은 잔디가 아니라 그 바닥으로 되돌린다", () => {
    const INTERIOR_FLOOR = 222; // 나무 마루 — 실내 바닥으로 쓰이는 통행 가능 타일.
    const { ctx } = context();
    ctx.project.startPos = { x: 0, y: 0 };
    const map = ctx.project.maps[MAP_ID];
    map.lowerTiles.fill(INTERIOR_FLOOR);
    for (let y = 4; y < 6; y += 1) {
      for (let x = 4; x < 6; x += 1) {
        map.lowerTiles[y * map.width + x] = TILE.WALL;
        map.upperTiles[y * map.width + x] = 61;
      }
    }

    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 4, y: 4, w: 2, h: 2 } });
    const after = ctx.project.maps[MAP_ID];
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ cleared: 4, groundTile: INTERIOR_FLOOR });
    for (let y = 4; y < 6; y += 1) {
      for (let x = 4; x < 6; x += 1) {
        expect(after.lowerTiles[y * after.width + x], `${x},${y} lower`).toBe(INTERIOR_FLOOR);
        expect(after.upperTiles[y * after.width + x], `${x},${y} upper`).toBe(TILE.EMPTY);
      }
    }
  });
});

describe("tile_erase kind=market (시장 데크만 선택 철거)", () => {
  const HOUSE_LOWER = [15, 16, 17, 45, 46, 47, 75, 76, 77, 406, 407, 467];
  const HOUSE_UPPER = [356, 357, 386, 387, 87];
  const MARKET_LOWER = [222, 192, 228, 229, 230, 223, 193, 268];
  const MARKET_UPPER = [468, 469, 470, 234, 235, 236, 202, 203, 237];
  const HOUSE_RECT = { x: 1, y: 2, w: 7, h: 6 };
  const MARKET_RECT = { x: 8, y: 4, w: 8, h: 8 };
  const ERASE_RECT = { x: 1, y: 2, w: 15, h: 10 };
  const MARKET_SET = new Set([...MARKET_LOWER, ...MARKET_UPPER]);

  interface Snapshot {
    readonly x: number;
    readonly y: number;
    readonly lower: number;
    readonly upper: number;
  }

  function paintFixture(): { ctx: ToolContext; houseCells: Snapshot[]; marketCells: Snapshot[] } {
    const { ctx } = context();
    ctx.project.startPos = { x: 0, y: 0 };
    const map = ctx.project.maps[MAP_ID];
    const houseCells: Snapshot[] = [];
    const marketCells: Snapshot[] = [];
    let n = 0;
    for (let y = HOUSE_RECT.y; y < HOUSE_RECT.y + HOUSE_RECT.h; y += 1) {
      for (let x = HOUSE_RECT.x; x < HOUSE_RECT.x + HOUSE_RECT.w; x += 1) {
        const index = y * map.width + x;
        map.lowerTiles[index] = HOUSE_LOWER[n % HOUSE_LOWER.length];
        map.upperTiles[index] = n % 3 === 0 ? HOUSE_UPPER[n % HOUSE_UPPER.length] : TILE.EMPTY;
        houseCells.push({ x, y, lower: map.lowerTiles[index], upper: map.upperTiles[index] });
        n += 1;
      }
    }
    let m = 0;
    for (let y = MARKET_RECT.y; y < MARKET_RECT.y + MARKET_RECT.h; y += 1) {
      for (let x = MARKET_RECT.x; x < MARKET_RECT.x + MARKET_RECT.w; x += 1) {
        const index = y * map.width + x;
        map.lowerTiles[index] = MARKET_LOWER[m % MARKET_LOWER.length];
        map.upperTiles[index] = m % 2 === 0 ? MARKET_UPPER[m % MARKET_UPPER.length] : TILE.EMPTY;
        marketCells.push({ x, y, lower: map.lowerTiles[index], upper: map.upperTiles[index] });
        m += 1;
      }
    }
    return { ctx, houseCells, marketCells };
  }

  it("kind=market: bbox가 집을 덮어도 집 타일은 그대로, 시장 데크만 지우고 lower는 잔디로 되돌린다", () => {
    const { ctx, houseCells, marketCells } = paintFixture();
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: ERASE_RECT, kind: "market" });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID];

    for (const cell of houseCells) {
      const index = cell.y * map.width + cell.x;
      expect(map.lowerTiles[index], `house lower ${cell.x},${cell.y}`).toBe(cell.lower);
      expect(map.upperTiles[index], `house upper ${cell.x},${cell.y}`).toBe(cell.upper);
    }

    let cleared = 0;
    let formerLowerMarket = 0;
    let grassRestored = 0;
    for (const cell of marketCells) {
      const index = cell.y * map.width + cell.x;
      const lower = map.lowerTiles[index];
      const upper = map.upperTiles[index];
      if (!MARKET_SET.has(lower) && !MARKET_SET.has(upper)) cleared += 1;
      if (MARKET_SET.has(cell.lower)) {
        formerLowerMarket += 1;
        if (lower === TILE.GRASS) grassRestored += 1;
      }
    }
    expect(cleared / marketCells.length).toBeGreaterThanOrEqual(0.9);
    expect(formerLowerMarket).toBeGreaterThan(0);
    expect(grassRestored).toBe(formerLowerMarket);
  });

  it("kind 생략(레거시)은 AABB 전체를 정리한다 — 집 타일도 상위는 EMPTY·하위는 기본 바닥", () => {
    const { ctx, houseCells } = paintFixture();
    const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: ERASE_RECT });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID];
    for (const cell of houseCells) {
      const index = cell.y * map.width + cell.x;
      expect(map.lowerTiles[index], `legacy lower ${cell.x},${cell.y}`).toBe(TILE.GRASS);
      expect(map.upperTiles[index], `legacy upper ${cell.x},${cell.y}`).toBe(TILE.EMPTY);
    }
  });
});

describe("잔디 채우기 (grass-autotile)", () => {
  it("fill_region이 잔디 그룹으로 사각형을 채운다", () => {
    const { ctx } = context();
    const result = runTool(ctx, "fill_region", {
      mapId: MAP_ID, rect: { x: 2, y: 2, w: 4, h: 3 }, material: "물",
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect((result.diff?.warnings ?? []).some((warning) => warning.includes("목업 확인 대기"))).toBe(false); // 번들 시드라 soft 아님
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

  it("기본 설정은 감독/실행 단일 경로다 (영역 작업 실측: 모델 이원화 기본 해제)", () => {
    // 이 테스트가 지키려는 것은 **이원화 해제**이지 특정 모델 이름이 아니다.
    // 예전에는 리터럴("google/gemini-3.1-flash-lite")을 박아 뒀는데, 기본 모델이 바뀔 때마다
    // 여기까지 같이 고쳐야 해서 실제로 한 번 놓쳤다(리터럴을 단언하는 곳이 두 군데였다).
    // 모델 이름 자체는 test/aiLlmClient.test.ts 가 한 곳에서 못박는다.
    // assistantSession.orchestrationEnabled() 가 `lite !== main` 으로 이원화를 켜므로,
    // 두 값이 같다는 것이 곧 "기본은 단일 경로" 다.
    expect(DEFAULT_LITE_MODEL).toBe(DEFAULT_MODEL);
  });
});
