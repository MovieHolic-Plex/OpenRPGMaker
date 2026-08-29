import type { AuthorVillageRequest, ConstructionRect } from "@/editor/construction/contracts";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, MapTreeNode, Project, TileGraft, TilesetDef } from "@/project/types";
import type { VillageFacadeState } from "./authorVillageSupport";
import { ToolError } from "./types";

const INN_SIGN_GRAFT: TileGraft = {
  targetTile: 443,
  sourceChipset: "tex_easyrpg_chipset_retro_house",
  sourceTile: 443,
};

export function restoreExistingTargetStart(
  baseline: Project,
  draft: Project,
  request: AuthorVillageRequest,
): void {
  if (request.target.kind !== "existing") return;
  draft.startMapId = baseline.startMapId;
  draft.startPos = { ...baseline.startPos };
  const beforeMap = baseline.maps[baseline.startMapId];
  const afterMap = draft.maps[baseline.startMapId];
  if (!beforeMap || !afterMap || isPassable(draft, afterMap, baseline.startPos.x, baseline.startPos.y)) return;
  const index = baseline.startPos.y * afterMap.width + baseline.startPos.x;
  afterMap.lowerTiles[index] = beforeMap.lowerTiles[index] ?? TILE.GRASS;
  afterMap.upperTiles[index] = beforeMap.upperTiles[index] ?? TILE.EMPTY;
}

/**
 * 마을 저작이 선언한 범위를 넘어섰는지 검사한다. 위반이면 throw, 허용되지만 알려야 하는
 * 광범위 변경은 경고 문자열로 돌려준다(호출자가 툴 결과 warnings 에 실어 보낸다).
 */
export function assertVillageMutationScope(state: VillageFacadeState): readonly string[] {
  const allowedAdded = allowedAddedMapIds(state);
  assertMapSetAndContents(state, allowedAdded);
  assertMapTree(state, allowedAdded);
  assertStart(state);
  assertProjectCore(state);
  assertTilesets(state);
  return unboundedExistingTargetWarnings(state);
}

/**
 * `target:{kind:"existing"}` + `bounds` 생략 = **타깃 맵 전면 재포장**이 스코프 검사를 통과한다
 * (2026-08-29 modify 진단 근본원인 10). `assertTilesWithinBounds` 는 bounds 가 있을 때만 돌고,
 * `assertMapSetAndContents` 는 타깃 맵 *이외* 만 보호한다.
 *
 * bounds 를 required 로 올리면 기존 호출(정당한 전체 재시공 포함)이 전부 깨지므로, 대신 실제로
 * 바뀐 셀의 bbox 를 계산해 무엇을 얼마나 덮었는지 실수치로 알린다 — 모델이 다음 턴에 bounds 를
 * 붙일 유인이 되고, 사용자는 결과 카드에서 범위를 본다.
 */
function unboundedExistingTargetWarnings(state: VillageFacadeState): readonly string[] {
  const { baseline, draft, request } = state;
  if (request.target.kind !== "existing" || request.target.bounds) return [];
  const before = baseline.maps[request.target.mapId];
  const after = draft.maps[request.target.mapId];
  if (!before || !after) return [];
  const box = changedTileBounds(before, after);
  if (!box) return [];
  const coverage = Math.round((box.changed / (after.width * after.height)) * 100);
  return [
    `bounds 를 생략해 기존 맵 ${after.id} 전체가 시공 범위였습니다 — 실제 변경 `
      + `${box.changed}칸(맵의 ${coverage}%), bbox (${box.x},${box.y}) ${box.w}×${box.h}. `
      + `일부만 손보려면 target.bounds 에 그 영역을 지정하세요.`,
  ];
}

function changedTileBounds(
  before: GameMap,
  after: GameMap,
): { x: number; y: number; w: number; h: number; changed: number } | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let changed = 0;
  for (let index = 0; index < after.lowerTiles.length; index += 1) {
    if (before.lowerTiles[index] === after.lowerTiles[index] && before.upperTiles[index] === after.upperTiles[index]) {
      continue;
    }
    const x = index % after.width;
    const y = Math.floor(index / after.width);
    changed += 1;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (changed === 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, changed };
}

function allowedAddedMapIds(state: VillageFacadeState): ReadonlySet<string> {
  const { baseline, request, inspection } = state;
  const ids = new Set(inspection.interiorMapIds);
  if (request.target.kind === "new") ids.add(request.target.mapId);
  for (const id of inspection.interiorMapIds) {
    if (id === request.target.mapId || baseline.maps[id]) {
      scopeError(`Village declared a pre-existing map as an interior: ${id}.`, id);
    }
  }
  return ids;
}

