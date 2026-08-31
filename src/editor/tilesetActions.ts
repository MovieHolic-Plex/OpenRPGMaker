import { store } from "@/project/store";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, TEX_TILESET, TILE_FRAME_COUNT } from "@/assets/bundled";
import { isValidTileGraft, rowAlignedTileCount } from "@/assets/tileGrafts";
import { cloneDefaultAutotileGroups, autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { buildEdgeCornerVariantMap, type EdgeCornerTileSet } from "@/project/defaults/autotileEngine";
import {
  buildAnimatedWaterStrip,
  buildTemplateGroup,
  type AutotileTemplateKind,
} from "@/editor/panels/tilesetAutotileTemplates";
import type { AutotileGroup, PassFlag, TileAiMetadata, TileGraft, TilesetDef, TilesetId } from "@/project/types";
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

// ── 타일 이식(tile graft) ──────────────────────────────────────────
// 다른 번들 타일 그림판의 개별 타일을 이 타일셋 슬롯에 이식한다. 넘버링 보존:
// - targetTile < count: 기존 슬롯 덮어쓰기(예: 밴 슬롯 411/412/413/443 재활용).
// - targetTile >= count: 행 단위 확장 — count 가 tilesPerRow 배수로 늘고
//   passability/priority/terrain(/tileMeta) 배열도 함께 늘린다(기본 통과/lower/0).
// 텍스처 캐시 무효화는 tilesetTextureKey 의 graft 해시 suffix 가 담당한다.

export type TileGraftActionResult = { ok: true } | { ok: false; error: string };

export function addTileGraft(tilesetId: TilesetId, graft: TileGraft): TileGraftActionResult {
  if (!isValidTileGraft(graft)) {
    return { ok: false, error: "타일 이식 정보가 잘못되었습니다 (targetTile/sourceTile ≥ 0 정수, sourceChipset 필요)." };
  }
  if (!isKnownGraftSourceChipset(graft.sourceChipset)) {
    return { ok: false, error: `알 수 없는 소스 타일 그림판입니다: ${graft.sourceChipset}` };
  }
  const current = store.getCurrent().tilesets[tilesetId];
  if (!current) return { ok: false, error: `타일셋을 찾을 수 없습니다: ${tilesetId}` };
  if (graft.sourceTile >= TILE_FRAME_COUNT) {
    return { ok: false, error: `sourceTile 은 0~${TILE_FRAME_COUNT - 1} 이어야 합니다.` };
  }
  recordProjectSnapshot();
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    if (graft.targetTile >= tileset.count) {
      extendTilesetToRowAlignedCount(tileset, rowAlignedTileCount(graft.targetTile + 1, tileset.tilesPerRow));
    }
    const next: TileGraft = {
      targetTile: graft.targetTile,
      sourceChipset: graft.sourceChipset,
      sourceTile: graft.sourceTile,
    };
    tileset.tileGrafts = [...(tileset.tileGrafts ?? []).filter((entry) => entry.targetTile !== graft.targetTile), next];
    // 이식으로 덮인 슬롯의 낡은 시맨틱 라벨(하네스 등)이 남지 않게 출처를 라벨로 남긴다.
    stampGraftTileMeta(tileset, next);
  });
  return { ok: true };
}

export function removeTileGraft(tilesetId: TilesetId, targetTile: number): TileGraftActionResult {
  const current = store.getCurrent().tilesets[tilesetId];
  if (!current) return { ok: false, error: `타일셋을 찾을 수 없습니다: ${tilesetId}` };
  const removed = (current.tileGrafts ?? []).find((entry) => entry.targetTile === targetTile);
  if (!removed) return { ok: false, error: `이식이 없는 타일입니다: ${targetTile}` };
  recordProjectSnapshot();
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset?.tileGrafts) return;
    tileset.tileGrafts = tileset.tileGrafts.filter((entry) => entry.targetTile !== targetTile);
    if (tileset.tileGrafts.length === 0) delete tileset.tileGrafts;
    clearGraftTileMeta(tileset, removed);
    shrinkTilesetAfterGraftRemoval(tileset);
  });
  return { ok: true };
}

function isKnownGraftSourceChipset(textureKey: string): boolean {
  return textureKey === TEX_TILESET || BUNDLED_EASYRPG_CHIPSET_ASSETS.some((asset) => asset.textureKey === textureKey);
}

