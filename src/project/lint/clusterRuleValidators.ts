import {
  checkPlacementSurface,
  mapTerrainSurfaceProbe,
  surfaceRuleFromClusterRule,
  type SurfaceProbe,
} from "@/project/placementSurface";
import type { ClusterRule, GameMap, LintSeverity, Project, TileGroupMetadata } from "@/project/types";

export interface ClusterRuleViolationCoord {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
}

export interface ClusterRuleViolation {
  readonly rule: ClusterRule;
  readonly groupId: string;
  readonly severity: LintSeverity;
  readonly code: string;
  readonly coords: readonly ClusterRuleViolationCoord[];
}

type RuleRelation = "aAboveB" | "aBelowB" | "aLeftOfB" | "aRightOfB";
type Rect = { readonly h: number; readonly w: number; readonly x: number; readonly y: number };
type ClusterRuleInstance = {
  readonly coords: readonly ClusterRuleViolationCoord[];
  readonly rect: Rect;
};
type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type PatternPartRole = PatternGrammar["parts"][number]["role"];
type PatternOffset = {
  readonly dx: number;
  readonly dy: number;
  readonly tileIds: ReadonlySet<number>;
};

const RELATIONS: readonly RuleRelation[] = ["aAboveB", "aBelowB", "aLeftOfB", "aRightOfB"];

export function isAutotileGroup(group: TileGroupMetadata): boolean {
  const k = group.patternGrammar?.kind;
  return k === "autotile_3x3" || k === "animated_terrain";
}

export function validateClusterRules(project: Project, mapId?: string): ClusterRuleViolation[] {
  const violations: ClusterRuleViolation[] = [];
  const maps = selectedMaps(project, mapId);
  for (const map of maps) {
    const tileset = project.tilesets[map.tilesetId];
    for (const group of tileset?.tileGroups ?? []) {
      for (const rule of group.rules ?? []) {
        const violation = validateRuleOnMap(project, map, group, rule);
        if (violation) violations.push(violation);
      }
    }
  }
  for (const tileset of Object.values(project.tilesets)) {
    const mapsForTileset = maps.filter((map) => map.tilesetId === tileset.id);
    if (mapsForTileset.length === 0) continue;
    for (const group of tileset.tileGroups ?? []) {
      for (const rule of group.rules ?? []) {
        if (rule.kind !== "count" || rule.params.perMap !== false) continue;
        const violation = globalCountViolation(mapsForTileset, group, rule);
        if (violation) violations.push(violation);
      }
    }
  }
  return violations;
}

function selectedMaps(project: Project, mapId: string | undefined): readonly GameMap[] {
  if (!mapId) return Object.values(project.maps);
  const map = project.maps[mapId];
  return map ? [map] : [];
}

function validateRuleOnMap(
  project: Project,
  map: GameMap,
  group: TileGroupMetadata,
  rule: ClusterRule
): ClusterRuleViolation | null {
  if (isAutotileGroup(group) && (rule.kind === "adjacency" || rule.kind === "spacing")) {
    // 오토타일은 이웃 가장자리로 실제 타일을 산출하므로 고정 tileId 타일쌍 규칙은 거짓 위반을 만든다.
    return null;
  }
  switch (rule.kind) {
    case "adjacency":
      return adjacencyViolation(map, group, rule);
    case "spacing":
      return spacingViolation(map, group, rule);
    case "surface":
      return surfaceViolation(project, map, group, rule);
    case "count":
      if (rule.params.perMap === false) return null;
      return countViolation(map, group, rule);
  }
}

