import { canMove, inBounds, isPassable } from "@/project/collision";
import { passageBounds } from "@/project/footprint";
import type { GameMap, Project } from "@/project/types";
import type { AcceptanceCollection, AcceptanceSubject, AcceptanceSelector, AcceptanceCriterion, AcceptanceItemSnapshot, AcceptanceRegion, AcceptanceTarget } from "./assistantAcceptance";
import type { ToolVerificationEvidence } from "./toolVerificationEvidence";

type Evidence = AcceptanceItemSnapshot["evidence"][number];
export function acceptanceFingerprint(value: unknown): string {
  // Exact canonical content identity, not a model-supplied digest or a lossy hash.
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
}
export function resolveAcceptanceMap(project: Project, target: AcceptanceTarget, bindings: ReadonlyMap<string, string>): GameMap | undefined {
  const id = "mapId" in target ? target.mapId : bindings.get(target.newMapName) ?? "";
  return Object.hasOwn(project.maps, id) ? project.maps[id] : undefined;
}
export function contains(region: AcceptanceRegion, point: { readonly x: number; readonly y: number }): boolean {
  return point.x >= region.x && point.y >= region.y && point.x < region.x + region.w && point.y < region.y + region.h;
}
export function validRegion(map: GameMap, region: AcceptanceRegion): boolean {
  return inBounds(map, region.x, region.y) && inBounds(map, region.x + region.w - 1, region.y + region.h - 1);
}

