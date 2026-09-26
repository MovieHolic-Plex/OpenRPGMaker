import { normalizeAtmosphereEffects } from "@/project/atmosphere";
import { normalizeMapClimate, type MapClimate } from "@/project/mapClimate";
// editor/actions.ts
// 에디터에서 Project를 갱신하는 모든 액션. store.update(mutator) 경유.
// v2: 3레이어(lower/upper/event) + tileset.passability 기반.
// EditScene/패널은 이 액션들만 호출 — 직접 Project를 쓰지 않는다(단일 진실 원천).
// 스펙 docs/specs/2026-06-18-oprn-overhaul-design.md §3.

import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { switchVariableReferenceMessage } from "@/editor/databaseReferences";
import { editorState } from "@/editor/editorState";
import type { DeleteResult } from "@/editor/databaseActions";
import { store } from "@/project/store";
import { canWriteTeamProject, TEAM_READ_ONLY_WRITE_MESSAGE } from "@/project/teamAccess";
import { createBlankMap, TILE } from "@/project/defaults";
import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import { cloneGameMap } from "@/project/mapClone";
import { clampLocationsToMapSize } from "@/project/mapNamedLocations";
import { clampMapSize, INTERIOR_FLOOR_TILE, INTERIOR_TILESET_ID, type MapCreateSpec } from "@/project/mapCreateSpec";
import { exceedsMapDimensionLimit, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import {
  appendToTree,
  canReparentMap,
  dissolveFolderKeepChildren,
  extractTreeNode,
  findParentMapId,
  findTreeNode,
  insertTreeNode,
  isMapTreeFolder,
  selectionRoots,
  siblingIndex,
} from "@/project/mapTree";
import { applyMapDeletions, planMapDeletion, planMapDeletions, type MapDeletionBatchOptions, type MapDeletionImpact } from "@/project/mapDeletion";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
import { remapExtraLayers } from "@/project/mapLayers";
export {
  eraseTile,
  eraseTilesBulk,
  eraseVisibleTile,
  eraseVisibleTilesBulk,
  fillTile,
  paintTile,
  paintTilesBulk,
  toggleCollision,
  paintRelief,
} from "@/editor/tileActions";
export type { TileStrokeCell } from "@/editor/tileActions";
import type { EncounterTableEntry, FieldSpawnDef, MapBackground, MapBgmSetting, MapCloudShadowSetting, MapId, MapMinimapSetting, TilesetDef, TroopId } from "@/project/types";

// ── 맵 CRUD ──

/**
 * 지원 상한 최종 가드. 이 세 함수(addMap/addChildMap/resizeMap)가 사람 경로의 데이터 진입점이라
 * 여기서 막으면 어떤 패널·다이얼로그를 새로 붙여도 지원 밖 크기가 프로젝트에 들어오지 못한다.
 * 조용히 클램프하지 않는 이유: 요청한 크기와 다른 맵이 생기면 사용자는 왜 작아졌는지 모른다 —
 * 상한과 회복 수단을 말하고 아무것도 만들지 않는다(OPRN-OUT-018).
 */
function allowMapSize(width: number, height: number): boolean {
  if (!exceedsMapDimensionLimit(width, height)) return true;
  toast(mapSizeLimitMessage(), "error");
  return false;
}

export function addMap(name: string, width = 16, height = 16, tilesetId?: string, fillTile?: number): MapId {
  if (!allowMapSize(width, height)) return "";
  let newId: MapId = "";
  store.update((p) => {
    const m = createBlankMap(name || "새 맵", width, height, tilesetId ?? defaultOutdoorTilesetId(p));
    if (fillTile !== undefined) m.lowerTiles.fill(fillTile);
    p.maps[m.id] = m;
    // mapTree에 루트 자식으로 추가.
    appendToTree(p.mapTree, m.id);
    newId = m.id;
  }, { scope: "project" });
  return newId;
}

type AddChildMapSize = {
  readonly height: number;
  readonly width: number;
};

export function addChildMap(parentId: MapId, name: string, size: AddChildMapSize = { width: 16, height: 16 }, tilesetId?: string, fillTile?: number): MapId {
  if (!allowMapSize(size.width, size.height)) return "";
  let newId: MapId = "";
  store.update((p) => {
    const parent = findTreeNode(p.mapTree, parentId);
    if (!p.maps[parentId] && !parent) return;
    const m = createBlankMap(name || "새 맵", size.width, size.height, tilesetId ?? defaultOutdoorTilesetId(p));
    if (fillTile !== undefined) m.lowerTiles.fill(fillTile);
    p.maps[m.id] = m;
    appendToTree(p.mapTree, m.id, parentId);
    newId = m.id;
  }, { scope: "project" });
  return newId;
}

export function createMapFromSpec(spec: MapCreateSpec): MapId {
  const width = clampMapSize(spec.width, 20);
  const height = clampMapSize(spec.height, 15);
  const name = spec.name.trim() || "새 맵";
  const fillTile = spec.preset === "interior" || spec.tilesetId === INTERIOR_TILESET_ID
    ? INTERIOR_FLOOR_TILE
    : undefined;
  if (spec.parentId) return addChildMap(spec.parentId, name, { width, height }, spec.tilesetId, fillTile);
  return addMap(name, width, height, spec.tilesetId, fillTile);
}

export function addMapFolder(parentId: MapId | "", name = "새 분류"): MapId {
  const id = genId("folder");
  store.update((p) => {
    const node = { mapId: id, kind: "folder" as const, name: name.trim() || "새 분류", children: [] };
    if (!insertTreeNode(p.mapTree, node, parentId || "", undefined)) {
      insertTreeNode(p.mapTree, node, "", undefined);
    }
  }, { scope: "project" });
  return id;
}

export function dissolveMapFolder(folderId: MapId): void {
  store.update((p) => {
    dissolveFolderKeepChildren(p.mapTree, folderId);
  }, { scope: "project" });
}

export function duplicateMap(mapId: MapId): MapId {
  let newId: MapId = "";
  store.update((p) => {
    const source = p.maps[mapId];
    if (!source) return;
    const copy = cloneGameMap(source, {
      newId: genId("map"),
      newName: `${source.name} 복사`,
      nextEventId: () => genId("ev"),
    });
    p.maps[copy.id] = copy;
    const parentId = findParentMapId(p.mapTree, mapId);
    const insertParent = parentId ?? "";
    const after = siblingIndex(p.mapTree, mapId);
    const at = after >= 0 ? after + 1 : undefined;
    if (!insertTreeNode(p.mapTree, { mapId: copy.id, children: [] }, insertParent, at)) {
      appendToTree(p.mapTree, copy.id);
    }
    newId = copy.id;
  }, { scope: "project" });
  return newId;
}

export type DeleteMapResult =
  | { readonly ok: true; readonly impact: MapDeletionImpact }
  | { readonly ok: false; readonly message: string };

// 맵 삭제(무결성 가드 — 도그푸딩 결함 ①).
// startMapId/mapTree 루트는 안전 재배선하고, 연결/이벤트 참조를 함께 정리한다.
// 삭제 결과가 재로드(shape) 검증을 통과하지 못하면 커밋하지 않는다(벽돌 원천 차단).
export function deleteMap(mapId: MapId): DeleteMapResult {
  const plan = planMapDeletion(store.getCurrent(), mapId);
  if (!plan.ok) {
    toast(plan.block.message, "error");
    return { ok: false, message: plan.block.message };
  }
  // 확인창이 "삭제 후 Ctrl+Z로 되돌릴 수 있습니다"(mapDeleteConfirm.ts:31)를 인쇄한다 —
  // 약속을 참으로 만들려면 삭제 직전 상태를 되돌리기 스택에 남겨야 한다.
  recordProjectSnapshot(`맵 삭제: ${plan.impact.mapName}`);
  store.update((p) => applyMapDeletions(p, [mapId]), { scope: "project" });
  return { ok: true, impact: plan.impact };
}

export function deleteMapsInOrder(mapIds: readonly MapId[], options?: MapDeletionBatchOptions): DeleteMapResult {
  const project = store.getCurrent();
  const remaining = mapIds.filter((mapId) => project.maps[mapId]);
  if (remaining.length === 0) return { ok: false, message: "맵을 찾을 수 없습니다." };
  // 마지막 한 장은 남긴다 — 삭제될 것이 없으면 스냅샷도 남기지 않는다.
  if (Object.keys(project.maps).length <= 1) {
    return { ok: false, message: "맵을 삭제할 수 없습니다." };
  }
  // 검증에 실패하면 적용하지 않는다. 미리보기와 재로드 검증은 묶음당 한 번이다.
  const plan = planMapDeletions(project, remaining, options);
  if (!plan.ok) return { ok: false, message: plan.block.message };
  // 재귀 삭제 문구의 "한 번의 실행 취소로"(mapDeleteConfirm.ts:39) — 묶음당 스냅샷 1건.
  const [firstTargetId] = remaining;
  recordProjectSnapshot(remaining.length === 1 && firstTargetId
    ? `맵 삭제: ${store.getCurrent().maps[firstTargetId]?.name ?? firstTargetId}`
    : `맵 ${remaining.length}개 삭제`);
  store.update((p) => {
    applyMapDeletions(p, remaining, options);
  }, { scope: "project" });
  return { ok: true, impact: plan.impact };
}

export function renameMap(mapId: MapId, name: string): void {
  const project = store.getCurrent();
  const folder = findTreeNode(project.mapTree, mapId);
  if (folder && isMapTreeFolder(folder)) {
    store.update((p) => {
      const node = findTreeNode(p.mapTree, mapId);
      if (node && isMapTreeFolder(node)) node.name = name;
    }, { scope: "project" });
    return;
  }
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const m = p.maps[mapId];
    if (m) m.name = name;
  }, { scope: "map", mapId });
}

