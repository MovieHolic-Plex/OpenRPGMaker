import { store } from "@/project/store";
import { cloneDefaultAutotileGroups } from "@/project/defaults/autotileGroups";
import { buildEdgeCornerVariantMap, type EdgeCornerTileSet } from "@/project/defaults/autotileEngine";
import type { AutotileGroup, PassFlag, TilesetId } from "@/project/types";
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

// ── 오토타일 그룹 편집 ─────────────────────────────────────────────

// 새 오토타일 그룹을 추가하고 그 id 를 반환한다(빈 4방향 그룹).
export function addAutotileGroup(tilesetId: TilesetId, name: string): string | null {
  let created: string | null = null;
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    const id = `autotile_${uniqueSuffix(tileset.autotileGroups ?? [])}`;
    const group: AutotileGroup = {
      id,
      name: name.trim() || `오토타일 ${(tileset.autotileGroups?.length ?? 0) + 1}`,
      neighborhood: 4,
      memberTileIds: [],
      variantMap: {},
    };
    tileset.autotileGroups = [...(tileset.autotileGroups ?? []), group];
    created = id;
  });
  return created;
}

// 내장 기본 그룹(흙길/모래)을 편집 가능한 형태로 채워 넣는다(이미 있으면 덧붙임).
export function seedDefaultAutotileGroups(tilesetId: TilesetId): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.autotileGroups = [...(tileset.autotileGroups ?? []), ...cloneDefaultAutotileGroups()];
  });
}

export function removeAutotileGroup(tilesetId: TilesetId, groupId: string): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset?.autotileGroups) return;
    tileset.autotileGroups = tileset.autotileGroups.filter((group) => group.id !== groupId);
    if (tileset.autotileGroups.length === 0) delete tileset.autotileGroups;
  });
}

type AutotileGroupPatch = Partial<Pick<AutotileGroup, "name" | "neighborhood" | "memberTileIds" | "connectTileIds" | "triggerTileIds" | "variantMap">>;

export function updateAutotileGroup(tilesetId: TilesetId, groupId: string, patch: AutotileGroupPatch): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    const group = tileset?.autotileGroups?.find((entry) => entry.id === groupId);
    if (!group) return;
    if (patch.name !== undefined) group.name = patch.name;
    if (patch.neighborhood !== undefined) group.neighborhood = patch.neighborhood;
    if (patch.memberTileIds !== undefined) group.memberTileIds = [...patch.memberTileIds];
    if (patch.connectTileIds !== undefined) group.connectTileIds = [...patch.connectTileIds];
    if (patch.triggerTileIds !== undefined) group.triggerTileIds = [...patch.triggerTileIds];
    if (patch.variantMap !== undefined) group.variantMap = { ...patch.variantMap };
  });
}

// 단일 비트마스크 항목을 편집한다. tile 이 null 이면 매핑을 제거한다.
export function setAutotileVariant(tilesetId: TilesetId, groupId: string, mask: number, tile: number | null): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    const group = tileset?.autotileGroups?.find((entry) => entry.id === groupId);
    if (!group) return;
    const nextMap = { ...group.variantMap };
    if (tile === null) delete nextMap[String(mask)];
    else nextMap[String(mask)] = tile;
    group.variantMap = nextMap;
  });
}

// 9분류(몸통/4변/4모서리) 타일로 16종 variantMap 을 일괄 채운다.
export function fillAutotileVariantMap(tilesetId: TilesetId, groupId: string, tiles: EdgeCornerTileSet): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    const group = tileset?.autotileGroups?.find((entry) => entry.id === groupId);
    if (!group) return;
    group.variantMap = buildEdgeCornerVariantMap(tiles);
  });
}

function uniqueSuffix(groups: readonly AutotileGroup[]): string {
  let index = groups.length + 1;
  const existing = new Set(groups.map((group) => group.id));
  while (existing.has(`autotile_${index}`)) index += 1;
  return String(index);
}