/**
 * 배치 면 위반 — 이미 찍혀 있는 인스턴스가 규칙이 요구하는 자리에 있는지 되본다.
 *
 * 여기는 **찍은 뒤**를 보므로 프로브가 보는 벽·바닥에 자기 자신이 이미 들어 있다. 그래서 두 겹으로 되돌린다.
 *
 *  1. 바탕은 `mapTerrainSurfaceProbe` — 상위 레이어(가구·소품)는 없는 것으로 본다.
 *     화덕 상단(21)처럼 벽면에 **겹쳐 세우는** 타일이 벽을 가리지 않게 한다.
 *  2. 인스턴스가 **하위 레이어**를 차지한 칸은 찍기 전 지형을 알 수 없다. 바닥으로 가정하고,
 *     그 칸에 벽 판정이 걸리면 이 인스턴스는 **판정 불가**로 두고 넘어간다(거짓 위반 금지).
 *
 * 그래서 결과는 세 갈래다: 통과 / 위반 / 판정 불가(조용히 건너뜀).
 */
function surfaceViolation(
  project: Project,
  map: GameMap,
  group: TileGroupMetadata,
  rule: ClusterRule
): ClusterRuleViolation | null {
  const surfaceRule = surfaceRuleFromClusterRule(rule);
  if (!surfaceRule) return null;
  const terrain = mapTerrainSurfaceProbe(project, map);
  const tileIds = new Set(group.tileIds);
  const coords = new Map<string, ClusterRuleViolationCoord>();
  for (const instance of groupInstances(map, group)) {
    const ownsTerrain = new Set(
      instance.coords
        .filter((coord) => hasLowerTileAt(map, coord.x, coord.y, tileIds))
        .map((coord) => `${coord.x},${coord.y}`)
    );
    let undecidable = false;
    const probe: SurfaceProbe = {
      // 자기 칸은 "찍기 전"으로 되돌려 본다 — 발밑은 바닥이었다고 본다.
      isFloor: (x, y) => ownsTerrain.has(`${x},${y}`) || terrain.isFloor(x, y),
      isWall: (x, y) => {
        if (ownsTerrain.has(`${x},${y}`)) {
          undecidable = true;
          return false;
        }
        return terrain.isWall(x, y);
      },
    };
    const check = checkPlacementSurface({ probe, rect: instance.rect, rule: surfaceRule });
    if (check.ok || undecidable) continue;
    for (const coord of instance.coords) coords.set(coordKey(coord), coord);
  }
  return coords.size > 0 ? baseViolation(group, rule, [...coords.values()]) : null;
}

function baseViolation(
  group: TileGroupMetadata,
  rule: ClusterRule,
  coords: readonly ClusterRuleViolationCoord[]
): ClusterRuleViolation {
  return {
    code: `cluster-rule:${rule.kind}:${group.id}`,
    coords,
    groupId: group.id,
    rule,
    severity: severityForStrength(rule.strength),
  };
}

function severityForStrength(strength: ClusterRule["strength"]): LintSeverity {
  switch (strength) {
    case "hard":
      return "error";
    case "medium":
      return "warning";
    case "soft":
      return "info";
  }
}

function adjacencyViolation(map: GameMap, group: TileGroupMetadata, rule: ClusterRule): ClusterRuleViolation | null {
  const params = adjacencyParams(rule.params);
  if (!params) return null;
  const coords = new Map<string, ClusterRuleViolationCoord>();
  for (const coord of tileCoords(map, params.a)) {
    const expected = neighbor(coord, params.relation);
    if (!adjacencyCompanionSatisfied(map, expected, acceptedCompanionTiles(params, "forward"))) {
      coords.set(coordKey(coord), { mapId: map.id, x: coord.x, y: coord.y });
    }
  }
  for (const coord of tileCoords(map, params.b)) {
    const expected = neighbor(coord, oppositeRelation(params.relation));
    if (!adjacencyCompanionSatisfied(map, expected, acceptedCompanionTiles(params, "reverse"))) {
      coords.set(coordKey(coord), { mapId: map.id, x: coord.x, y: coord.y });
    }
  }
  return coords.size > 0 ? baseViolation(group, rule, [...coords.values()]) : null;
}