function assertMapSetAndContents(state: VillageFacadeState, allowedAdded: ReadonlySet<string>): void {
  const { baseline, draft, request } = state;
  for (const [mapId, before] of Object.entries(baseline.maps)) {
    const after = draft.maps[mapId];
    if (!after) scopeError(`Village removed an undeclared map: ${mapId}.`, mapId);
    if (mapId !== request.target.mapId && !same(before, after)) {
      scopeError(`Village modified an undeclared map: ${mapId}.`, mapId);
    }
  }
  for (const mapId of Object.keys(draft.maps)) {
    if (!baseline.maps[mapId] && !allowedAdded.has(mapId)) {
      scopeError(`Village added an undeclared map: ${mapId}.`, mapId);
    }
  }
  const target = draft.maps[request.target.mapId];
  if (!target) scopeError(`Village target is missing: ${request.target.mapId}.`, request.target.mapId);
  if (request.target.kind === "existing") assertExistingTarget(state, target);
  for (const mapId of allowedAdded) assertEventsInMap(draft.maps[mapId], mapId);
}

function assertExistingTarget(state: VillageFacadeState, after: GameMap): void {
  const { baseline, request } = state;
  if (request.target.kind !== "existing") return;
  const before = baseline.maps[request.target.mapId];
  if (!before) scopeError(`Village target baseline is missing: ${request.target.mapId}.`, request.target.mapId);
  if (!same(mapDescriptor(before), mapDescriptor(after))) {
    scopeError("Village changed the target map descriptor.", after.id);
  }
  const bounds = request.target.bounds;
  if (bounds) assertTilesWithinBounds(before, after, bounds);
  assertChangedEventsWithinBounds(before, after, bounds ?? mapBounds(after));
  assertEventsInMap(after, after.id);
}

function assertTilesWithinBounds(before: GameMap, after: GameMap, bounds: ConstructionRect): void {
  for (let index = 0; index < after.lowerTiles.length; index += 1) {
    const x = index % after.width;
    const y = Math.floor(index / after.width);
    if (!contains(bounds, x, y)
      && (before.lowerTiles[index] !== after.lowerTiles[index] || before.upperTiles[index] !== after.upperTiles[index])) {
      throw new ToolError("Village wrote outside the requested bounds.", {
        code: "village-outside-bounds",
        mapId: after.id,
        x,
        y,
      });
    }
  }
}

function assertChangedEventsWithinBounds(before: GameMap, after: GameMap, bounds: ConstructionRect): void {
  const beforeEvents = new Map(before.events.map((event) => [event.id, event]));
  const afterEvents = new Map(after.events.map((event) => [event.id, event]));
  const ids = new Set([...beforeEvents.keys(), ...afterEvents.keys()]);
  for (const id of ids) {
    const oldEvent = beforeEvents.get(id);
    const newEvent = afterEvents.get(id);
    if (same(oldEvent, newEvent)) continue;
    if ((oldEvent && !contains(bounds, oldEvent.x, oldEvent.y))
      || (newEvent && !contains(bounds, newEvent.x, newEvent.y))) {
      scopeError(`Village changed event '${id}' outside the requested bounds.`, after.id);
    }
  }
}

function assertEventsInMap(map: GameMap | undefined, mapId: string): void {
  if (!map) scopeError(`Declared village map is missing: ${mapId}.`, mapId);
  for (const event of map.events) {
    if (!eventInMap(event, map)) scopeError(`Village event '${event.id}' is outside map bounds.`, mapId);
  }
}

function assertMapTree(state: VillageFacadeState, allowedAdded: ReadonlySet<string>): void {
  const { baseline, draft } = state;
  const baselineHasRoot = baseline.maps[baseline.mapTree.mapId] !== undefined;
  if (baselineHasRoot) {
    const retained = stripAddedNodes(draft.mapTree, allowedAdded);
    if (!retained || !same(retained, baseline.mapTree)) scopeError("Village changed the existing map tree.");
  } else {
    const undeclared = collectTreeIds(draft.mapTree).find((mapId) => !allowedAdded.has(mapId));
    if (undeclared) scopeError(`Village added an undeclared map-tree node: ${undeclared}.`, undeclared);
  }
  const treeIds = new Set(collectTreeIds(draft.mapTree));
  for (const mapId of allowedAdded) {
    if (!treeIds.has(mapId)) scopeError(`Village map is absent from the map tree: ${mapId}.`, mapId);
  }
}