export function resizeMap(mapId: MapId, width: number, height: number): void {
  if (!allowMapMutation(mapId)) return;
  if (!allowMapSize(width, height)) return;
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    const oldLower = m.lowerTiles;
    const oldUpper = m.upperTiles;
    const oldLowerStacks = m.lowerTileStacks;
    const oldUpperStacks = m.upperTileStacks;
    const oldW = m.width;
    const oldH = m.height;
    const newLower = new Array<number>(width * height).fill(TILE.EMPTY);
    const newUpper = new Array<number>(width * height).fill(TILE.EMPTY);
    // 빈 맵은 잔디로 채움(관례).
    if (oldLower.every((t) => t === TILE.GRASS)) {
      newLower.fill(TILE.GRASS);
    }
    const minW = Math.min(oldW, width);
    const minH = Math.min(m.height, height);
    for (let y = 0; y < minH; y++) {
      for (let x = 0; x < minW; x++) {
        newLower[y * width + x] = oldLower[y * oldW + x];
        newUpper[y * width + x] = oldUpper[y * oldW + x];
      }
    }
    remapExtraLayers(m, width, height, (target) => {
      const tx = target % width;
      const ty = Math.floor(target / width);
      return tx < minW && ty < minH ? ty * oldW + tx : -1;
    });
    m.width = width;
    m.height = height;
    m.lowerTiles = newLower;
    m.upperTiles = newUpper;
    const nextLowerStacks = resizedTileStacks(oldLowerStacks, oldW, oldH, width, height);
    const nextUpperStacks = resizedTileStacks(oldUpperStacks, oldW, oldH, width, height);
    if (nextLowerStacks) m.lowerTileStacks = nextLowerStacks;
    else delete m.lowerTileStacks;
    if (nextUpperStacks) m.upperTileStacks = nextUpperStacks;
    else delete m.upperTileStacks;
    for (const ev of m.events) {
      ev.x = Math.max(0, Math.min(width - 1, ev.x));
      ev.y = Math.max(0, Math.min(height - 1, ev.y));
    }
    if (p.startMapId === mapId) {
      p.startPos.x = Math.min(p.startPos.x, width - 1);
      p.startPos.y = Math.min(p.startPos.y, height - 1);
    }
    // 명명 로케이션은 새 크기 안으로 자르고 **지우지 않는다** — 이벤트 조건·인카운터 참조가
    // 조용히 끊기면 안 된다. 완전히 밖으로 나간 것은 경계 1×1 로 남고 lint 가 알린다.
    clampLocationsToMapSize(m, width, height);
  }, { scope: "map", mapId });
}