/**
 * 이 규칙이 **동반 칸에 허용하는 타일 전체**. 정본 동반 타일이 맨 앞이고 그 뒤가 대체 타일이다.
 *
 * `bAlt` 는 「a 옆에 b 대신 와도 되는 타일」이다 — 마른나무 261 세로 스택(261 아래 261 허용,
 * 체인 끝은 291)과 활엽수 대각 겹침(293 자리에 다음 원자의 262), 긴 탁자 임의 길이
 * (326 오른쪽에 326)가 모두 이 장치를 쓴다. `aAlt` 는 역방향 검사의 대칭 짝이며
 * **역방향 검사를 건너뛸 권한이 아니다**.
 *
 * 검사기와 배치 확장기(`expandHardClusterPlacement`)가 **같은 목록**을 읽어야 한다. 예전에는
 * 확장기만 이 목록을 몰라서, 규칙이 합법이라고 말하는 배치를 손붓으로 만들 수 없었다(실측:
 * 3칸을 넘는 긴 탁자 거부, 마른나무 스택 아래 칸에 291 이 몰래 찍혀 지형 파괴).
 */
export function acceptedCompanionTiles(
  params: ClusterAdjacencyParams,
  direction: "forward" | "reverse"
): readonly number[] {
  return direction === "forward" ? [params.b, ...params.bAlt] : [params.a, ...params.aAlt];
}

/** 동반 칸이 이미 허용 타일 중 하나를 들고 있는가. 레이어를 가리지 않는다(수관 upper + 밑동 lower). */
export function adjacencyCompanionSatisfied(
  map: GameMap,
  at: { readonly x: number; readonly y: number },
  accepted: readonly number[]
): boolean {
  return isInside(map, at.x, at.y) && hasAnyTileAt(map, at.x, at.y, new Set(accepted));
}

export type ClusterAdjacencyParams = {
  readonly a: number;
  readonly b: number;
  readonly aAlt: readonly number[];
  readonly bAlt: readonly number[];
  readonly relation: RuleRelation;
};

/** 규칙 params → 검사·확장이 함께 쓰는 정규형. 잘못된 params 는 null(조용히 무시). */
export function clusterAdjacencyParams(params: Record<string, unknown>): ClusterAdjacencyParams | null {
  return adjacencyParams(params);
}

function adjacencyParams(params: Record<string, unknown>): ClusterAdjacencyParams | null {
  const a = integerParam(params.a);
  const b = integerParam(params.b);
  const relation = RELATIONS.find((candidate) => candidate === params.relation);
  if (a === null || b === null || !relation) return null;
  const bAlt = Array.isArray(params.bAlt)
    ? params.bAlt.map((value) => integerParam(value)).filter((value): value is number => value !== null)
    : [];
  const aAlt = Array.isArray(params.aAlt)
    ? params.aAlt.map((value) => integerParam(value)).filter((value): value is number => value !== null)
    : [];
  return { a, b, aAlt, bAlt, relation };
}

function neighbor(coord: ClusterRuleViolationCoord, relation: RuleRelation): { readonly x: number; readonly y: number } {
  switch (relation) {
    case "aAboveB":
      return { x: coord.x, y: coord.y + 1 };
    case "aBelowB":
      return { x: coord.x, y: coord.y - 1 };
    case "aLeftOfB":
      return { x: coord.x + 1, y: coord.y };
    case "aRightOfB":
      return { x: coord.x - 1, y: coord.y };
  }
}

function oppositeRelation(relation: RuleRelation): RuleRelation {
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

function spacingViolation(map: GameMap, group: TileGroupMetadata, rule: ClusterRule): ClusterRuleViolation | null {
  const minGap = integerParam(rule.params.minGap);
  if (minGap === null || minGap < 1) return null;
  const instances = groupInstances(map, group);
  const close = new Map<string, ClusterRuleViolationCoord>();
  for (let left = 0; left < instances.length; left += 1) {
    const leftInstance = instances[left];
    if (!leftInstance) continue;
    for (let right = left + 1; right < instances.length; right += 1) {
      const rightInstance = instances[right];
      if (!rightInstance) continue;
      if (rectGap(leftInstance.rect, rightInstance.rect) >= minGap) continue;
      for (const coord of leftInstance.coords) close.set(coordKey(coord), coord);
      for (const coord of rightInstance.coords) close.set(coordKey(coord), coord);
    }
  }
  return close.size > 0 ? baseViolation(group, rule, [...close.values()]) : null;
}

function rectGap(a: Rect, b: Rect): number {
  return Math.max(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));
}