/** A requested image review cannot exclude cells this request actually changed. */
export function acceptanceReviewRegion(map: GameMap, before: GameMap | undefined, requested?: AcceptanceRegion): AcceptanceRegion {
  const full = { x: 0, y: 0, w: map.width, h: map.height };
  if (!requested) return full;
  if (!validRegion(map, requested)) return requested;
  if (!before || before.width !== map.width || before.height !== map.height
    || before.tilesetId !== map.tilesetId || before.tileSize !== map.tileSize) return full;
  let left = requested.x, top = requested.y, right = left + requested.w, bottom = top + requested.h;
  const include = (x: number, y: number): void => {
    if (!inBounds(map, x, y)) return;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  };
  for (let i = 0; i < map.width * map.height; i += 1) {
    if (map.lowerTiles[i] !== before.lowerTiles[i] || map.upperTiles[i] !== before.upperTiles[i]
      || acceptanceFingerprint(map.lowerTileStacks?.[i] ?? []) !== acceptanceFingerprint(before.lowerTileStacks?.[i] ?? [])
      || acceptanceFingerprint(map.upperTileStacks?.[i] ?? []) !== acceptanceFingerprint(before.upperTileStacks?.[i] ?? [])) {
      include(i % map.width, Math.floor(i / map.width));
    }
  }
  const oldEvents = new Map(before.events.map(event => [event.id, event]));
  const newEvents = new Map(map.events.map(event => [event.id, event]));
  for (const id of new Set([...oldEvents.keys(), ...newEvents.keys()])) {
    const oldEvent = oldEvents.get(id), newEvent = newEvents.get(id);
    if (acceptanceFingerprint(oldEvent) === acceptanceFingerprint(newEvent)) continue;
    if (oldEvent) include(oldEvent.x, oldEvent.y);
    if (newEvent) include(newEvent.x, newEvent.y);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function scopedMapContent(map: GameMap, region?: AcceptanceRegion): unknown {
  if (!region) return map;
  const cells = [];
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x; x < region.x + region.w; x += 1) {
      const i = y * map.width + x;
      cells.push([map.lowerTiles[i], map.upperTiles[i], map.lowerTileStacks?.[i], map.upperTileStacks?.[i]]);
    }
  }
  return { tilesetId: map.tilesetId, tileSize: map.tileSize, cells, events: map.events.filter(event => contains(region, event)) };
}
export function visualFingerprint(project: Project, map: GameMap): string {
  return acceptanceFingerprint([map, project.tilesets[map.tilesetId], project.assets]);
}
export function criterionTargets(criterion: AcceptanceCriterion): readonly AcceptanceTarget[] {
  switch (criterion.kind) {
    case "toolVerdict": case "valueEquals": case "entityPreserve": case "membershipPreserve": case "entityCount": return [];
    case "mapCount": return criterion.targets;
    case "mapDimensions": case "eventCount": case "targetChange": case "preserve": case "imageReviewed": case "reachability": case "actionCombat": return [criterion.target];
    default: return assertNever(criterion);
  }
}
/** Only own JSON properties. Missing and ambiguous identities never equal each other. */
export function selectedSubject(project: Project, subject: AcceptanceSubject): unknown {
  switch (subject.kind) {
    case "project": return { meta: project.meta, system: project.system };
    case "database": {
      const matches = (project.database[subject.collection] ?? []).filter(entry => entry.id === subject.id);
      return matches.length === 1 ? matches[0] : undefined;
    }
    case "event": {
      const map = Object.hasOwn(project.maps, subject.mapId) ? project.maps[subject.mapId] : undefined;
      const matches = map?.events.filter(entry => entry.id === subject.eventId) ?? [];
      return matches.length === 1 ? matches[0] : undefined;
    }
    case "asset": {
      const entries = project.assets[subject.category];
      if (!Object.hasOwn(entries, subject.id)) return undefined;
      // Metadata proves no binary/provider claim; transport blobs are not selectable.
      return Object.fromEntries(Object.entries(entries[subject.id]!).filter(([key]) => key !== "dataUrl"));
    }
  }
}
export function selectedPath(value: unknown, path: readonly string[]): unknown {
  for (const key of path) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
function selectedCollection(project: Project, collection: AcceptanceCollection, selector: AcceptanceSelector): readonly { id: string }[] | undefined {
  let entries: readonly { id: string; name?: string }[];
  switch (collection.kind) {
    case "database": entries = project.database[collection.collection] ?? []; break;
    case "events": {
      if (!Object.hasOwn(project.maps, collection.mapId)) return undefined;
      entries = project.maps[collection.mapId]!.events; break;
    }
    case "assets": entries = Object.entries(project.assets[collection.category]).map(([id, entry]) => ({ ...entry, id })); break;
  }
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) return undefined;
  if ("all" in selector) return entries;
  if ("ids" in selector) return entries.filter(entry => selector.ids.includes(entry.id));
  if (selector.names.some(name => entries.filter(entry => entry.name === name).length > 1)) return undefined;
  return entries.filter(entry => entry.name !== undefined && selector.names.includes(entry.name));
}
export function selectedCriterionState(project: Project, criterion: AcceptanceCriterion): unknown {
  if ("subject" in criterion) {
    const value = selectedSubject(project, criterion.subject);
    return criterion.path ? selectedPath(value, criterion.path) : value;
  }
  if ("collection" in criterion) return selectedCollection(project, criterion.collection, criterion.selector);
  return undefined;
}
export interface AcceptanceEvaluation {
  readonly verification?: ToolVerificationEvidence;
  readonly project: Project;
  readonly baseline: Project;
  readonly bindings: ReadonlyMap<string, string>;
  readonly reviewed: (map: GameMap, region: AcceptanceRegion) => boolean;
  readonly actionProven?: (map: GameMap) => boolean;
}
export function evaluateAcceptanceCriterion(criterion: AcceptanceCriterion, input: AcceptanceEvaluation): Evidence {
  const expected = JSON.stringify(criterion);
  if (criterion.kind === "valueEquals" || criterion.kind === "entityPreserve") {
    const current = selectedCriterionState(input.project, criterion);
    const original = selectedCriterionState(input.baseline, criterion);
    const passed = current !== undefined && (criterion.kind === "valueEquals"
      ? acceptanceFingerprint(current) === acceptanceFingerprint(criterion.value)
      : original !== undefined && acceptanceFingerprint(current) === acceptanceFingerprint(original));
    return { expected, observed: current === undefined ? "Selected identity/value missing or ambiguous" : acceptanceFingerprint(current), passed };
  }
  if (criterion.kind === "membershipPreserve" || criterion.kind === "entityCount") {
    const current = selectedCollection(input.project, criterion.collection, criterion.selector);
    const original = selectedCollection(input.baseline, criterion.collection, criterion.selector);
    if (!current) return { expected, observed: "Selected collection missing or ambiguous", passed: false };
    let passed: boolean;
    if (criterion.kind === "membershipPreserve") {
      passed = original !== undefined && acceptanceFingerprint(current.map(entry => entry.id).sort())
        === acceptanceFingerprint(original.map(entry => entry.id).sort());
    } else {
      const baselineCount = criterion.basis === "requestDelta" ? original?.length : 0;
      if (baselineCount === undefined) return { expected, observed: "Original collection missing", passed: false };
      const count = current.length - baselineCount;
      passed = criterion.comparison === "eq" ? count === criterion.count : criterion.comparison === "gte" ? count >= criterion.count : count <= criterion.count;
    }
    return { expected, observed: acceptanceFingerprint(current), passed };
  }
  switch (criterion.kind) {
    case "toolVerdict": {
      const passed = input.verification?.passedScope(criterion.tool, criterion.args) === true;
      return { expected, observed: passed ? "Current explicit scoped tool verdict" : "Current explicit scoped tool verdict required", passed };
    }
    case "mapCount": {
      const maps = criterion.targets.map(target => resolveAcceptanceMap(input.project, target, input.bindings));
      const count = new Set(maps.filter(map => map !== undefined).map(map => map.id)).size;
      return { expected, observed: `${count} scoped maps`, passed: count === criterion.count };
    }
    case "mapDimensions": case "eventCount": case "targetChange": case "preserve": case "imageReviewed": case "reachability": case "actionCombat": break;
    default: return assertNever(criterion);
  }
  const map = resolveAcceptanceMap(input.project, criterion.target, input.bindings);
  if (!map) return { expected, observed: "Target map missing or new-map binding unresolved", passed: false };
  const region = "region" in criterion ? criterion.region : undefined;
  if (region && !validRegion(map, region)) return { expected, observed: "Region outside target map", passed: false };
  switch (criterion.kind) {
    case "actionCombat": {
      const passed = input.actionProven?.(map) === true;
      return { expected, observed: passed ? "Current harness-owned action combat proof" : "Current map-bound action combat proof required; scene/static checks are not combat proof", passed };
    }
    case "mapDimensions": return { expected, observed: `${map.width}x${map.height}`, passed: map.width === criterion.width && map.height === criterion.height };
    case "eventCount": {
      const count = region ? map.events.filter(event => contains(region, event)).length : map.events.length;
      return { expected, observed: `${count} scoped events`, passed: count === criterion.count };
    }
    case "targetChange": case "preserve": {
      const before = input.baseline.maps[map.id];
      const same = Boolean(before && (!region || validRegion(before, region))
        && acceptanceFingerprint(scopedMapContent(before, region)) === acceptanceFingerprint(scopedMapContent(map, region)));
      const passed = criterion.kind === "preserve" ? same : Boolean(before && !same);
      return { expected, observed: !before ? "No original target baseline" : same ? "Unchanged from original baseline" : "Changed from original baseline", passed };
    }
    case "reachability": {
      const passed = conservativeReachability(input.project, map, criterion);
      return { expected, observed: passed ? "All targets reachable with conservative event blockers" : "Route blocked, out of bounds, or conditional movement unsupported", passed };
    }
    case "imageReviewed": {
      const requiredRegion = acceptanceReviewRegion(map, input.baseline.maps[map.id], region);
      const passed = input.reviewed(map, requiredRegion);
      return {
        expected: JSON.stringify({ ...criterion, region: requiredRegion }),
        observed: passed ? "Delivered image coverage explicitly reviewed for current content" : "Current image coverage and attributed review required",
        passed,
      };
    }
    default: return assertNever(criterion);
  }
}
function assertNever(value: never): never { throw new Error(`Unhandled acceptance criterion: ${String(value)}`); }

