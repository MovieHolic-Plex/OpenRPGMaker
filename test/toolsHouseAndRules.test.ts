// 챗봇 툴 확장 계약(2026-07-05, 감사 로그 후속): build_house(자유 크기 집) /
// clear_region(영역 정리) / set_tile_rules(레이어·통행·지형 태그 챗봇 설정).
// 배경: "10x10 집" 요청에 벽 타일 사각형을 채우고, ㄴ자 집을 못 만들고,
// 잘못 깐 무더기를 정리하지 못하던 감사 로그의 툴 공백을 메운다.
import { describe, expect, it } from "vitest";
import { userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { applyCombinedTownHarness } from "@/project/tilesetHarness";

const SLOPED_ROOF = 385;

function ctxWithMap(width = 16, height = 16): { context: ToolContext; mapId: string } {
  const context: ToolContext = { project: createBlankProject() };
  const created = runTool(context, "create_map", { name: "집 테스트", width, height, id: "map_house" });
  expect(created.ok, created.summary).toBe(true);
  return { context, mapId: "map_house" };
}

describe("build_house", () => {
  it("10×10 집을 지붕/벽/문/창문 구성으로 짓는다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "build_house", {
      mapId,
      origin: { x: 2, y: 2 },
      width: 10,
      height: 10,
      material: "plaster",
      naturalness: 0,
    });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    const at = (x: number, y: number) => y * map.width + x;
    // 지붕 사선 양끝(상위) — 354/355는 투명 칩이라 상위에 있어야 한다.
    expect(map.upperTiles[at(2, 2)]).toBe(354);
    expect(map.upperTiles[at(11, 2)]).toBe(355);
    // 높이 10은 키트의 지붕 몸통 행을 늘린다. 처마 아래에는 bright-plaster 벽 3행이 온다.
    expect(map.lowerTiles[at(6, 8)]).toBe(405);
    expect(map.lowerTiles[at(2, 9)]).toBe(12);
    expect(map.lowerTiles[at(6, 9)]).toBe(13);
    expect(map.lowerTiles[at(11, 9)]).toBe(14);
    // 문 2칸(하위) — 문 좌표는 반환 data와 일치.
    const door = (result.data as { door: { x: number; y: number } }).door;
    expect(door).toEqual({ x: 7, y: 11 });
    expect(map.lowerTiles[at(7, 10)]).toBe(116);
    expect(map.lowerTiles[at(7, 11)]).toBe(146);
    // bright-plaster 키트 창문(상위 85) 최소 1개.
    expect(map.upperTiles[at(3, 10)]).toBe(85);
  });

  it("최소 크기 미만/맵 밖은 거부한다", () => {
    const { context, mapId } = ctxWithMap(12, 12);
    expect(runTool(context, "build_house", { mapId, origin: { x: 0, y: 0 }, width: 4, height: 10, material: "wood" }).ok).toBe(false);
    expect(runTool(context, "build_house", { mapId, origin: { x: 0, y: 0 }, width: 10, height: 5, material: "wood" }).ok).toBe(false);
    const overflow = runTool(context, "build_house", { mapId, origin: { x: 6, y: 6 }, width: 10, height: 10, material: "wood" });
    expect(overflow.ok).toBe(false);
    expect(overflow.summary).toContain("벗어납니다");
  });
});

describe("clear_region", () => {
  it("하위는 잔디로, 상위는 빈 칸으로 되돌리고 이벤트는 남긴다", () => {
    const { context, mapId } = ctxWithMap();
    // 물은 (3,3)~(6,4)까지만 — NPC가 설 (5,5)는 잔디여야 자동 재배치되지 않는다.
    expect(runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "rect", tile: TILE.WATER, from: { x: 3, y: 3 }, to: { x: 6, y: 4 } }).ok).toBe(true);
    expect(runTool(context, "paint_tiles", { mapId, layer: "upper", mode: "cells", tile: 378, cells: [{ x: 4, y: 4 }] }).ok).toBe(true);
    const npc = runTool(context, "place_npc", { mapId, x: 5, y: 5, name: "주민", pages: [{ lines: ["!"] }], id: "ev_keep" });
    expect(npc.ok, npc.summary).toBe(true);
    expect(context.project.maps[mapId].events.find((event) => event.id === "ev_keep")?.x).toBe(5);

    const result = runTool(context, "clear_region", { mapId, x: 3, y: 3, w: 4, h: 4 });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    const at = (x: number, y: number) => y * map.width + x;
    expect(map.lowerTiles[at(4, 4)]).toBe(TILE.GRASS);
    expect(map.upperTiles[at(4, 4)]).toBe(TILE.EMPTY);
    expect(map.events.some((event) => event.id === "ev_keep")).toBe(true);
    expect(result.diff?.warnings.join(" ")).toContain("ev_keep"); // 툴 경고는 diff.warnings로 전달된다.
  });

  it("fill=empty면 하위도 빈 칸으로 만든다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "clear_region", { mapId, x: 0, y: 0, w: 2, h: 2, fill: "empty" });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps[mapId].lowerTiles[0]).toBe(TILE.EMPTY);
  });
});

describe("set_tile_rules", () => {
  it("레이어 확정은 confirmedByUser 없이는 거부한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "set_tile_rules", { entries: [{ tile: SLOPED_ROOF, layer: "lower" }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("사용자 확인");
  });

  it("확정 레이어/통행/지형 태그가 하네스 재적용에도 유지된다", () => {
    const context: ToolContext = { project: createBlankProject() };
    // 잔디를 막으면 기존 맵의 이동(transfer) 무결성 게이트에 걸리므로,
    // 통행 완화(나무를 통행 가능으로) + 지형 태그로 검증한다.
    const result = runTool(context, "set_tile_rules", {
      confirmedByUser: true,
      entries: [
        { tile: SLOPED_ROOF, layer: "lower" },
        { tile: TILE.TREE, passable: true, terrainTag: 3 },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
    const tileset = context.project.tilesets[DEFAULT_TILESET_ID];
    expect(userTileLayerOverride(tileset, SLOPED_ROOF)).toBe("lower");
    expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
    expect(tileset.passability[TILE.TREE].up).toBe(true);
    expect(tileset.terrain[TILE.TREE]).toBe(3);

    // 프로젝트 로드 시 하네스가 사용자 규칙을 되돌리지 않는다.
    applyCombinedTownHarness(tileset);
    expect(tileset.priority[SLOPED_ROOF]).toBe("lower");
    expect(tileset.passability[TILE.TREE].up).toBe(true);
    expect(tileset.terrain[TILE.TREE]).toBe(3);
  });

  it("set_tile_passability도 user 메타로 기록되어 하네스에 살아남는다", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "set_tile_passability", { tile: 342, passable: true }).ok).toBe(true);
    const tileset = context.project.tilesets[DEFAULT_TILESET_ID];
    expect(tileset.passability[342].up).toBe(true);
    applyCombinedTownHarness(tileset);
    expect(tileset.passability[342].up).toBe(true); // 돌바닥(solid 그룹 계약)보다 사용자 확정이 우선.
  });
});