export function setStartMap(mapId: MapId): void {
  store.update((p) => {
    if (p.maps[mapId]) p.startMapId = mapId;
  }, { scope: "project" });
}

export function setStartPos(x: number, y: number): void {
  store.update((p) => {
    p.startPos = { x, y };
  }, { scope: "map", mapId: store.getCurrent().startMapId });
}

// 맵의 타일셋 변경(chipset 분리).
export function setMapTileset(mapId: MapId, tilesetId: TilesetDef["id"]): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const m = p.maps[mapId];
    const tileset = p.tilesets[tilesetId];
    if (m && tileset) {
      m.tilesetId = tilesetId;
      m.tileSize = tileset.tileSize;
      const state = editorState.get();
      if (state.currentMapId === mapId && state.selectedTile >= tileset.count) {
        editorState.set({ activePaletteStamp: null, selectedTile: 0 });
      }
    }
  }, { scope: "map", mapId });
}

export function setMapEncounterTable(mapId: MapId, entries: EncounterTableEntry[]): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (entries.length > 0) map.encounterTable = structuredClone(entries);
    else delete map.encounterTable;
  }, { scope: "map", mapId });
}

// 랜덤 인카운트율(스텝당 가중치). 0이면 발생하지 않는다.
export function setMapEncounterRate(mapId: MapId, rate: number): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    const normalized = Math.max(0, Math.min(100, Math.trunc(rate)));
    if (normalized > 0) map.encounterRate = normalized;
    else delete map.encounterRate;
  }, { scope: "map", mapId });
}

