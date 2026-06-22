// editor/actions.ts
// 에디터에서 Project를 갱신하는 모든 액션. store.update(mutator) 경유.
// v2: 3레이어(lower/upper/event) + tileset.passability 기반.
// EditScene/패널은 이 액션들만 호출 — 직접 Project를 쓰지 않는다(단일 진실 원천).
// 스펙 docs/specs/2026-06-18-rm2k3-overhaul-design.md §3.

import { store } from "@/project/store";
import { createBlankMap, TILE } from "@/project/defaults";
import { genId } from "@/util/id";
import { appendToTree, removeFromTree } from "@/editor/mapTreeActions";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
export { eraseTile, fillTile, paintTile, toggleCollision } from "@/editor/tileActions";
import type { MapId, TilesetDef } from "@/project/types";

// ── 맵 CRUD ──
export function addMap(name: string, width = 16, height = 16): MapId {
  let newId: MapId = "";
  store.update((p) => {
    const m = createBlankMap(name || "새 맵", width, height);
    p.maps[m.id] = m;
    // mapTree에 루트 자식으로 추가.
    appendToTree(p.mapTree, m.id);
    newId = m.id;
  });
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
  });
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
  });
  return newId;
}

export function deleteMap(mapId: MapId): void {
  store.update((p) => {
    if (Object.keys(p.maps).length <= 1) return;
    delete p.maps[mapId];
    if (p.startMapId === mapId) {
      p.startMapId = Object.keys(p.maps)[0];
    }
    removeFromTree(p.mapTree, mapId);
  });
}

export function renameMap(mapId: MapId, name: string): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (m) m.name = name;
  });
}

export function resizeMap(mapId: MapId, width: number, height: number): void {
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
  });
}

export function setStartMap(mapId: MapId): void {
  store.update((p) => {
    if (p.maps[mapId]) p.startMapId = mapId;
  });
}

export function setStartPos(x: number, y: number): void {
  store.update((p) => {
    p.startPos = { x, y };
  });
}

// 맵의 타일셋 변경(chipset 분리).
export function setMapTileset(mapId: MapId, tilesetId: TilesetDef["id"]): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (m && p.tilesets[tilesetId]) {
      m.tilesetId = tilesetId;
      m.tileSize = p.tilesets[tilesetId].tileSize;
    }
  });
}

// ── Map Tree 조작 ──
export function moveMapInTree(mapId: MapId, newParentId: MapId): void {
  store.update((p) => {
    if (mapId === newParentId) return;
    removeFromTree(p.mapTree, mapId);
    appendToTree(p.mapTree, mapId, newParentId);
  });
}

// ── Database: Switches/Variables/Common Events CRUD ──
export function addSwitch(name: string): string {
  let id = "";
  store.update((p) => {
    id = genId("sw");
    p.switches.push({ id, name: name || "새 스위치" });
  });
  return id;
}
export function renameSwitch(id: string, name: string): void {
  store.update((p) => {
    const s = p.switches.find((x) => x.id === id);
    if (s) s.name = name;
  });
}
export function deleteSwitch(id: string): void {
  store.update((p) => {
    p.switches = p.switches.filter((s) => s.id !== id);
  });
}

export function addVariable(name: string): string {
  let id = "";
  store.update((p) => {
    id = genId("var");
    p.variables.push({ id, name: name || "새 변수" });
  });
  return id;
}
export function renameVariable(id: string, name: string): void {
  store.update((p) => {
    const v = p.variables.find((x) => x.id === id);
    if (v) v.name = name;
  });
}
export function deleteVariable(id: string): void {
  store.update((p) => {
    p.variables = p.variables.filter((v) => v.id !== id);
  });
}
