import { store } from "@/project/store";
import type { PassFlag, TilesetId } from "@/project/types";
import { markUserTileRuntimeMetadata } from "./runtimeTileMetadata";

export function setTerrainTag(tilesetId: TilesetId, tile: number, terrain: number): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset || tile < 0 || tile >= tileset.count) return;
    const terrainTag = Math.max(0, Math.floor(terrain));
    tileset.terrain[tile] = terrainTag;
    markUserTileRuntimeMetadata(tileset, tile, { terrainTag });
  });
}

// 타일셋의 특정 타일 통행(passability) 방향 플래그를 토글.
// 인스펙터에서 편집 — toggleCollision(맵 좌표 기반)과 달리 타일 인덱스 기반.
export function setTilePassageFlag(tilesetId: TilesetId, tile: number, direction: keyof PassFlag, passable: boolean): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset || tile < 0 || tile >= tileset.count) return;
    const current = tileset.passability[tile] ?? { up: true, down: true, left: true, right: true };
    const next: PassFlag = { ...current, [direction]: passable };
    tileset.passability[tile] = next;
    const allSolid = !next.up && !next.down && !next.left && !next.right;
    markUserTileRuntimeMetadata(tileset, tile, { passage: allSolid ? "solid" : "passable" });
  });
}

// 타일셋의 특정 타일 통행을 전체 통과/전체 막힘으로 일괄 설정.
export function setTilePassageBulk(tilesetId: TilesetId, tile: number, passable: boolean): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset || tile < 0 || tile >= tileset.count) return;
    const next: PassFlag = { up: passable, down: passable, left: passable, right: passable };
    tileset.passability[tile] = next;
    markUserTileRuntimeMetadata(tileset, tile, { passage: passable ? "passable" : "solid" });
  });
}
