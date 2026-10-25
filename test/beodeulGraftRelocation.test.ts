// 버들항 사본의 이식 칸이 새 번들 꼬리(성벽 28,544~)와 겹치면 새 끝 뒤로 옮기고 맵·킷·changeTile 번호를 같이 고친다(localTailRelocation.ts).
import { describe, expect, it } from "vitest";
import { BEODEUL_CITY_TILE_COUNT, BEODEUL_TOWN_WALL_BASE, createBeodeulCityTileset, ensureBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { townWallAvailable } from "@/editor/tools/beodeulTownWall";
import type { StructureKitDef, TilesetDef } from "@/project/types";

/** 성벽 꼬리 전(28,544칸)에 저장되고 그 뒤에 이식 칸 네 개를 붙인 사본. */
function copyWithGrafts(): TilesetDef {
  const ts = createBeodeulCityTileset();
  const end = BEODEUL_TOWN_WALL_BASE;
  ts.passability = ts.passability.slice(0, end);
  ts.priority = ts.priority.slice(0, end);
  ts.terrain = ts.terrain.slice(0, end);
  ts.tileMeta = ts.tileMeta!.slice(0, end);
  ts.structureKits = (ts.structureKits ?? []).filter((kit) => !kit.id.startsWith("bd-wall-"));
  ts.tileGroups = (ts.tileGroups ?? []).filter((group) => !group.id.startsWith("beodeul:town_wall"));
  ts.tileGrafts = [0, 1, 2, 3].map((k) => ({ targetTile: end + k, sourceChipset: "tex_beodeul_forms", sourceTile: 10 + k }));
  for (let k = 0; k < ts.tilesPerRow; k += 1) {
    ts.passability.push(k === 1 ? { up: false, down: false, left: false, right: false } : { up: true, down: true, left: true, right: true });
    ts.priority.push(k === 2 ? "upper" : "lower");
    ts.terrain.push(0);
    ts.tileMeta!.push({ label: k < 4 ? `이식 ${k}` : "", description: "" });
  }
  ts.count = end + ts.tilesPerRow;
  ts.structureKits = [...ts.structureKits!, { id: "my-kit", name: "내 킷", kind: "section", width: 2, height: 1, tileSize: 16, learnedFrom: "user",
    rows: [{ tiles: [-1, 5], upperTiles: [end + 2, end + 3] }] } as unknown as StructureKitDef];
  return ts;
}

describe("버들항 이식 칸 옮기기", () => {
  it("겹치는 이식 칸을 새 번들 끝 뒤로 옮기고 맵·킷·changeTile 을 같이 고친 뒤 성벽 꼬리를 받는다", () => {
    const ts = copyWithGrafts();
    const end = BEODEUL_TOWN_WALL_BASE;
    const tiles = new Array(16).fill(5);
    const upper = new Array(16).fill(-1); upper[3] = end + 1; upper[7] = 12;
    const project = {
      tilesets: { beodeul_city: ts },
      maps: {
        m1: { id: "m1", tilesetId: "beodeul_city", width: 4, height: 4, lowerTiles: tiles, upperTiles: upper, upperOverlayTiles: [...new Array(15).fill(-1), end],
          events: [{ id: "e", pages: [{ commands: [{ kind: "conditional", then: [{ kind: "changeTile", mapId: "m1", layer: "upper", x: 0, y: 0, tile: end + 3 }] }] }] }] },
        other: { id: "other", tilesetId: "forest_harmony", width: 1, height: 1, lowerTiles: [end + 1], upperTiles: [-1], events: [] },
      },
      commonEvents: [{ id: "c", commands: [{ kind: "changeTile", mapId: "m1", layer: "lower", x: 1, y: 1, tile: end }] }],
    };
    expect(ensureBeodeulCityTileset(ts, project as never)).toBe(true);
    const shift = BEODEUL_CITY_TILE_COUNT - end;
    expect(ts.tileGrafts!.map((g) => g.targetTile)).toEqual([0, 1, 2, 3].map((k) => end + shift + k));
    expect(ts.passability[end + shift + 1]).toEqual({ up: false, down: false, left: false, right: false });
    expect(ts.priority[end + shift + 2]).toBe("upper");
    expect(ts.tileMeta![end + shift]!.label).toBe("이식 0");
    expect(ts.tileMeta![end]!.label).toContain("성벽");
    expect(townWallAvailable(ts)).toBe(true);
    const m1 = project.maps.m1;
    expect(m1.upperTiles[3]).toBe(end + shift + 1);
    expect(m1.upperTiles[7]).toBe(12);
    expect(m1.upperOverlayTiles[15]).toBe(end + shift);
    expect(m1.events[0]!.pages[0]!.commands[0]!.then[0]!.tile).toBe(end + shift + 3);
    expect(project.commonEvents[0]!.commands[0]!.tile).toBe(end + shift);
    expect(project.maps.other.lowerTiles[0]).toBe(end + 1);
    const kit = ts.structureKits!.find((k) => k.id === "my-kit")!;
    expect(kit.rows[0]!.upperTiles).toEqual([end + shift + 2, end + shift + 3]);
    expect(kit.rows[0]!.tiles).toEqual([-1, 5]);
    // 두 번째 실행은 아무것도 바꾸지 않는다
    expect(ensureBeodeulCityTileset(ts, project as never)).toBe(false);
  });

  it("프로젝트 없이 부르면 예전처럼 겹치는 꼬리를 받지 않는다", () => {
    const ts = copyWithGrafts();
    ensureBeodeulCityTileset(ts);
    expect(ts.tileGrafts![0]!.targetTile).toBe(BEODEUL_TOWN_WALL_BASE);
    expect(townWallAvailable(ts)).toBe(false);
  });
});