function countViolation(map: GameMap, group: TileGroupMetadata, rule: ClusterRule): ClusterRuleViolation | null {
  return countInstancesViolation(group, rule, groupInstances(map, group));
}

function globalCountViolation(
  maps: readonly GameMap[],
  group: TileGroupMetadata,
  rule: ClusterRule
): ClusterRuleViolation | null {
  return countInstancesViolation(group, rule, maps.flatMap((map) => groupInstances(map, group)));
}

function countInstancesViolation(
  group: TileGroupMetadata,
  rule: ClusterRule,
  instances: readonly ClusterRuleInstance[]
): ClusterRuleViolation | null {
  const min = integerParam(rule.params.min);
  const max = integerParam(rule.params.max);
  if (min === null && max === null) return null;
  if (min !== null && instances.length < min) return baseViolation(group, rule, []);
  if (max !== null && instances.length > max) return baseViolation(group, rule, instances.flatMap((instance) => instance.coords));
  return null;
}

function integerParam(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function groupCoords(map: GameMap, group: TileGroupMetadata): readonly ClusterRuleViolationCoord[] {
  const tileIds = new Set(group.tileIds);
  const coords: ClusterRuleViolationCoord[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (hasAnyTileAt(map, x, y, tileIds)) coords.push({ mapId: map.id, x, y });
    }
  }
  return coords;
}

function groupInstances(map: GameMap, group: TileGroupMetadata): readonly ClusterRuleInstance[] {
  const coords = groupCoords(map, group);
  const grammar = group.patternGrammar;
  if (coords.length === 0) return [];
  if (!grammar || grammar.kind === "single" || isAutotileGroup(group)) return coords.map(singleCellInstance);
  const matched = grammarFootprintInstances(map, grammar);
  const used = new Set(matched.flatMap((instance) => instance.coords.map(coordKey)));
  const leftovers = coords.filter((coord) => !used.has(coordKey(coord))).map(singleCellInstance);
  return [...matched, ...leftovers];
}

function grammarFootprintInstances(map: GameMap, grammar: PatternGrammar): readonly ClusterRuleInstance[] {
  const offsets = grammarOffsets(grammar);
  if (offsets.length < 2) return [];
  const instances: ClusterRuleInstance[] = [];
  const used = new Set<string>();
  const maxDx = Math.max(...offsets.map((offset) => offset.dx));
  const maxDy = Math.max(...offsets.map((offset) => offset.dy));
  for (let y = 0; y < map.height - maxDy; y += 1) {
    for (let x = 0; x < map.width - maxDx; x += 1) {
      const coords = footprintCoordsAt(map, offsets, x, y);
      if (!coords) continue;
      if (coords.some((coord) => used.has(coordKey(coord)))) continue;
      for (const coord of coords) used.add(coordKey(coord));
      instances.push(instanceFromCoords(coords));
    }
  }
  return instances;
}

function footprintCoordsAt(
  map: GameMap,
  offsets: readonly PatternOffset[],
  originX: number,
  originY: number
): readonly ClusterRuleViolationCoord[] | null {
  const coords: ClusterRuleViolationCoord[] = [];
  for (const offset of offsets) {
    const x = originX + offset.dx;
    const y = originY + offset.dy;
    if (!hasAnyTileAt(map, x, y, offset.tileIds)) return null;
    coords.push({ mapId: map.id, x, y });
  }
  return coords;
}

