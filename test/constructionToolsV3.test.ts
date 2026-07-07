// test/constructionToolsV3.test.ts
// 공정 프리미티브 6종 계약 테스트 (타일 툴 v3 — V3B).
// 고정하는 계약: (1) 승인 어휘만 소비(미승인 = 하드 차단 + propose 안내) (2) layer 인자 없음 —
// 어휘 layerHome이 결정 (3) 벽 없이 지붕 거부 / 문·창은 벽 셀에만 (4) lay_path는 8-이웃
// variantMap 필수 (5) v2 배치 4종 deprecated(LLM 비노출, 실행 호환) (6) DEFAULT_MODEL 전환.

import { describe, expect, it } from "vitest";
import { getTool, runTool, toOpenAiTools, type ToolContext } from "@/editor/tools";
import { V2_TILE_SUPERSEDED } from "@/editor/tools/v3";
import { buildEightNeighborVariantMap } from "@/editor/tools/v3/rmTypeExpander";
import { DEFAULT_MODEL } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

const MAP_ID = "map_blank_start";
const WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`;

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
  it("미승인 벽 어휘는 하드 차단된다(propose_tile_vocabulary 안내 + 재전송 예시)", () => {
    const { ctx } = context();
    const result = runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 2, y: 5, w: 4, h: 4 }, wallVocabId: WALL_GROUP_ID });
    expect(result.ok).toBe(false);
    const text = `${result.summary} ${JSON.stringify(result.issues ?? [])}`;
    expect(text).toContain("합의되지 않았습니다");
    expect(text).toContain("propose_tile_vocabulary");
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

  it("place_props: 미승인 소품은 거부, 승인 그룹은 기존 산포 엔진으로 배치된다", () => {
    const { ctx, tileset } = context();
    const treeId = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;
    const rejected = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 1, y: 1, w: 16, h: 10 }, propVocabId: treeId, count: 4 });
    expect(rejected.ok).toBe(false);
    expect(`${rejected.summary} ${JSON.stringify(rejected.issues ?? [])}`).toContain("propose_tile_vocabulary");

    approve(tileset(), treeId);
    const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 1, y: 1, w: 16, h: 10 }, propVocabId: treeId, count: 4, seed: 3 });
    expect(result.ok, result.summary).toBe(true);
    const placed = (result.data as { placed?: number } | undefined)?.placed ?? 0;
    expect(placed).toBeGreaterThan(0);
  });
});

describe("v2 배치 4종 deprecated + 모델 전환 (V3B)", () => {
  it("tile_paint/road/scatter/structure는 LLM 비노출·실행 호환·supersededBy 매핑, v3 6종은 노출된다", () => {
    const exposed = new Set(toOpenAiTools().map((tool) => tool.function.name));
    for (const [v2Name, v3Name] of V2_TILE_SUPERSEDED) {
      expect(exposed.has(v2Name), v2Name).toBe(false);
      const tool = getTool(v2Name);
      expect(tool?.deprecated, v2Name).toBe(true);
      expect(tool?.supersededBy, v2Name).toBe(v3Name);
      expect(tool?.version, v2Name).toBe(2);
    }
    for (const name of ["build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props"]) {
      expect(exposed.has(name), name).toBe(true);
      expect(getTool(name)?.version, name).toBe(3);
    }
  });

  it("DEFAULT_MODEL은 minimax/minimax-m3다 (v3 설계 축 7)", () => {
    expect(DEFAULT_MODEL).toBe("minimax/minimax-m3");
  });
});
