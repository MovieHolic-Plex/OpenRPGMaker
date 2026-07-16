import { store } from "@/project/store";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { cloneDefaultAutotileGroups, autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { buildEdgeCornerVariantMap, type EdgeCornerTileSet } from "@/project/defaults/autotileEngine";
import {
  buildAnimatedWaterStrip,
  buildTemplateGroup,
  type AutotileTemplateKind,
} from "@/editor/panels/tilesetAutotileTemplates";
import type { AutotileGroup, PassFlag, TilesetDef, TilesetId } from "@/project/types";
import { markUserTileRuntimeMetadata } from "./runtimeTileMetadata";

export function setTerrainTag(tilesetId: TilesetId, tile: number, terrain: number): void {
  recordProjectSnapshot();
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
  recordProjectSnapshot();
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
  recordProjectSnapshot();
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
  recordProjectSnapshot();
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
  recordProjectSnapshot();
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.autotileGroups = [...(tileset.autotileGroups ?? []), ...cloneDefaultAutotileGroups()];
  });
}

export type AutotileTemplateActionResult = { ok: true; groupId?: string } | { ok: false; error: string };

// 템플릿 위저드(tilesetAutotileTemplateWizard.ts)의 커밋 액션.
// - 오토타일 템플릿(rm2k-3x4/grid-3x3/grid-3x2): buildTemplateGroup 결과를 autotileGroups 에 push.
//   이때 rmTypeExpander.ts registerAutotileGroup 의 "내장 폴백 승계" 규약을 적용한다 —
//   autotileGroupsForTileset 은 자체 정의가 있으면 내장 그룹 중 멤버가 겹치지 않는 것만 폴백으로
//   남기므로, 첫 커스텀 그룹을 넣기 전에 내장(흙길/모래/포석/경작지)을 편집 가능한 사본으로 승계해
//   기존 오토타일이 죽지 않게 한다.
// - animated-water: 그룹 대신 tileset.animationStrips 에 스트립을 push 한다(groupId 없음).
export function addAutotileGroupFromTemplate(
  tilesetId: TilesetId,
  kind: AutotileTemplateKind,
  anchorTile: number
): AutotileTemplateActionResult {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) return { ok: false, error: "타일셋을 찾을 수 없습니다." };

  if (kind === "animated-water") {
    const built = buildAnimatedWaterStrip(anchorTile, tileset.tilesPerRow, tileset.count);
    if ("error" in built) return { ok: false, error: built.error };
    recordProjectSnapshot();
    store.update((project) => {
      const target = project.tilesets[tilesetId];
      if (!target) return;
      target.animationStrips = [...(target.animationStrips ?? []), built.strip];
    });
    return { ok: true };
  }

  const built = buildTemplateGroup(kind, anchorTile, tileset.tilesPerRow, tileset.count);
  if ("error" in built) return { ok: false, error: built.error };
  let created: string | undefined;
  recordProjectSnapshot();
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    inheritBuiltinFallbackGroups(target);
    const id = `autotile_${uniqueSuffix(target.autotileGroups ?? [])}`;
    const group: AutotileGroup = {
      id,
      name: built.name,
      neighborhood: built.neighborhood,
      memberTileIds: [...built.memberTileIds],
      connectTileIds: [...built.connectTileIds],
      variantMap: { ...built.variantMap },
    };
    target.autotileGroups = [...(target.autotileGroups ?? []), group];
    created = id;
  });
  return { ok: true, groupId: created };
}

// 내장 폴백 승계(rmTypeExpander.ts registerAutotileGroup 과 동일 규약):
// 자체 정의가 하나도 없는 타일셋이면 현재 유효한 그룹(기본 칩셋 = 내장 4종)을
// 편집 가능한 깊은 사본으로 먼저 넣는다. 비기본 타일셋은 빈 배열이라 no-op.
function inheritBuiltinFallbackGroups(tileset: TilesetDef): void {
  if (tileset.autotileGroups && tileset.autotileGroups.length > 0) return;
  tileset.autotileGroups = autotileGroupsForTileset(tileset).map((group) => ({
    ...group,
    memberTileIds: [...group.memberTileIds],
    connectTileIds: group.connectTileIds ? [...group.connectTileIds] : undefined,
    triggerTileIds: group.triggerTileIds ? [...group.triggerTileIds] : undefined,
    variantMap: { ...group.variantMap },
  }));
}

export function removeAutotileGroup(tilesetId: TilesetId, groupId: string): void {
  recordProjectSnapshot();
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset?.autotileGroups) return;
    tileset.autotileGroups = tileset.autotileGroups.filter((group) => group.id !== groupId);
    if (tileset.autotileGroups.length === 0) delete tileset.autotileGroups;
  });
}

type AutotileGroupPatch = Partial<Pick<AutotileGroup, "name" | "neighborhood" | "memberTileIds" | "connectTileIds" | "triggerTileIds" | "variantMap">>;

export function updateAutotileGroup(tilesetId: TilesetId, groupId: string, patch: AutotileGroupPatch): void {
  // patch에 "name" 같은 텍스트 필드가 오면 키 입력마다 호출될 수 있으므로 코얼레스한다.
  // 필드 조합(패치 키)이 바뀌면 다른 편집으로 간주해 새 스냅샷을 남긴다.
  recordCoalescedSnapshot(`tileset-autotile-group:${tilesetId}:${groupId}:${Object.keys(patch).sort().join(",")}`);
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
  recordProjectSnapshot();
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
  recordProjectSnapshot();
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