// 인카운터 테이블이 없을 때 균등 선택되는 트룹 목록.
export function setMapTroopIds(mapId: MapId, troopIds: TroopId[]): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (troopIds.length > 0) map.troopIds = [...troopIds];
    else delete map.troopIds;
  }, { scope: "map", mapId });
}

export function setMapFieldSpawns(mapId: MapId, spawns: FieldSpawnDef[]): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (spawns.length > 0) map.fieldSpawns = structuredClone(spawns);
    else delete map.fieldSpawns;
  }, { scope: "map", mapId });
}

// ── RM2003 스타일 맵 속성 ──

export function setMapBackground(mapId: MapId, bg: MapBackground | null): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (bg) map.background = { ...bg };
    else delete map.background;
  }, { scope: "map", mapId });
}

export function setMapBgm(mapId: MapId, bgm: MapBgmSetting | null): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (bgm) map.bgm = { ...bgm };
    else delete map.bgm;
  }, { scope: "map", mapId });
}

export function setMapBattleBackground(mapId: MapId, resourceId: string | null): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (resourceId) map.battleBackground = resourceId;
    else delete map.battleBackground;
  }, { scope: "map", mapId });
}

export function setMapFlags(mapId: MapId, flags: { disableSave?: boolean; disableTeleport?: boolean; disableEscape?: boolean }): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (flags.disableSave) map.disableSave = true; else delete map.disableSave;
    if (flags.disableTeleport) map.disableTeleport = true; else delete map.disableTeleport;
    if (flags.disableEscape) map.disableEscape = true; else delete map.disableEscape;
  }, { scope: "map", mapId });
}

export function setMapLoop(mapId: MapId, loop: import("@/project/mapLoop").MapLoop | undefined): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (loop) map.loop = loop; else delete map.loop;
  }, { scope: "map", mapId });
}

