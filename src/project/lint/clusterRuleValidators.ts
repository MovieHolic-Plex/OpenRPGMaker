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
  const coords: ClusterRuleViolationCoord[] = [];
  for (const coord of tileCoords(map, params.a)) {
    const expected = neighbor(coord, params.relation);
    if (!isInside(map, expected.x, expected.y) || !hasTileAt(map, expected.x, expected.y, params.b)) {
      coords.push({ mapId: map.id, x: coord.x, y: coord.y });
    }
  }
  return coords.length > 0 ? baseViolation(group, rule, coords) : null;
}

function adjacencyParams(params: Record<string, unknown>): { readonly a: number; readonly b: number; readonly relation: RuleRelation } | null {
  const a = integerParam(params.a);
  const b = integerParam(params.b);
  const relation = RELATIONS.find((candidate) => candidate === params.relation);
  if (a === null || b === null || !relation) return null;
  return { a, b, relation };
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

function spacingViolation(map: GameMap, group: TileGroupMetadata, rule: ClusterRule): ClusterRuleViolation | null {
  const minGap = integerParam(rule.params.minGap);
  if (minGap === null || minGap < 1) return null;
  const coords = groupCoords(map, group);
  const close = new Map<string, ClusterRuleViolationCoord>();
  for (let left = 0; left < coords.length; left += 1) {
    const leftCoord = coords[left];
    if (!leftCoord) continue;
    for (let right = left + 1; right < coords.length; right += 1) {
      const rightCoord = coords[right];
      if (!rightCoord) continue;
      if (distance(leftCoord, rightCoord) >= minGap) continue;
      close.set(coordKey(leftCoord), leftCoord);
      close.set(coordKey(rightCoord), rightCoord);
    }
  }
  return close.size > 0 ? baseViolation(group, rule, [...close.values()]) : null;
}

function distance(a: ClusterRuleViolationCoord, b: ClusterRuleViolationCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function countViolation(map: GameMap, group: TileGroupMetadata, rule: ClusterRule): ClusterRuleViolation | null {
  return countCoordsViolation(group, rule, groupCoords(map, group));
}

function globalCountViolation(
  maps: readonly GameMap[],
  group: TileGroupMetadata,
  rule: ClusterRule
): ClusterRuleViolation | null {
  return countCoordsViolation(group, rule, maps.flatMap((map) => groupCoords(map, group)));
}

function countCoordsViolation(
  group: TileGroupMetadata,
  rule: ClusterRule,
  coords: readonly ClusterRuleViolationCoord[]
): ClusterRuleViolation | null {
  const min = integerParam(rule.params.min);
  const max = integerParam(rule.params.max);
  if (min === null && max === null) return null;
  if (min !== null && coords.length < min) return baseViolation(group, rule, []);
  if (max !== null && coords.length > max) return baseViolation(group, rule, coords);
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
