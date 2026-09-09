import type { AuthorVillageRequest, ConstructionRect } from "@/editor/construction/contracts";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, MapTreeNode, Project, TileGraft, TilesetDef } from "@/project/types";
import type { VillageFacadeState } from "./authorVillageSupport";
import { ToolError } from "./types";
import { spatialConstructionEnvelope, spatialReachableMaps } from "./spatialConstructionScope";

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
  assertLivedMapScope(state);
  const allowedAdded = allowedAddedMapIds(state);
  assertMapSetAndContents(state, allowedAdded);
  assertMapTree(state, allowedAdded);
  assertStart(state);
  assertProjectCore(state);
  assertTilesets(state);
  return unboundedExistingTargetWarnings(state);
}

/**
 * 살아 있는 기존 맵의 전체 재포장 차단. 맵에 이미 저작 내용(비기본 타일·이벤트·문구가 아닌 이름)이
 * 있으면 bounds 또는 fullMap:true 없이는 거부한다(village-requires-scope).
 * 빈 맵은 그대로 전체 시공된다 — 새 마을 짓기가 기본 흐름이라서.
 */
function assertLivedMapScope(state: VillageFacadeState): void {
  const { baseline, request } = state;
  if (request.target.kind !== "existing") return;
  if (request.target.bounds || request.target.fullMap === true) return;
  const before = baseline.maps[request.target.mapId];
  if (!before) return;
  if (!isLivedMap(before)) return;
  throw new ToolError(
    `기존 맵 ${before.id}에 이미 저작 내용이 있어 전체 재시공이 거부됐습니다 — ` +
      "일부만 손보려면 target.bounds 에 그 영역을, 맵 전체를 새로 깔려면 target.fullMap:true 를 지정하세요.",
    { code: "village-requires-scope", mapId: before.id },
  );
}

function isLivedMap(map: GameMap): boolean {
  if (map.events.length > 0) return true;
  // 기본 풀(GRASS/EMPTY) 아닌 타일이 하나라도 있으면 손댄 맵이다.
  for (let i = 0; i < map.lowerTiles.length; i += 1) {
    if (map.lowerTiles[i] !== TILE.GRASS) return true;
  }
  for (let i = 0; i < map.upperTiles.length; i += 1) {
    if (map.upperTiles[i] !== TILE.EMPTY) return true;
  }
  return false;
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
  const { baseline, draft, request, inspection } = state;
  // 독립 관측: 실제로 생긴 맵 집합은 베이스라인 diff에서 구한다 — 빌더 자기신고가 아니라.
  // inspection.interiorMapIds에 있지만 diff에 없는 id는 빌더 보고 오류로 거부한다.
  const actuallyAdded = new Set<string>();
  for (const mapId of Object.keys(draft.maps)) {
    if (!baseline.maps[mapId]) actuallyAdded.add(mapId);
  }
  const declared = new Set(inspection.interiorMapIds);
  if (request.target.kind === "new") declared.add(request.target.mapId);
  for (const id of actuallyAdded) {
    if (id === request.target.mapId) continue;
    // 실내 맵은 문 이벤트의 transfer 명령이 실제로 가리켜야 한다 — 그래야 "실내"다.
    if (!declared.has(id) || !isLinkedInteriorMap(draft, request.target.mapId, id)) {
      scopeError(`Village added an undeclared map: ${id}.`, id);
    }
  }
  for (const id of declared) {
    if (id === request.target.mapId) continue;
    if (!actuallyAdded.has(id) && !baseline.maps[id]) {
      scopeError(`Village declared a map it did not create: ${id}.`, id);
    }
    if (baseline.maps[id]) {
      scopeError(`Village declared a pre-existing map as an interior: ${id}.`, id);
    }
  }
  const ids = new Set(declared);
  for (const id of actuallyAdded) ids.add(id);
  return ids;
}

/** 타깃 맵의 문 이벤트 transfer 명령이 interiorId를 가리키는가. */
function isLinkedInteriorMap(draft: Project, exteriorMapId: string, interiorMapId: string): boolean {
  if (draft.spatialAuthoring !== undefined) return spatialReachableMaps(draft, exteriorMapId).has(interiorMapId);
  const exterior = draft.maps[exteriorMapId];
  return (exterior?.events ?? []).some(event => (event.pages ?? []).some(page => page.commands.some(command => command.kind === "transfer" && command.mapId === interiorMapId)));
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
  const envelope = spatialConstructionEnvelope(state.baseline, state.draft, state.inspection.interiorMapIds);
  if (!same(projectCore(state.baseline), projectCore(envelope))) {
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
  const { lowerTiles: _lower, upperTiles: _upper, events: _events, layoutPlan: _plan, villageDesignSource: _design, ...descriptor } = map;
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
  return stableStringify(left) === stableStringify(right);
}

/**
 * 키 순서에 흔들리지 않는 직렬화 — 스코프 검사용. JSON.stringify는 키 삽입 순서에 따라
 * 같은 내용도 다르게 뱉어 거짓 스코프 위반을 만든다. undefined·함수 값은 JSON 규칙대로 생략.
 * 순환 참조는 스코프 대상(project/map/event)에 없으므로 throw되면 그대로 실패가 맞다.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? "undefined" : encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",");
  return `{${body}}`;
}

function scopeError(message: string, mapId?: string): never {
  throw new ToolError(message, { code: "village-scope-violation", ...(mapId ? { mapId } : {}) });
}