function stripAddedNodes(node: MapTreeNode, added: ReadonlySet<string>): MapTreeNode | undefined {
  const children = node.children.flatMap((child) => {
    const retained = stripAddedNodes(child, added);
    return retained ? [retained] : child.children.flatMap((grandchild) => {
      const retainedGrandchild = stripAddedNodes(grandchild, added);
      return retainedGrandchild ? [retainedGrandchild] : [];
    });
  });
  return added.has(node.mapId) ? undefined : { mapId: node.mapId, children };
}

function assertStart(state: VillageFacadeState): void {
  const { baseline, draft, request } = state;
  if (request.target.kind === "new") {
    const target = draft.maps[request.target.mapId];
    const pointIsValid = target !== undefined
      && Number.isInteger(draft.startPos.x)
      && Number.isInteger(draft.startPos.y)
      && contains(mapBounds(target), draft.startPos.x, draft.startPos.y)
      && isPassable(draft, target, draft.startPos.x, draft.startPos.y);
    if (draft.startMapId !== request.target.mapId || !pointIsValid) {
      scopeError("Village placed the project start outside its new target.", draft.startMapId);
    }
    return;
  }
  if (draft.startMapId !== baseline.startMapId || !same(draft.startPos, baseline.startPos)) {
    scopeError("Village changed the existing project start.", draft.startMapId);
  }
}

function assertProjectCore(state: VillageFacadeState): void {
  if (!same(projectCore(state.baseline), projectCore(state.draft))) {
    scopeError("Village changed undeclared project data.");
  }
}

function assertTilesets(state: VillageFacadeState): void {
  const { baseline, draft, request } = state;
  const targetTilesetId = draft.maps[request.target.mapId]?.tilesetId;
  if (!same(Object.keys(baseline.tilesets).sort(), Object.keys(draft.tilesets).sort())) {
    scopeError("Village changed the tileset set.");
  }
  for (const [tilesetId, before] of Object.entries(baseline.tilesets)) {
    const after = draft.tilesets[tilesetId];
    if (!after) scopeError(`Village removed tileset '${tilesetId}'.`);
    if (tilesetId !== targetTilesetId && !same(before, after)) {
      scopeError(`Village changed undeclared tileset '${tilesetId}'.`);
    }
    if (tilesetId === targetTilesetId && !allowedTargetTilesetChange(before, after)) {
      scopeError(`Village changed undeclared target tileset data '${tilesetId}'.`);
    }
  }
}

function allowedTargetTilesetChange(before: TilesetDef, after: TilesetDef): boolean {
  const beforeGrafts = before.tileGrafts ?? [];
  const afterGrafts = after.tileGrafts ?? [];
  const canAppendInnSign = !beforeGrafts.some((graft) => graft.targetTile === INN_SIGN_GRAFT.targetTile);
  return same(tilesetCore(before), tilesetCore(after))
    && (same(beforeGrafts, afterGrafts) || (canAppendInnSign && same([...beforeGrafts, INN_SIGN_GRAFT], afterGrafts)));
}

function mapDescriptor(map: GameMap) {
  const { lowerTiles: _lower, upperTiles: _upper, events: _events, layoutPlan: _plan, ...descriptor } = map;
  return descriptor;
}

function projectCore(project: Project) {
  const { maps: _maps, mapTree: _tree, startMapId: _start, startPos: _pos, tilesets: _tilesets, ...core } = project;
  return core;
}

function tilesetCore(tileset: TilesetDef) {
  const { tileGrafts: _grafts, ...core } = tileset;
  return core;
}

function collectTreeIds(node: MapTreeNode): string[] {
  return [node.mapId, ...node.children.flatMap(collectTreeIds)];
}

function contains(bounds: ConstructionRect, x: number, y: number): boolean {
  return x >= bounds.x && y >= bounds.y && x < bounds.x + bounds.w && y < bounds.y + bounds.h;
}

function mapBounds(map: GameMap): ConstructionRect {
  return { x: 0, y: 0, w: map.width, h: map.height };
}

function eventInMap(event: GameEvent, map: GameMap): boolean {
  return Number.isInteger(event.x) && Number.isInteger(event.y) && contains(mapBounds(map), event.x, event.y);
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function scopeError(message: string, mapId?: string): never {
  throw new ToolError(message, { code: "village-scope-violation", ...(mapId ? { mapId } : {}) });
}
