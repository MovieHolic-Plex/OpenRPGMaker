// editor/actions.ts
// 에디터에서 Project를 갱신하는 모든 액션. store.update(mutator) 경유.
// v2: 3레이어(lower/upper/event) + tileset.passability 기반.
// EditScene/패널은 이 액션들만 호출 — 직접 Project를 쓰지 않는다(단일 진실 원천).
// 스펙 docs/specs/2026-06-18-rm2k3-overhaul-design.md §3.

import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { switchVariableReferenceMessage } from "@/editor/databaseReferences";
import { editorState } from "@/editor/editorState";
import type { DeleteResult } from "@/editor/databaseActions";
import { store } from "@/project/store";
import { createBlankMap, TILE } from "@/project/defaults";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import { appendToTree, removeFromTree } from "@/editor/mapTreeActions";
import { applyMapDeletion, planMapDeletion, type MapDeletionImpact } from "@/project/mapDeletion";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
export {
  eraseTile,
  eraseTilesBulk,
  eraseVisibleTile,
  eraseVisibleTilesBulk,
  fillTile,
  paintTile,
  paintTilesBulk,
  toggleCollision,
} from "@/editor/tileActions";
export type { TileStrokeCell } from "@/editor/tileActions";
import type { EncounterTableEntry, FieldSpawnDef, MapBackground, MapBgmSetting, MapId, MapMinimapSetting, TilesetDef, TroopId } from "@/project/types";

// ── 맵 CRUD ──
export function addMap(name: string, width = 16, height = 16): MapId {
  let newId: MapId = "";
  store.update((p) => {
    const m = createBlankMap(name || "새 맵", width, height);
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

export function addChildMap(parentId: MapId, name: string, size: AddChildMapSize = { width: 16, height: 16 }): MapId {
  let newId: MapId = "";
  store.update((p) => {
    if (!p.maps[parentId]) return;
    const m = createBlankMap(name || "새 맵", size.width, size.height);
    p.maps[m.id] = m;
    appendToTree(p.mapTree, m.id, parentId);
    newId = m.id;
  }, { scope: "project" });
  return newId;
}

export function duplicateMap(mapId: MapId): MapId {
  let newId: MapId = "";
  store.update((p) => {
    const source = p.maps[mapId];
    if (!source) return;
    const copy = createBlankMap(`${source.name} 복사`, source.width, source.height, source.tilesetId, source.tileSize);
    copy.lowerTiles = [...source.lowerTiles];
    copy.upperTiles = [...source.upperTiles];
    copy.events = structuredClone(source.events);
    if (source.lowerTileStacks) copy.lowerTileStacks = structuredClone(source.lowerTileStacks);
    if (source.upperTileStacks) copy.upperTileStacks = structuredClone(source.upperTileStacks);
    p.maps[copy.id] = copy;
    appendToTree(p.mapTree, copy.id, mapId);
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
  store.update((p) => applyMapDeletion(p, mapId), { scope: "project" });
  return { ok: true, impact: plan.impact };
}

export function renameMap(mapId: MapId, name: string): void {
  if (!allowMapMutation(mapId)) return;
  store.update((p) => {
    const m = p.maps[mapId];
    if (m) m.name = name;
  }, { scope: "map", mapId });
}

export function resizeMap(mapId: MapId, width: number, height: number): void {
  if (!allowMapMutation(mapId)) return;
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

function allowMapMutation(mapId: MapId): boolean {
  if (canEditMap(mapId)) return true;
  toast(mapEditLockNotice(mapId), "error");
  return false;
}

// ── Map Tree 조작 ──
export function moveMapInTree(mapId: MapId, newParentId: MapId): void {
  store.update((p) => {
    if (mapId === newParentId) return;
    removeFromTree(p.mapTree, mapId);
    appendToTree(p.mapTree, mapId, newParentId);
  }, { scope: "project" });
}

// ── Database: Switches/Variables/Common Events CRUD ──
export function addSwitch(name: string): string {
  recordProjectSnapshot();
  let id = "";
  store.update((p) => {
    const empty = p.switches.find((record) => record.name.trim().length === 0);
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
  const message = switchVariableReferenceMessage("switch", id);
  if (message) return { ok: false, message };
  recordProjectSnapshot();
  store.update((p) => {
    p.switches = p.switches.filter((s) => s.id !== id);
  }, { scope: "database", collection: "switches" });
  return { ok: true };
}

export function addVariable(name: string): string {
  recordProjectSnapshot();
  let id = "";
  store.update((p) => {
    const empty = p.variables.find((record) => record.name.trim().length === 0);
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
  const message = switchVariableReferenceMessage("variable", id);
  if (message) return { ok: false, message };
  recordProjectSnapshot();
  store.update((p) => {
    p.variables = p.variables.filter((v) => v.id !== id);
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
