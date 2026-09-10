import { TILE } from "@/project/defaults/constants";
import { isCombinedTownTileset, isTreeTrunkTileId, isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import type { ClusterRule, GameMap, TileGroupMetadata, TilesetDef } from "@/project/types";
import { inMapBounds, type Point } from "./mapHelpers";

type ClusterRelation = "aAboveB" | "aBelowB" | "aLeftOfB" | "aRightOfB";
type Layer = "lower" | "upper";

interface HardAdjacencyContext {
  readonly a: number;
  readonly b: number;
  readonly group: TileGroupMetadata;
  readonly relation: ClusterRelation;
  readonly rule: ClusterRule;
}

interface PlannedTile {
  readonly layer: Layer;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
}

export interface HardClusterTileEdit extends PlannedTile {}

/**
 * 거부 사유의 **구조화된** 형태. 문장(`reason`)은 사람이 읽는 한 줄이고, 이것은
 * 복구 UI 가 쓰는 자료다 — 어느 규칙이 어느 동반 타일을 어느 좌표에서 요구했는지.
 * OPRN-OUT-017: 거부가 "붓이 고장 난 것처럼" 보이지 않으려면 이 세 가지가 화면에
 * 남아야 하고, 정확 배치(복구) 버튼도 원점 좌표를 알아야 한다.
 */
export interface HardClusterRejection {
  /** out-of-bounds | protected | occupied-upper | plan-conflict */
  readonly kind: "out-of-bounds" | "protected" | "occupied-upper" | "plan-conflict";
  /** 놓을 수 없었던 동반 타일 id (plan-conflict 는 나중에 계획된 쪽). */
  readonly companionTile: number;
  /** 그 동반 타일이 가야 했던 좌표. */
  readonly companionX: number;
  readonly companionY: number;
  /** 사용자가 실제로 클릭한 칸. */
  readonly originTile: number;
  readonly originX: number;
  readonly originY: number;
  /** 요구한 hard 규칙 (있으면). 원점 타일을 포함하는 규칙을 우선한다. */
  readonly ruleId?: string;
  readonly ruleMessage?: string;
  readonly groupId?: string;
  readonly groupName?: string;
}

export interface HardClusterPlacementResult {
  readonly autoTiles: number;
  readonly edits: readonly HardClusterTileEdit[];
  readonly ok: boolean;
  readonly reason?: string;
  readonly rejection?: HardClusterRejection;
}

/** 사람이 읽는 한 줄 — 규칙·동반 타일·좌표를 모두 남긴다 (수용 기준: 위반이 보여야 한다). */
export function describeHardClusterRejection(rejection: HardClusterRejection): string {
  const where = `(${rejection.companionX},${rejection.companionY})`;
  const what = `동반 타일 ${rejection.companionTile}`;
  const cause = {
    "out-of-bounds": `${what}이 맵 밖 ${where}에 놓여야 합니다`,
    protected: `${what} 자리 ${where}가 보호셀입니다`,
    "occupied-upper": `${what} 자리 ${where}의 덧그림에 다른 오브젝트가 있습니다`,
    "plan-conflict": `${what}이 ${where}에서 다른 동반 타일과 충돌합니다`,
  }[rejection.kind];
  const rule = rejection.ruleMessage ? ` — 규칙: ${rejection.ruleMessage}` : "";
  return `타일 ${rejection.originTile} (${rejection.originX},${rejection.originY}): ${cause}${rule}`;
}

export function expandHardClusterPlacement(input: {
  readonly blocked?: ReadonlySet<string>;
  readonly map: GameMap;
  readonly origin: Point;
  readonly originLayer: Layer;
  readonly tile: number;
  readonly tileset: TilesetDef;
}): HardClusterPlacementResult {
  const { blocked, map, origin, originLayer, tile, tileset } = input;
  const planned = new Map<string, PlannedTile>();
  // 각 계획 칸이 어느 규칙 때문에 생겼는지 — 거부 사유가 규칙·동반 타일·좌표를 말할 수 있게 한다.
  const causeByKey = new Map<string, HardAdjacencyContext>();
  const originPlan: PlannedTile = { layer: originLayer, tile, x: origin.x, y: origin.y };
  const add = (entry: PlannedTile, context?: HardAdjacencyContext): HardClusterRejection | null => {
    const existing = planned.get(coordKey(entry.x, entry.y));
    if (existing && (existing.tile !== entry.tile || existing.layer !== entry.layer)) {
      return rejectionFor("plan-conflict", originPlan, entry, context ?? causeByKey.get(coordKey(entry.x, entry.y)));
    }
    const isNew = existing === undefined;
    planned.set(coordKey(entry.x, entry.y), entry);
    // **처음** 이 칸을 만들어 낸 규칙을 남긴다. 나중에 같은 칸을 다시 확인하는 규칙(활엽수는
    // 한 칸이 열·행 두 규칙에 걸린다)으로 덮으면, 사람에게 위 칸을 요구한 이유가 아니라
    // 엉뚱한 옆 칸 규칙이 보인다.
    if (context && isNew) causeByKey.set(coordKey(entry.x, entry.y), context);
    return null;
  };

  const originKey = coordKey(origin.x, origin.y);
  const firstError = add(originPlan);
  if (firstError) return failed(0, firstError);
  if (tile === TILE.EMPTY) return validatePlanned(map, planned, blocked, 0, originKey, originPlan, causeByKey);

  let changed = true;
  while (changed) {
    changed = false;
    const snapshot = [...planned.values()];
    for (const entry of snapshot) {
      for (const context of hardAdjacencyContexts(tileset, entry.tile)) {
        const companion = companionFor(entry, context);
        if (!companion) continue;
        const next: PlannedTile = {
          layer: layerForClusterTile(tileset, context.group, companion.tile),
          tile: companion.tile,
          x: companion.x,
          y: companion.y,
        };
        const beforeSize = planned.size;
        const error = add(next, context);
        if (error) return failed(Math.max(0, planned.size - 1), error);
        if (planned.size > beforeSize) changed = true;
      }
    }
  }

  return validatePlanned(map, planned, blocked, Math.max(0, planned.size - 1), originKey, originPlan, causeByKey);
}

function failed(autoTiles: number, rejection: HardClusterRejection): HardClusterPlacementResult {
  return { autoTiles, edits: [], ok: false, reason: legacyReason(rejection), rejection };
}

/**
 * 기존 호출부(AI paint_tiles 요약, 토스트 본문, 회귀 테스트)가 읽는 한 줄. 문구는 바꾸지 않는다 —
 * 구조화된 `rejection` 이 추가 정보를 담고, 이 문장은 그대로 남는다.
 */
function legacyReason(rejection: HardClusterRejection): string {
  const where = `(${rejection.companionX},${rejection.companionY})`;
  switch (rejection.kind) {
    case "out-of-bounds":
      return `hard 규칙 동반 타일이 맵 경계를 벗어남: ${where}`;
    case "protected":
      return `hard 규칙 동반 타일이 보호셀과 겹침: ${where}`;
    case "occupied-upper":
      return `동반 타일 위치 ${where}의 상위 레이어에 다른 오브젝트가 있습니다`;
    case "plan-conflict":
      return `hard 규칙 동반 타일 충돌: ${where} ${rejection.companionTile}`;
  }
}

function rejectionFor(
  kind: HardClusterRejection["kind"],
  origin: PlannedTile,
  companion: PlannedTile,
  context: HardAdjacencyContext | undefined
): HardClusterRejection {
  return {
    companionTile: companion.tile,
    companionX: companion.x,
    companionY: companion.y,
    kind,
    originTile: origin.tile,
    originX: origin.x,
    originY: origin.y,
    ...(context
      ? {
        groupId: context.group.id,
        groupName: context.group.name,
        ruleId: context.rule.id,
        ruleMessage: context.rule.message,
      }
      : {}),
  };
}

export function hardClusterRuleCount(group: TileGroupMetadata): number {
  return (group.rules ?? []).filter((rule) => rule.kind === "adjacency" && rule.strength === "hard").length;
}

export function nonEmptyFootprintTileCount(input: { readonly lower: readonly number[]; readonly upper: readonly number[] }): number {
  let count = 0;
  const size = Math.max(input.lower.length, input.upper.length);
  for (let index = 0; index < size; index += 1) {
    if ((input.lower[index] ?? TILE.EMPTY) !== TILE.EMPTY || (input.upper[index] ?? TILE.EMPTY) !== TILE.EMPTY) count += 1;
  }
  return count;
}

function validatePlanned(
  map: GameMap,
  planned: ReadonlyMap<string, PlannedTile>,
  blocked: ReadonlySet<string> | undefined,
  autoTiles: number,
  originKey: string,
  origin: PlannedTile,
  causeByKey: ReadonlyMap<string, HardAdjacencyContext>
): HardClusterPlacementResult {
  for (const [key, entry] of planned.entries()) {
    const context = causeByKey.get(key);
    if (!inMapBounds(map, entry.x, entry.y)) {
      return failed(autoTiles, rejectionFor("out-of-bounds", origin, entry, context));
    }
    if (blocked?.has(coordKey(entry.x, entry.y))) {
      return failed(autoTiles, rejectionFor("protected", origin, entry, context));
    }
    // 동반 타일이 이웃 칸의 기존 상위 레이어 오브젝트(나무 꼭대기/지붕 등)를 조용히
    // 덮어쓰지 않는다 — 사용자가 직접 클릭한 원점만 덮어쓰기 허용, 같은 타일 재배치는 무해.
    if (key !== originKey && entry.layer === "upper") {
      const existing = map.upperTiles[entry.y * map.width + entry.x] ?? TILE.EMPTY;
      if (existing !== TILE.EMPTY && existing !== entry.tile) {
        return failed(autoTiles, rejectionFor("occupied-upper", origin, entry, context));
      }
    }
  }
  return { autoTiles, edits: [...planned.values()], ok: true };
}

function hardAdjacencyContexts(tileset: TilesetDef, tile: number): readonly HardAdjacencyContext[] {
  const contexts: HardAdjacencyContext[] = [];
  for (const group of tileset.tileGroups ?? []) {
    for (const rule of group.rules ?? []) {
      if (rule.kind !== "adjacency" || rule.strength !== "hard") continue;
      const params = adjacencyParams(rule.params);
      if (!params || (params.a !== tile && params.b !== tile)) continue;
      contexts.push({ ...params, group, rule });
    }
  }
  return contexts;
}

function adjacencyParams(params: Record<string, unknown>): { readonly a: number; readonly b: number; readonly relation: ClusterRelation } | null {
  const a = integerParam(params.a);
  const b = integerParam(params.b);
  const relation = relationParam(params.relation);
  return a === null || b === null || !relation ? null : { a, b, relation };
}

function companionFor(entry: PlannedTile, context: HardAdjacencyContext): { readonly tile: number; readonly x: number; readonly y: number } | null {
  if (entry.tile === context.a) {
    const point = neighbor(entry, context.relation);
    return { ...point, tile: context.b };
  }
  if (entry.tile === context.b) {
    const point = neighbor(entry, oppositeRelation(context.relation));
    return { ...point, tile: context.a };
  }
  return null;
}

function neighbor(point: Point, relation: ClusterRelation): Point {
  switch (relation) {
    case "aAboveB":
      return { x: point.x, y: point.y + 1 };
    case "aBelowB":
      return { x: point.x, y: point.y - 1 };
    case "aLeftOfB":
      return { x: point.x + 1, y: point.y };
    case "aRightOfB":
      return { x: point.x - 1, y: point.y };
  }
}

function oppositeRelation(relation: ClusterRelation): ClusterRelation {
  switch (relation) {
    case "aAboveB":
      return "aBelowB";
    case "aBelowB":
      return "aAboveB";
    case "aLeftOfB":
      return "aRightOfB";
    case "aRightOfB":
      return "aLeftOfB";
  }
}

function layerForClusterTile(tileset: TilesetDef, group: TileGroupMetadata, tile: number): Layer {
  if (isCombinedTownTileset(tileset) && isTreeTrunkTileId(tile)) return "lower";
  if (group.defaultLayer === "upper" || group.role === "prop" || isUpperOnlyOverlayTile(tileset, tile)) return "upper";
  return tileset.priority[tile] === "upper" ? "upper" : "lower";
}

function integerParam(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function relationParam(value: unknown): ClusterRelation | null {
  switch (value) {
    case "aAboveB":
    case "aBelowB":
    case "aLeftOfB":
    case "aRightOfB":
      return value;
    default:
      return null;
  }
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}