function conservativeReachability(project: Project, map: GameMap, criterion: Extract<AcceptanceCriterion, { kind: "reachability" }>): boolean {
  const points = [criterion.from, ...criterion.to];
  if (points.some(point => !inBounds(map, point.x, point.y) || !isPassable(project, map, point.x, point.y))) return false;
  // Never assume a switch/page/route will open a path. Every potentially solid
  // authored page blocks its passage footprint; no runtime state is fabricated.
  const blockers = map.events.flatMap(event => {
    if (!event.pages?.length) return [passageBounds(event.x, event.y, { width: 1, height: 1 }, 1)];
    return event.pages.filter(page => page.priority === "same" && page.overlapForbidden !== false)
      .map(page => passageBounds(event.x, event.y, page.footprint ?? { width: 1, height: 1 }, page.passRows ?? page.footprint?.height ?? 1));
  });
  if (map.events.some(event => event.moveRoute || event.pages?.some(page => page.priority === "same"
    && page.overlapForbidden !== false && page.movement.type !== "fixed"))) return false;
  const blocked = (x: number, y: number): boolean => blockers.some(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  if (points.some(point => blocked(point.x, point.y))) return false;
  const seen = new Set<string>([`${criterion.from.x},${criterion.from.y}`]);
  const queue = [criterion.from];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (!current) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx, y = current.y + dy, key = `${x},${y}`;
      if (seen.has(key) || blocked(x, y) || !canMove(project, map, current.x, current.y, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return criterion.to.every(point => seen.has(`${point.x},${point.y}`));
}
