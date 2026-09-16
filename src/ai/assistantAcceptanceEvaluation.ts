import { authoredIdentity } from "@/project/authoredProjectBaseline";
import { evaluateFunctionalCriterion } from "./functionalAcceptanceEvaluation";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { NpcRewardRequirement } from "./intentDeclaration";
import type { WorkItemOutcomeVerdict } from "./workItemOutcome";
import { canMove, inBounds, isPassable } from "@/project/collision";
import { passageBounds } from "@/project/footprint";
import type { GameMap, Project } from "@/project/types";
import { ACCEPTANCE_EXAMPLES, type AcceptanceIssue, type AcceptanceCriterion, type AcceptanceItemSnapshot, type AcceptanceRegion, type AcceptanceTarget, type ProjectAcceptanceCriterion, type AcceptanceSource } from "./assistantAcceptance";
import type { ToolVerificationEvidence } from "./toolVerificationEvidence";
import { collectionRecords, type DbCollection } from "@/editor/tools/queryTools";

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
    case "wikiDeclaration": case "projectTitle": case "itemValues": case "projectPreserve":
    case "dbRecordValues":
    case "gameTitle": case "toolVerdict": case "npcReward": case "functionalUnresolved": return [];
    case "shopPurchase": return [criterion.target];
    case "mapRoundTrip": return [criterion.target, criterion.destination];
    case "mapCount": return criterion.targets;
    case "mapDimensions": case "eventCount": case "targetChange": case "preserve": case "imageReviewed": case "reachability": case "actionCombat": return [criterion.target];
    default: return assertNever(criterion);
  }
}
/** id 또는 유일한 이름으로 레코드를 찾는다. 이름 해석이 모호하거나 없으면 검증하지 않는다 —
 * 어느 레코드를 검증했는지 말할 수 없기 때문이다(커버리지 감사는 읽기 전에 돌아 id 를 모른다). */
function resolveDbRecord(project: Project, selector: { readonly collection: DbCollection; readonly recordId?: string; readonly recordName?: string }): { record?: Record<string, unknown>; matches: number } {
  const all = collectionRecords(project, selector.collection);
  const byId = selector.recordId !== undefined && selector.recordId !== "";
  const matches = byId ? all.filter(record => record.id === selector.recordId) : all.filter(record => record.name === selector.recordName);
  return { record: matches.length === 1 ? matches[0] : undefined, matches: matches.length };
}
export interface AcceptanceEvaluation {
  readonly source?: AcceptanceSource;
  readonly npcRewardProof?: (project: Project, requirement: NpcRewardRequirement) => WorkItemOutcomeVerdict;
  readonly verification?: ToolVerificationEvidence;
  readonly verificationCheckId?: string;
  readonly project: Project;
  readonly baseline: Project;
  readonly bindings: ReadonlyMap<string, string>;
  readonly reviewed: (map: GameMap, region: AcceptanceRegion) => boolean;
  readonly actionProven?: (map: GameMap) => boolean;
}
/** 점 경로 읽기/쓰기 — 허용된 DB 필드만 기준선 값으로 되돌려 비교에서 중립화한다. */
function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) =>
    node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined, value);
}
/** Restore only explicitly allowed fields on a detached copy, then compare with
 * the immutable request baseline. IDs, array order and all other values survive. */