export function setMapMinimap(mapId: MapId, patch: Partial<MapMinimapSetting> | null): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (patch === null) {
      delete map.minimap;
      return;
    }
    const next: MapMinimapSetting = {
      enabled: patch.enabled ?? map.minimap?.enabled ?? false,
      ...(patch.corner !== undefined ? { corner: patch.corner } : map.minimap?.corner !== undefined ? { corner: map.minimap.corner } : {}),
      ...(patch.scale !== undefined ? { scale: patch.scale } : map.minimap?.scale !== undefined ? { scale: map.minimap.scale } : {}),
      ...(patch.showEvents !== undefined ? { showEvents: patch.showEvents } : map.minimap?.showEvents !== undefined ? { showEvents: map.minimap.showEvents } : {}),
      ...(patch.fogOfWar !== undefined ? { fogOfWar: patch.fogOfWar } : map.minimap?.fogOfWar !== undefined ? { fogOfWar: map.minimap.fogOfWar } : {}),
    };
    const hasExtra = next.corner !== undefined || next.scale !== undefined || next.showEvents !== undefined || next.fogOfWar !== undefined;
    if (!next.enabled && !hasExtra) {
      delete map.minimap;
    } else {
      map.minimap = next;
    }
  }, { scope: "map", mapId });
}

export function setMapClimate(mapId: MapId, climate: MapClimate | undefined): void {
  if (!allowMapMutation(mapId)) return;
  store.update((project) => {
    const map = project.maps[mapId];
    if (!map) return;
    const normalized = normalizeMapClimate(climate);
    if (normalized) map.climate = normalized;
    else delete map.climate;
  }, { scope: "map", mapId });
}

export function setMapAtmosphereEffects(mapId: MapId, effects: unknown): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    const normalized = normalizeAtmosphereEffects(effects);
    if (normalized.length) map.atmosphereEffects = normalized;
    else delete map.atmosphereEffects;
  }, { scope: "map", mapId });
}

export function setMapCloudShadows(mapId: MapId, patch: Partial<MapCloudShadowSetting> | null): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const map = p.maps[mapId];
    if (!map) return;
    if (patch === null) {
      delete map.cloudShadows;
      return;
    }
    const current = map.cloudShadows;
    const next: MapCloudShadowSetting = {
      enabled: patch.enabled ?? current?.enabled ?? false,
      ...(patch.amount !== undefined ? { amount: patch.amount } : current?.amount !== undefined ? { amount: current.amount } : {}),
      ...(patch.opacity !== undefined ? { opacity: patch.opacity } : current?.opacity !== undefined ? { opacity: current.opacity } : {}),
      ...(patch.speed !== undefined ? { speed: patch.speed } : current?.speed !== undefined ? { speed: current.speed } : {}),
      ...(patch.angleDeg !== undefined ? { angleDeg: patch.angleDeg } : current?.angleDeg !== undefined ? { angleDeg: current.angleDeg } : {}),
      ...(patch.scale !== undefined ? { scale: patch.scale } : current?.scale !== undefined ? { scale: current.scale } : {}),
    };
    const hasExtra = next.amount !== undefined || next.opacity !== undefined || next.speed !== undefined || next.angleDeg !== undefined || next.scale !== undefined;
    if (!next.enabled && !hasExtra) {
      delete map.cloudShadows;
    } else {
      map.cloudShadows = next;
    }
  }, { scope: "map", mapId });
}

function allowMapMutation(mapId: MapId): boolean {
  if (canEditMap(mapId)) return true;
  toast(mapEditLockNotice(mapId), "error");
  return false;
}

// ── Map Tree 조작 ──
export function moveMapInTree(mapId: MapId, newParentId: MapId | "", index?: number): void {
  moveMapsInTree([mapId], newParentId, index);
}

export function moveMapsInTree(mapIds: readonly MapId[], newParentId: MapId | "", index?: number): void {
  store.update((p) => {
    const roots = selectionRoots(p.mapTree, mapIds);
    let at = index;
    for (const mapId of roots) {
      if (!canReparentMap(p.mapTree, mapId, newParentId)) continue;
      const currentParent = findParentMapId(p.mapTree, mapId);
      const currentIndex = siblingIndex(p.mapTree, mapId);
      const extracted = extractTreeNode(p.mapTree, mapId);
      if (!extracted) continue;
      const sameParent =
        (newParentId === "" && (currentParent === p.mapTree.mapId || currentParent === null)) ||
        currentParent === newParentId ||
        (newParentId === p.mapTree.mapId && currentParent === p.mapTree.mapId);
      let insertAt = at;
      if (insertAt !== undefined && sameParent && currentIndex >= 0 && currentIndex < insertAt) insertAt -= 1;
      if (!insertTreeNode(p.mapTree, extracted, newParentId, insertAt)) {
        insertTreeNode(p.mapTree, extracted, currentParent === p.mapTree.mapId ? "" : currentParent ?? "", currentIndex);
      } else if (at !== undefined) {
        at = insertAt === undefined ? at : insertAt + 1;
      }
    }
  }, { scope: "project" });
}

