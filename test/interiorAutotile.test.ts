import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import {
  createInteriorWallFrameAutotileGroup,
  ensureTilesetHarnesses,
  INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
} from "@/project/tilesetHarness";
import { runInteriorRoomPipeline } from "@/editor/interiorRoomPipeline";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import type { AutotileGroup, TilesetDef } from "@/project/types";

function wallFrameGroup(tileset: TilesetDef | undefined): AutotileGroup | undefined {
  return tileset?.autotileGroups?.find((group) => group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
}

describe("interior wall-frame autotile harness (Option B: no house wall-frame store group)", () => {
  it("does not seed house wall-frame autotile; seeds dark 366 only", () => {
    const project = createBlankProject();
    const interior = project.tilesets.easyrpg_chipset_interior;
    expect(wallFrameGroup(interior)).toBeUndefined();
    const dark = interior.autotileGroups?.find((g) => g.id.includes("dark-wall"));
    expect(dark).toBeDefined();
    expect(dark?.memberTileIds).toEqual([366]);
    // user groups preserved
    const custom = { id: "user_custom_autotile", name: "user", memberTileIds: [1], variantMap: { "0": 1 } };
    interior.autotileGroups = [custom as any, ...(interior.autotileGroups ?? [])];
    ensureTilesetHarnesses(project);
    expect(wallFrameGroup(interior)).toBeUndefined();
    expect(interior.autotileGroups?.some((group) => group.id === "user_custom_autotile")).toBe(true);
  });

  it("does not seed interior-specific autotiles on dungeon tilesets (but does seed dungeon's own)", () => {
    const dungeon = createBlankProject().tilesets.easyrpg_chipset_dungeon;
    // 실내 전용 그룹(벽 프레임)은 던전에 새지 않는다.
    expect(wallFrameGroup(dungeon)).toBeUndefined();
    const ids = autotileGroupsForTileset(dungeon).map((group) => group.id);
    expect(ids).not.toContain(INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
    expect(ids.every((id) => !id.startsWith("harness-interior-house-v1-"))).toBe(true);
    // 대신 던전 자체 지형 오토타일 13종은 시드된다(2026-07-13 추가).
    expect(ids.filter((id) => id.startsWith("harness-dungeon-v1-terrain-"))).toHaveLength(13);
  });

  it("keeps wall-frame group absent after ensureTilesetHarnesses", () => {
    const project = createBlankProject();
    const interior = project.tilesets.easyrpg_chipset_interior;
    interior.autotileGroups = [];
    expect(wallFrameGroup(interior)).toBeUndefined();

    expect(ensureTilesetHarnesses(project)).toBe(true);
    expect(wallFrameGroup(interior)).toBeUndefined();
    expect(autotileGroupsForTileset(interior).length).toBeGreaterThanOrEqual(1);
  });

  // 회귀: 서벽(dark-mass 428) 자리에 크림 회벽을 놓으면 뒤쪽 공허가 벽 조각을 흘리면 안 된다.
  // 옛 버그: (1,6)에 크림 104/106 → 인접 공허 (0,5)(0,6)(0,7)(1,7)에 428/368 조각 누출("매우 많이 망가짐").
  // 크림 면은 dark-mass 렌더 대상은 아니지만 이웃 판정(isMass)에서는 벽으로 쳐야 누출이 없다.
  it("cream wall placed on a dark-mass wall cell does not bleed onto exterior void (오두막 (1,6) 회귀)", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const { map } = runInteriorRoomPipeline({
      mapId: "map_rp_hut_v1", name: "연습 · 오두막 (10×9)",
      width: 10, height: 9, wings: [{ x: 2, y: 4, w: 5, h: 3 }],
      door: { x: 4, y: 6 }, theme: "storage", floorTile: 139, seed: 11,
    });
    const w = map.width;
    // 공허(430) 셀의 렌더 서명을 배치 전에 수집.
    const voidSig = (): Map<number, string> => {
      const sig = new Map<number, string>();
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (map.lowerTiles[y * w + x] !== 430) continue;
          const c = chipsetQuarterComposition(map, tileset, x, y);
          sig.set(y * w + x, c ? c.sources.map((s) => `${s.quarter}@${s.tile}`).join(",") : "plain");
        }
      }
      return sig;
    };
    const before = voidSig();

    for (const cream of [104, 105, 106]) {
      const snapshot = [...map.lowerTiles];
      map.lowerTiles[6 * w + 1] = cream; // (1,6) 서벽 자리에 크림 회벽
      shapeAutotileGroupAround(map, createInteriorWallFrameAutotileGroup(), [{ x: 1, y: 6 }]);
      const after = voidSig();
      for (const [idx, sig] of after) {
        // 어떤 공허 셀도 배치 때문에 벽 조각(비-plain)을 새로 얻으면 안 된다.
        expect(`${idx}:${sig}`).toBe(`${idx}:${before.get(idx)}`);
      }
      map.lowerTiles.splice(0, map.lowerTiles.length, ...snapshot); // 원복 후 다음 타일 검사
    }
  });
});