function projectPreserved(criterion: Extract<ProjectAcceptanceCriterion, { kind: "projectPreserve" }>, input: AcceptanceEvaluation): boolean {
  const current = structuredClone(input.project);
  for (const change of criterion.allowedChanges) {
    if (change.kind === "projectTitle") {
      current.meta.title = input.baseline.meta.title;
      // Creating/removing a title-screen settings object is not only a title edit.
      if (Boolean(current.system.titleScreen) !== Boolean(input.baseline.system.titleScreen)) return false;
      if (current.system.titleScreen && input.baseline.system.titleScreen) current.system.titleScreen.title = input.baseline.system.titleScreen.title;
      continue;
    }
    const before = input.baseline.database.items.filter(item => item.id === change.itemId);
    const after = current.database.items.filter(item => item.id === change.itemId);
    if (change.kind === "itemAddition") {
      // The allowance cannot erase an existing record or hide duplicate IDs.
      if (before.length !== 0 || after.length > 1) return false;
      current.database.items = current.database.items.filter(item => item.id !== change.itemId);
    } else {
      if (before.length !== 1 || after.length !== 1) return false;
      if (change.kind === "itemName") after[0].name = before[0].name;
      else after[0].price = before[0].price;
    }
  }
  // Explicit authored scope reuses the product's existing wiki ownership split.
  // It is NOT proof of wiki preservation or of a declared combat behavior.
  const identity = criterion.scope === "authored" ? authoredIdentity : acceptanceFingerprint;
  return identity(current) === identity(input.baseline);
}
export function evaluateAcceptanceCriterion(criterion: AcceptanceCriterion, input: AcceptanceEvaluation): Evidence {
  const expected = JSON.stringify(criterion);
  switch (criterion.kind) {
    case "shopPurchase": case "mapRoundTrip": case "npcReward": case "functionalUnresolved": return evaluateFunctionalCriterion(criterion, input);
    case "wikiDeclaration": {
      const documents = input.project.world?.entities ?? [];
      const matches = documents.filter(document => document.id === criterion.documentId);
      const wiki = matches.length === 1 ? matches[0].wiki : undefined;
      const request = input.source?.text;
      const quoteAt = request?.indexOf(criterion.sourceQuote) ?? -1;
      const sourceLinked = request !== undefined && quoteAt >= 0 && quoteAt === request.lastIndexOf(criterion.sourceQuote)
        && wiki?.sources.some(source => source.kind === "user" && source.text === request) === true;
      const superseded = documents.some(document => document.wiki?.supersedes?.includes(criterion.documentId));
      const passed = wiki?.kind === "declaration" && wiki.basis === "explicit"
        && wiki.combatMode === criterion.combatMode && sourceLinked && !superseded;
      return { expected, observed: JSON.stringify({ matches: matches.length, kind: wiki?.kind, basis: wiki?.basis,
        combatMode: wiki?.combatMode, sourceLinked, superseded, proves: "stored preference only" }), passed };
    }
    case "projectTitle": {
      const observed = { metaTitle: input.project.meta.title, titleScreenTitle: input.project.system.titleScreen?.title };
      return { expected, observed: JSON.stringify(observed), passed: observed.metaTitle === criterion.title && observed.titleScreenTitle === criterion.title };
    }
    case "itemValues": {
      const matches = input.project.database.items.filter(item => item.id === criterion.itemId);
      const item = matches.length === 1 ? matches[0] : undefined;
      return { expected, observed: JSON.stringify({ matches: matches.length, name: item?.name, price: item?.price }),
        passed: !!item && (criterion.name === undefined || item.name === criterion.name) && (criterion.price === undefined || item.price === criterion.price) };
    }
    case "projectPreserve": {
      const passed = projectPreserved(criterion, input);
      return { expected, observed: passed ? "Original baseline preserved outside allowed changes" : "Unallowed change or invalid baseline target", passed };
    }
    case "dbRecordValues": {
      // 저장된 필드값을 본다 — 런타임 전투 동작을 증명하지는 않는다(그 조항은 여전히 functionalUnresolved 다).
      // 같은 id 가 둘 이상이면 어느 쪽을 검증했는지 말할 수 없으므로 실패한다(itemValues 와 같은 규칙).
      const { record, matches } = resolveDbRecord(input.project, criterion);
      const observed: Record<string, unknown> = {};
      let passed = record !== undefined;
      for (const [path, expectedValue] of Object.entries(criterion.fields)) {
        const actual = readPath(record, path);
        observed[path] = actual ?? null;
        if (actual !== expectedValue) passed = false;
      }
      return { expected, observed: JSON.stringify({ matches, ...observed }), passed };
    }
    case "gameTitle": {
      // Match titleScreen.renderTitleScreen/renderTitleNodes without importing DOM
      // or asset rendering. Metadata is not a fallback; graphic-only text is hidden.
      const settings = input.project.system.titleScreen ?? defaultTitleScreenSettings();
      const hidden = settings.titleGraphic?.mode === "graphic" && Boolean(settings.titleGraphic.resourceId);
      return { expected, observed: JSON.stringify({ title: hidden ? null : settings.title }),
        passed: !hidden && settings.title === criterion.title };
    }
    case "toolVerdict": {
      const passed = input.verification?.passedScope(criterion.tool, criterion.args, input.verificationCheckId) === true;
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
      if (!before && criterion.kind === "targetChange" && "newMapName" in criterion.target) {
        return { expected, observed: "Uniquely bound map created since original baseline", passed: true };
      }
      const same = Boolean(before && (!region || validRegion(before, region))
        && acceptanceFingerprint(scopedMapContent(before, region)) === acceptanceFingerprint(scopedMapContent(map, region)));
      const passed = criterion.kind === "preserve" ? same : Boolean(before && !same);
      return { expected, observed: !before ? "No original target baseline" : same ? "Unchanged from original baseline" : "Changed from original baseline", passed };
    }
    case "reachability": {
      const issues = conservativeReachability(input.project, map, criterion);
      return { expected, observed: issues.length === 0 ? "All exact destination cells reachable with conservative event blockers"
        : issues.map(issue => `${issue.field} (${issue.cell?.x},${issue.cell?.y}): ${issue.code}${issue.blocker?.eventId ? ` event ${issue.blocker.eventId}` : ""}. ${issue.expected}`).join("; "),
        passed: issues.length === 0, issues: Object.freeze(issues) };
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

function conservativeReachability(project: Project, map: GameMap, criterion: Extract<AcceptanceCriterion, { kind: "reachability" }>): AcceptanceIssue[] {
  const points = [{ field: "from", cell: criterion.from }, ...criterion.to.map((cell, index) => ({ field: `to[${index}]`, cell }))];
  const failure = (point: typeof points[number], code: string, blocker: NonNullable<AcceptanceIssue["blocker"]>): AcceptanceIssue => Object.freeze({
    ...point, cell: Object.freeze({ ...point.cell }), code, mapId: map.id, blocker: Object.freeze(blocker),
    expected: "exact walkable cell under conservative static passage; for interactions use an approach cell, not the solid event cell. Conditional movement is not proven",
    example: ACCEPTANCE_EXAMPLES.reachability,
  });
  // Never assume a switch/page/route will open a path. Every potentially solid
  // authored page blocks its passage footprint; no runtime state is fabricated.
  const blockers = map.events.flatMap(event => {
    const bounds = !event.pages?.length ? [passageBounds(event.x, event.y, { width: 1, height: 1 }, 1)]
      : event.pages.filter(page => page.priority === "same" && page.overlapForbidden !== false)
        .map(page => passageBounds(event.x, event.y, page.footprint ?? { width: 1, height: 1 }, page.passRows ?? page.footprint?.height ?? 1));
    return bounds.map(rect => ({ ...rect, eventId: event.id }));
  });
  const blocked = (x: number, y: number) => blockers.find(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  const issues: AcceptanceIssue[] = [];
  for (const point of points) {
    if (!inBounds(map, point.cell.x, point.cell.y)) issues.push(failure(point, "cell-out-of-bounds", { kind: "bounds" }));
    else if (!isPassable(project, map, point.cell.x, point.cell.y)) issues.push(failure(point, "cell-tile-blocked", { kind: "tile" }));
    else {
      const event = blocked(point.cell.x, point.cell.y);
      if (event) issues.push(failure(point, "cell-event-blocked", { kind: "event", eventId: event.eventId }));
    }
  }
  if (issues.length) return issues;
  const moving = map.events.find(event => event.moveRoute || event.pages?.some(page => page.priority === "same"
    && page.overlapForbidden !== false && page.movement.type !== "fixed"));
  if (moving) return [failure({ field: "from", cell: criterion.from }, "conditional-movement-unsupported", { kind: "event", eventId: moving.id })];
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
  return points.filter(point => !seen.has(`${point.cell.x},${point.cell.y}`))
    .map(point => failure(point, "cell-unreachable", { kind: "route" }));
}