function grammarOffsets(grammar: PatternGrammar): readonly PatternOffset[] {
  switch (grammar.kind) {
    case "vertical_expandable":
      return offsetsForRoles(grammar, [
        ["top", 0, 0],
        ["topCap", 0, 0],
        ["bottom", 0, 1],
        ["bottomCap", 0, 1],
      ]);
    case "horizontal_expandable":
      return offsetsForRoles(grammar, [
        ["left", 0, 0],
        ["leftCap", 0, 0],
        ["right", 1, 0],
        ["rightCap", 1, 0],
      ]);
    case "source_rect":
      return offsetsForRoles(grammar, [
        ["topLeft", 0, 0],
        ["topRight", 1, 0],
        ["bottomLeft", 0, 1],
        ["bottomRight", 1, 1],
      ]);
    case "nine_slice_expandable":
      return offsetsForRoles(grammar, [
        ["topLeft", 0, 0],
        ["top", 1, 0],
        ["topRight", 2, 0],
        ["left", 0, 1],
        ["center", 1, 1],
        ["right", 2, 1],
        ["bottomLeft", 0, 2],
        ["bottom", 1, 2],
        ["bottomRight", 2, 2],
      ]);
    default:
      return [];
  }
}

function offsetsForRoles(
  grammar: PatternGrammar,
  roles: readonly (readonly [PatternPartRole, number, number])[]
): readonly PatternOffset[] {
  const offsets: PatternOffset[] = [];
  const seen = new Set<string>();
  for (const [role, dx, dy] of roles) {
    const part = grammar.parts.find((candidate) => candidate.role === role);
    if (!part || part.tileIds.length === 0) continue;
    const key = `${dx},${dy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offsets.push({ dx, dy, tileIds: new Set(part.tileIds) });
  }
  return offsets;
}

function singleCellInstance(coord: ClusterRuleViolationCoord): ClusterRuleInstance {
  return { coords: [coord], rect: { h: 1, w: 1, x: coord.x, y: coord.y } };
}

function instanceFromCoords(coords: readonly ClusterRuleViolationCoord[]): ClusterRuleInstance {
  const xs = coords.map((coord) => coord.x);
  const ys = coords.map((coord) => coord.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    coords,
    rect: {
      h: Math.max(...ys) - y + 1,
      w: Math.max(...xs) - x + 1,
      x,
      y,
    },
  };
}

function tileCoords(map: GameMap, tile: number): readonly ClusterRuleViolationCoord[] {
  const coords: ClusterRuleViolationCoord[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (hasTileAt(map, x, y, tile)) coords.push({ mapId: map.id, x, y });
    }
  }
  return coords;
}

function hasAnyTileAt(map: GameMap, x: number, y: number, tileIds: ReadonlySet<number>): boolean {
  const index = y * map.width + x;
  if (tileIds.has(map.lowerTiles[index] ?? Number.NaN)) return true;
  if (tileIds.has(map.upperTiles[index] ?? Number.NaN)) return true;
  for (const tile of map.lowerTileStacks?.[index] ?? []) if (tileIds.has(tile)) return true;
  for (const tile of map.upperTileStacks?.[index] ?? []) if (tileIds.has(tile)) return true;
  return false;
}

function hasTileAt(map: GameMap, x: number, y: number, tile: number): boolean {
  return hasAnyTileAt(map, x, y, new Set([tile]));
}

/** 하위(지형) 레이어만 본다 — 배치 면 감사가 「이 칸의 지형을 이 물건이 덮었나」를 가르는 데 쓴다. */
function hasLowerTileAt(map: GameMap, x: number, y: number, tileIds: ReadonlySet<number>): boolean {
  const index = y * map.width + x;
  if (tileIds.has(map.lowerTiles[index] ?? Number.NaN)) return true;
  for (const tile of map.lowerTileStacks?.[index] ?? []) if (tileIds.has(tile)) return true;
  return false;
}

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function coordKey(coord: ClusterRuleViolationCoord): string {
  return `${coord.mapId}:${coord.x},${coord.y}`;
}
