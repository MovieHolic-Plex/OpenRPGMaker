// 집 장식 배선(2026-07-20) — 굴뚝(지붕 문법 채택)·깃발·울타리 옵션이
// 정본 경로(stampFootprintHouseKit / buildHouseKit)에서 결정론으로 시공되는지.
import { describe, expect, it } from "vitest";
import { CHIMNEY_TILE, stampFootprintHouseKit } from "@/editor/houseKit";
import { buildHouseKit } from "@/editor/tools/houseKitDomain";
import { createEmptyToolProject, runTool } from "@/editor/tools";
import type { GameMap, Project } from "@/project/types";

const GRASS = 240;

function grassMap(width: number, height: number): GameMap {
  return {
    id: "map_decor_test",
    name: "장식 테스트",
    width,
    height,
    lowerTiles: new Array(width * height).fill(GRASS),
    upperTiles: new Array(width * height).fill(-1),
    events: [],
  } as unknown as GameMap;
}

// runTool은 커밋 시 context.project를 재할당한다 — 항상 context를 통해 읽을 것.
// 집은 시작 위치(맵 중앙)를 피해서 짓는다 — 덮으면 무결성 게이트(start-position)가 커밋을 거부한다.
function toolContextWithMap(): { context: { project: Project }; mapId: string } {
  const project = createEmptyToolProject("장식 도구 테스트");
  const context = { project };
  const created = runTool(context, "create_map", { name: "장식맵", width: 24, height: 20 });
  expect(created.ok).toBe(true);
  const mapId = Object.keys(context.project.maps)[0]!;
  context.project.maps[mapId]!.lowerTiles.fill(GRASS);
  context.project.maps[mapId]!.upperTiles.fill(-1);
  return { context, mapId };
}

describe("굴뚝 — houseKit 지붕 문법 채택", () => {
  it("직사각 지붕: 우측 사선 열 상단 바로 아래에 상위 326", () => {
    const map = grassMap(15, 14);
    const result = stampFootprintHouseKit(map, {
      wings: [{ x: 3, y: 3, w: 9, h: 8 }],
      kitId: "blue-stone",
      chimney: true,
    });
    expect(result.ok).toBe(true);
    // 우측 지붕 열 x=11, 지붕 최상단 y=3 → 굴뚝은 (11,4)
    expect(map.upperTiles[4 * 15 + 11]).toBe(CHIMNEY_TILE);
  });

  it("기본은 꺼짐 — 옵션 없이는 326이 없다", () => {
    const map = grassMap(15, 14);
    stampFootprintHouseKit(map, { wings: [{ x: 3, y: 3, w: 9, h: 8 }], kitId: "blue-stone" });
    expect(map.upperTiles.includes(CHIMNEY_TILE)).toBe(false);
  });
});

describe("author_house 장식 옵션 — chimney", () => {
  it("chimney:true 면 굴뚝이 시공된다", () => {
    const { context, mapId } = toolContextWithMap();
    const result = runTool(context, "author_house", {
      kind: "single",
      mapId,
      kitId: "blue-stone",
      wings: [{ x: 2, y: 2, w: 9, h: 8 }],
      interior: "exterior-only",
      door: true,
      chimney: true,
      yard: [],
    });
    expect(result.ok).toBe(true);

    const map = context.project.maps[mapId]!;
    const doorAt = (result.data as { houses: readonly { doorAt: { x: number; y: number } }[] }).houses[0]!.doorAt;
    expect(doorAt).toBeTruthy();

    // 굴뚝
    expect(map.upperTiles.includes(CHIMNEY_TILE)).toBe(true);
  });

  it("옵션을 안 주면 기존과 동일 — 장식 타일이 없다(기본 꺼짐 회귀 방지)", () => {
    const { context, mapId } = toolContextWithMap();
    const result = runTool(context, "author_house", {
      kind: "single",
      mapId,
      kitId: "blue-stone",
      wings: [{ x: 2, y: 2, w: 9, h: 8 }],
      interior: "exterior-only",
      door: true,
      yard: [],
    });
    expect(result.ok).toBe(true);
    const map = context.project.maps[mapId]!;
    expect(map.upperTiles.includes(CHIMNEY_TILE)).toBe(false);
    expect(map.upperTiles.includes(208)).toBe(false);
  });

  it("도메인 직접 호출도 동일 계약(buildHouseKit)", () => {
    const { context, mapId } = toolContextWithMap();
    const result = buildHouseKit(context.project, {
      mapId,
      kitId: "amber-wood",
      wings: [{ x: 2, y: 2, w: 10, h: 8 }],
      door: true,
      doorEvent: false,
      interior: false,
      fence: true,
      banner: true,
      chimney: true,
    });
    expect(result.summary).toContain("장식(굴뚝·깃발 208/209·울타리+게이트)");
  });
});
