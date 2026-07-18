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
        const violation = validateRuleOnMap(map, group, rule);
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
    case "count":
      if (rule.params.perMap === false) return null;
      return countViolation(map, group, rule);
  }
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
    // bAlt: a 옆에 b 대신 와도 되는 대체 타일(예: 마른나무 261 세로 스택 — 261 아래 261 허용, 체인 끝은 291).
    const ok = isInside(map, expected.x, expected.y)
      && (hasTileAt(map, expected.x, expected.y, params.b)
        || params.bAlt.some((alt) => hasTileAt(map, expected.x, expected.y, alt)));
    if (!ok) {
      coords.set(coordKey(coord), { mapId: map.id, x: coord.x, y: coord.y });
    }
  }
  for (const coord of tileCoords(map, params.b)) {
    const expected = neighbor(coord, oppositeRelation(params.relation));
    if (!isInside(map, expected.x, expected.y) || !hasTileAt(map, expected.x, expected.y, params.a)) {
      coords.set(coordKey(coord), { mapId: map.id, x: coord.x, y: coord.y });
    }
  }
  return coords.size > 0 ? baseViolation(group, rule, [...coords.values()]) : null;
}

function adjacencyParams(params: Record<string, unknown>): { readonly a: number; readonly b: number; readonly bAlt: readonly number[]; readonly relation: RuleRelation } | null {
  const a = integerParam(params.a);
  const b = integerParam(params.b);
  const relation = RELATIONS.find((candidate) => candidate === params.relation);
  if (a === null || b === null || !relation) return null;
  const bAlt = Array.isArray(params.bAlt)
    ? params.bAlt.map((value) => integerParam(value)).filter((value): value is number => value !== null)
    : [];
  return { a, b, bAlt, relation };
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

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function coordKey(coord: ClusterRuleViolationCoord): string {
  return `${coord.mapId}:${coord.x},${coord.y}`;
}