// ── Database: Switches/Variables/Common Events CRUD ──
export function addSwitch(name: string): string {
  recordProjectSnapshot();
  const reusableId = store.getCurrent().switches.find((record) =>
    record.name.trim().length === 0 && !switchVariableReferenceMessage("switch", record.id)
  )?.id;
  let id = "";
  store.update((p) => {
    const empty = reusableId ? p.switches.find((record) => record.id === reusableId) : undefined;
    if (empty) {
      empty.name = name || "새 스위치";
      id = empty.id;
      return;
    }
    id = nextNumberedId("sw", p.switches);
    p.switches.push({ id, name: name || "새 스위치" });
  }, { scope: "database", collection: "switches" });
  return id;
}
export function renameSwitch(id: string, name: string): void {
  recordProjectSnapshot();
  store.update((p) => {
    const s = p.switches.find((x) => x.id === id);
    if (s) s.name = name;
  }, { scope: "database", collection: "switches" });
}
export function deleteSwitch(id: string): DeleteResult {
  if (!canWriteTeamProject()) return { ok: false, message: TEAM_READ_ONLY_WRITE_MESSAGE };
  const message = switchVariableReferenceMessage("switch", id);
  if (message) return { ok: false, message };
  recordProjectSnapshot();
  // 칸을 빼면 뒤 번호가 한 칸씩 당겨지고, 정규화(ensureSwitchVariableSlots)가 남은 세션 값을 보고
  // 같은 id 를 이름 없이 맨 끝에 다시 붙였다. 번호는 그대로 두고 이름과 값만 비운 빈 칸으로 만든다
  // — addSwitch 가 이름 없는 칸을 먼저 재사용한다.
  store.update((p) => {
    const record = p.switches.find((s) => s.id === id);
    if (record) record.name = "";
    p.session.switches[id] = false;
  }, { scope: "database", collection: "switches" });
  return { ok: true };
}

export function addVariable(name: string): string {
  recordProjectSnapshot();
  const reusableId = store.getCurrent().variables.find((record) =>
    record.name.trim().length === 0 && !switchVariableReferenceMessage("variable", record.id)
  )?.id;
  let id = "";
  store.update((p) => {
    const empty = reusableId ? p.variables.find((record) => record.id === reusableId) : undefined;
    if (empty) {
      empty.name = name || "새 변수";
      id = empty.id;
      return;
    }
    id = nextNumberedId("var", p.variables);
    p.variables.push({ id, name: name || "새 변수" });
  }, { scope: "database", collection: "variables" });
  return id;
}
export function renameVariable(id: string, name: string): void {
  recordProjectSnapshot();
  store.update((p) => {
    const v = p.variables.find((x) => x.id === id);
    if (v) v.name = name;
  }, { scope: "database", collection: "variables" });
}
export function deleteVariable(id: string): DeleteResult {
  if (!canWriteTeamProject()) return { ok: false, message: TEAM_READ_ONLY_WRITE_MESSAGE };
  const message = switchVariableReferenceMessage("variable", id);
  if (message) return { ok: false, message };
  recordProjectSnapshot();
  // deleteSwitch 와 같은 이유로 칸을 빼지 않고 비운다.
  store.update((p) => {
    const record = p.variables.find((v) => v.id === id);
    if (record) record.name = "";
    p.session.variables[id] = 0;
  }, { scope: "database", collection: "variables" });
  return { ok: true };
}

function nextNumberedId(prefix: "sw" | "var", records: readonly { readonly id: string }[]): string {
  const existingIds = new Set(records.map((record) => record.id));
  for (let index = 1; index < records.length + 10000; index += 1) {
    const id = `${prefix}_${String(index).padStart(4, "0")}`;
    if (!existingIds.has(id)) return id;
  }
  return genId(prefix);
}