// 확장 모드: count 와 count 길이에 의존하는 배열들을 함께 늘린다(직렬화 검증 일관성).
function extendTilesetToRowAlignedCount(tileset: TilesetDef, newCount: number): void {
  if (newCount <= tileset.count) return;
  while (tileset.passability.length < newCount) {
    tileset.passability.push({ up: true, down: true, left: true, right: true });
  }
  while (tileset.priority.length < newCount) tileset.priority.push("lower");
  while (tileset.terrain.length < newCount) tileset.terrain.push(0);
  if (tileset.tileMeta) {
    while (tileset.tileMeta.length < newCount) {
      tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
    }
  }
  tileset.count = newCount;
}

// 확장분에 남은 graft 가 없으면 count 를 다시 줄인다(번들 타일 그림판 기본 480 밑으로는 안 내려감).
function shrinkTilesetAfterGraftRemoval(tileset: TilesetDef): void {
  if (tileset.image.type !== "bundled" || tileset.count <= TILE_FRAME_COUNT) return;
  const maxTarget = (tileset.tileGrafts ?? []).reduce((max, entry) => Math.max(max, entry.targetTile), -1);
  const newCount = Math.max(TILE_FRAME_COUNT, rowAlignedTileCount(maxTarget + 1, tileset.tilesPerRow));
  if (newCount >= tileset.count) return;
  tileset.passability.length = newCount;
  tileset.priority.length = newCount;
  tileset.terrain.length = newCount;
  if (tileset.tileMeta) tileset.tileMeta.length = Math.min(tileset.tileMeta.length, newCount);
  tileset.count = newCount;
}

function stampGraftTileMeta(tileset: TilesetDef, graft: TileGraft): void {
  ensureTileMetaLength(tileset);
  const existing = tileset.tileMeta![graft.targetTile];
  tileset.tileMeta![graft.targetTile] = {
    ...(existing ?? { description: "" }),
    label: graftTileMetaLabel(graft),
    description: existing?.description ?? "",
    source: "user",
  };
}

function clearGraftTileMeta(tileset: TilesetDef, removed: TileGraft): void {
  const meta = tileset.tileMeta?.[removed.targetTile];
  if (!meta || meta.label !== graftTileMetaLabel(removed)) return;
  const next: TileAiMetadata = { ...meta, label: "", source: "unknown" };
  tileset.tileMeta![removed.targetTile] = next;
}

function graftTileMetaLabel(graft: TileGraft): string {
  return `이식: ${graft.sourceChipset}#${graft.sourceTile}`;
}

function ensureTileMetaLength(tileset: TilesetDef): void {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
  }
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
// - 오토타일 템플릿(oprn-3x4/grid-3x3/grid-3x2): buildTemplateGroup 결과를 autotileGroups 에 push.
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

// 이미 있는 그룹의 타일 블록을 템플릿으로 다시 채운다. 이름·id 는 유지.
export function applyAutotileTemplateToGroup(
  tilesetId: TilesetId,
  groupId: string,
  kind: AutotileTemplateKind,
  anchorTile: number,
): AutotileTemplateActionResult {
  if (kind === "animated-water") {
    return addAutotileGroupFromTemplate(tilesetId, kind, anchorTile);
  }
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) return { ok: false, error: "타일셋을 찾을 수 없습니다." };
  const group = tileset.autotileGroups?.find((entry) => entry.id === groupId);
  if (!group) return { ok: false, error: "내장 그룹은 복제한 뒤에 블록을 바꿀 수 있습니다." };
  const built = buildTemplateGroup(kind, anchorTile, tileset.tilesPerRow, tileset.count);
  if ("error" in built) return { ok: false, error: built.error };
  recordProjectSnapshot();
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    const current = target?.autotileGroups?.find((entry) => entry.id === groupId);
    if (!current) return;
    current.neighborhood = built.neighborhood;
    current.memberTileIds = [...built.memberTileIds];
    current.connectTileIds = [...built.connectTileIds];
    current.variantMap = { ...built.variantMap };
  }, { scope: "project", label: "오토타일 블록 적용" });
  return { ok: true, groupId };
}

// 내장 폴백 승계(rmTypeExpander.ts registerAutotileGroup 과 동일 규약):
// 자체 정의가 하나도 없는 타일셋이면 현재 유효한 그룹(기본 타일 그림판 = 내장 4종)을
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
