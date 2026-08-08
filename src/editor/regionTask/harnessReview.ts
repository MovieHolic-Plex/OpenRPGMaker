import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { listRoomDrafts, evaluateRoomDraft } from "@/editor/roomHarness/facade";
import { canMove, inBounds, isPassable } from "@/project/collision";
import { resolveEventPage } from "@/project/io/pageResolution";
import { evalCondition, startSession } from "@/project/session";
import type { Command, GameEvent, GameMap, MapId, Project } from "@/project/types";
import { inRegion, type RegionRect } from "./clipToRegion";

export type HarnessIssueSeverity = "info" | "warning" | "error";

export interface HarnessIssue {
  readonly code: string;
  readonly severity: HarnessIssueSeverity;
  readonly message: string;
  readonly mapId?: MapId;
  readonly x?: number;
  readonly y?: number;
  readonly roomId?: string;
  readonly repaired?: boolean;
}

export interface HarnessCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly status: "done" | "blocked";
  readonly detail: string;
}

export interface HarnessGameplayMetrics {
  readonly changedCells: number;
  readonly changedEvents: number;
  readonly passableChangedCells: number;
  readonly isolatedChangedCells: number;
  readonly scheduledNpcs: number;
  readonly scheduleEntries: number;
  readonly timeSystemEnabled: boolean;
  readonly roomSessions: number;
  readonly roomScoreAverage: number | null;
  readonly deterministicRepairs: number;
  readonly outOfScopeChanges?: number;
  readonly reachableObjectives?: number;
  readonly unreachableObjectives?: number;
  readonly transferLinks?: number;
  readonly scheduleDestinations?: number;
  /** Changed-region tile-pair variety, 0..100. This is a deterministic composition heuristic, not image vision. */
  readonly compositionScore?: number;
}

export interface HarnessReviewReport {
  readonly issues: readonly HarnessIssue[];
  readonly blockers: readonly string[];
  readonly checkpoints: readonly HarnessCheckpoint[];
  readonly metrics: HarnessGameplayMetrics;
  readonly repairLimit: number;
}

export interface HarnessReviewResult {
  readonly project: Project;
  readonly report: HarnessReviewReport;
}

export interface SafeRegionDoorway {
  readonly door: { readonly x: number; readonly y: number };
  readonly returnPosition: { readonly x: number; readonly y: number };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const DEFAULT_REPAIR_LIMIT = 8;

/** Read-only project/gameplay preflight plus bounded deterministic isolation repair. */
export function reviewRegionDraft(input: {
  readonly base: Project;
  readonly draft: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly repairLimit?: number;
}): HarnessReviewResult {
  const project = cloneDetachedDraft(input.draft);
  const issues: HarnessIssue[] = [];
  const repairLimit = Math.max(0, Math.trunc(input.repairLimit ?? DEFAULT_REPAIR_LIMIT));
  let repairs = 0;
  let changedCells = 0;
  let changedEvents = 0;
  let passableChangedCells = 0;

  const scope = targetScopeViolations(input.base, project, input.mapId, input.region);
  if (scope.count > 0) {
    issues.push({
      code: "region-scope-violation",
      severity: "error",
      message: `선택 영역 밖 변경 ${scope.count}건을 감지했습니다${scope.sample ? ` (예: ${scope.sample})` : ""}.`,
      mapId: input.mapId,
    });
  }

  const mapIds = new Set([...Object.keys(input.base.maps), ...Object.keys(project.maps)]);
  for (const mapId of [...mapIds].sort()) {
    const before = input.base.maps[mapId];
    const after = project.maps[mapId];
    if (!after) continue;
    const changed = changedCoordinates(before, after);
    changedCells += changed.length;
    changedEvents += changedEventCount(before, after);
    for (const cell of changed) {
      if (!isPassable(project, after, cell.x, cell.y)) continue;
      passableChangedCells += 1;
      const connected = hasMoveNeighbor(project, after, cell.x, cell.y)
        && (!before || connectsToStableCell(project, before, after, mapId, cell.x, cell.y));
      if (connected) continue;
      if (before && before.width === after.width && before.height === after.height && repairs < repairLimit) {
        const index = cell.y * after.width + cell.x;
        restoreMapCell(after, before, index);
        repairs += 1;
        issues.push({
          code: "isolated-cell-repaired",
          severity: "warning",
          message: `고립된 통행 셀과 스택을 원본으로 복구했습니다 (${cell.x},${cell.y}).`,
          mapId,
          x: cell.x,
          y: cell.y,
          repaired: true,
        });
      }
    }
  }

  let isolatedChangedCells = 0;
  for (const mapId of [...mapIds].sort()) {
    const before = input.base.maps[mapId];
    const after = project.maps[mapId];
    if (!after) continue;
    for (const cell of changedCoordinates(before, after)) {
      const connected = hasMoveNeighbor(project, after, cell.x, cell.y)
        && (!before || connectsToStableCell(project, before, after, mapId, cell.x, cell.y));
      if (!isPassable(project, after, cell.x, cell.y) || connected) continue;
      isolatedChangedCells += 1;
      issues.push({
        code: "disconnected-passable-cell",
        severity: "error",
        message: `변경된 통행 셀이 기존 동선 또는 시작 위치와 연결되지 않습니다 (${cell.x},${cell.y}).`,
        mapId,
        x: cell.x,
        y: cell.y,
      });
    }
  }

  const baseNavigation = inspectWorldNavigation(input.base);
  let navigation = inspectWorldNavigation(project);
  const baselineProblemKeys = new Set(baseNavigation.problems.map((problem) => problem.key));
  let newNavigationProblems = navigation.problems.filter((problem) => !baselineProblemKeys.has(problem.key));

  // Generated prop-inspection events are optional flavor, not progression objectives. If a
  // furnishing lands one where it cannot be interacted with, remove only that generated event
  // within the same bounded repair budget; authored/non-generated objectives remain hard errors.
  let removedInspectEvent = false;
  for (const problem of newNavigationProblems) {
    if (repairs >= repairLimit
      || problem.code !== "gameplay-event-unreachable"
      || !problem.eventId?.startsWith("ev_inspect_")
      || !problem.mapId) continue;
    const map = project.maps[problem.mapId];
    if (!map || !map.events.some((event) => event.id === problem.eventId)) continue;
    map.events = map.events.filter((event) => event.id !== problem.eventId);
    repairs += 1;
    changedEvents = Math.max(0, changedEvents - 1);
    removedInspectEvent = true;
    issues.push({
      code: "unreachable-inspect-event-repaired",
      severity: "warning",
      message: `도달할 수 없는 자동 소품 조사 이벤트를 제거했습니다: ${problem.eventId}.`,
      mapId: problem.mapId,
      ...(problem.x === undefined ? {} : { x: problem.x }),
      ...(problem.y === undefined ? {} : { y: problem.y }),
      repaired: true,
    });
  }
  if (removedInspectEvent) {
    navigation = inspectWorldNavigation(project);
    newNavigationProblems = navigation.problems.filter((problem) => !baselineProblemKeys.has(problem.key));
  }
  for (const problem of newNavigationProblems) {
    issues.push({
      code: problem.code,
      severity: "error",
      message: problem.message,
      mapId: problem.mapId,
      ...(problem.x === undefined ? {} : { x: problem.x }),
      ...(problem.y === undefined ? {} : { y: problem.y }),
    });
  }

  let scheduledNpcs = 0;
  let scheduleEntries = 0;
  for (const mapId of Object.keys(project.maps).sort()) {
    for (const event of project.maps[mapId]!.events) {
      if (!event.schedule?.length) continue;
      scheduledNpcs += 1;
      scheduleEntries += event.schedule.length;
    }
  }
  const timeSystemEnabled = project.system.timeSystem?.enabled === true;
  if (scheduledNpcs > 0 && !timeSystemEnabled) {
    const scheduleChanged = scheduleFingerprint(input.base) !== scheduleFingerprint(project);
    issues.push({
      code: "npc-schedule-time-disabled",
      severity: scheduleChanged ? "error" : "warning",
      message: scheduleChanged
        ? `새 NPC 일정 ${scheduleEntries}개를 실행하려면 시간 시스템을 켜거나 해당 NPC를 현재 위치에 고정해야 합니다.`
        : `NPC ${scheduledNpcs}명의 일정 ${scheduleEntries}개가 있지만 시간 시스템이 꺼져 있습니다.`,
    });
  }

  const roomDrafts = listRoomDrafts(project);
  const roomScores: number[] = [];
  for (const roomDraft of roomDrafts) {
    try {
      const data = evaluateRoomDraft(project, roomDraft.sessionId).data as { report?: { score?: number; issues?: readonly string[] } };
      if (typeof data.report?.score === "number") roomScores.push(data.report.score);
      for (const message of data.report?.issues ?? []) {
        const hard = /walkability|도달 불가/.test(message);
        issues.push({
          code: hard ? "room-walkability" : "room-quality",
          severity: hard ? "error" : "warning",
          message,
          mapId: roomDraft.mapId,
        });
      }
    } catch (cause) {
      issues.push({
        code: "room-evaluation-failed",
        severity: "error",
        message: cause instanceof Error ? cause.message : String(cause),
        mapId: roomDraft.mapId,
      });
    }
  }

  const blockers = issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
  const metrics: HarnessGameplayMetrics = {
    changedCells,
    changedEvents,
    passableChangedCells,
    isolatedChangedCells,
    scheduledNpcs,
    scheduleEntries,
    timeSystemEnabled,
    roomSessions: roomDrafts.length,
    roomScoreAverage: roomScores.length ? Math.round(roomScores.reduce((sum, score) => sum + score, 0) / roomScores.length) : null,
    deterministicRepairs: repairs,
    outOfScopeChanges: scope.count,
    reachableObjectives: navigation.reachableObjectives,
    unreachableObjectives: newNavigationProblems.length,
    transferLinks: navigation.transferLinks,
    scheduleDestinations: navigation.scheduleDestinations,
    compositionScore: changedRegionCompositionScore(input.base, project, input.mapId, input.region),
  };
  const checkpoints: HarnessCheckpoint[] = [
    { id: "draft", label: "분리 초안", status: "done", detail: "프로젝트 저장소와 분리된 편집기 메모리에서 생성" },
    { id: "scope", label: "영역 경계", status: scope.count ? "blocked" : "done", detail: scope.count ? `영역 밖 ${scope.count}건` : "선택 영역 경계 준수" },
    { id: "repair", label: "결정론 수리", status: "done", detail: `${repairs}/${repairLimit}회 사용` },
    { id: "preflight", label: "게임플레이 사전검사", status: blockers.length ? "blocked" : "done", detail: blockers.length ? `차단 ${blockers.length}건` : "통행·전송·이벤트·NPC 검사 통과" },
    { id: "approval", label: "승인 대기", status: blockers.length ? "blocked" : "done", detail: blockers.length ? "차단 사유를 해결해야 적용 가능" : "적용 또는 버리기 선택" },
  ];
  return { project, report: { issues, blockers, checkpoints, metrics, repairLimit } };
}

export function projectApprovalFingerprint(project: Project): string {
  return JSON.stringify(project);
}

/**
 * Pick a deterministic, event-free door cell inside the selected region and a reachable
 * adjacent return cell. Reachability follows the authored start through existing transfers,
 * so this also works on non-start maps without treating an isolated local island as safe.
 */
export function findSafeRegionDoorway(
  project: Project,
  mapId: MapId,
  region: RegionRect,
): SafeRegionDoorway | null {
  const map = project.maps[mapId];
  if (!map || region.width <= 0 || region.height <= 0) return null;
  const reachable = inspectWorldNavigation(project).reachable.get(mapId);
  if (!reachable || reachable.size === 0) return null;
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  const centerX = region.x + (region.width - 1) / 2;
  const centerY = region.y + (region.height - 1) / 2;
  const candidates: Array<{ x: number; y: number }> = [];
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      if (!inBounds(map, x, y)) continue;
      candidates.push({ x, y });
    }
  }
  candidates.sort((a, b) => {
    const aDistance = Math.abs(a.x - centerX) + Math.abs(a.y - centerY);
    const bDistance = Math.abs(b.x - centerX) + Math.abs(b.y - centerY);
    return aDistance - bDistance || a.y - b.y || a.x - b.x;
  });
  // Prefer returning below the door, matching the existing house-door convention.
  const returnDirections = [[0, 1], [-1, 0], [1, 0], [0, -1]] as const;
  for (const door of candidates) {
    const doorKey = `${door.x},${door.y}`;
    if (occupied.has(doorKey) || !isPassable(project, map, door.x, door.y)) continue;
    for (const [dx, dy] of returnDirections) {
      const x = door.x + dx;
      const y = door.y + dy;
      const key = `${x},${y}`;
      if (occupied.has(key) || !reachable.has(key) || !isPassable(project, map, x, y)) continue;
      if (!canMove(project, map, x, y, door.x, door.y)) continue;
      return { door, returnPosition: { x, y } };
    }
  }
  return null;
}

interface NavigationProblem {
  readonly key: string;
  readonly code: string;
  readonly message: string;
  readonly mapId?: MapId;
  readonly eventId?: string;
  readonly x?: number;
  readonly y?: number;
}

interface TransferLink {
  readonly key: string;
  readonly sourceMapId: MapId;
  readonly event: GameEvent;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
}

interface NavigationInspection {
  readonly problems: readonly NavigationProblem[];
  readonly reachableObjectives: number;
  readonly transferLinks: number;
  readonly scheduleDestinations: number;
  readonly reachable: ReadonlyMap<MapId, ReadonlySet<string>>;
}

/** Follow only transfers whose source event can actually be reached from the authored start. */
function inspectWorldNavigation(project: Project): NavigationInspection {
  const problems: NavigationProblem[] = [];
  const links: TransferLink[] = [];
  const initialSession = startSession(project);
  const interactiveEvents: Array<{
    mapId: MapId;
    event: GameEvent;
    hasTransfer: boolean;
    livingDestinations: readonly { mapId: MapId; x: number; y: number }[];
  }> = [];
  let scheduleDestinations = 0;

  for (const mapId of Object.keys(project.maps).sort()) {
    const map = project.maps[mapId]!;
    for (const event of map.events) {
      // The hard gate follows the same initial active-page precedence as runtime and only
      // treats top-level transfers as guaranteed. Inactive pages and conditional branches
      // must never manufacture a world-graph edge.
      const activePage = resolveEventPage(event, initialSession);
      const commands = activePage
        ? activePage.commands
        : evalCondition(initialSession, event.condition, event)
          ? event.commands
          : [];
      const transfers = commands.filter((command): command is Extract<Command, { kind: "transfer" }> => command.kind === "transfer");
      transfers.forEach((command, index) => links.push({
        key: `${mapId}:${event.id}:${index}`,
        sourceMapId: mapId,
        event,
        mapId: command.mapId,
        x: command.x,
        y: command.y,
      }));
      const livingDestinations = activePage?.movement?.living?.destinations ?? [];
      if (commands.length > 0 || (event.schedule?.length ?? 0) > 0 || livingDestinations.length > 0) {
        interactiveEvents.push({ mapId, event, hasTransfer: transfers.length > 0, livingDestinations });
      }
      scheduleDestinations += (event.schedule?.length ?? 0) + livingDestinations.length;
    }
  }

  const roots = new Map<MapId, Set<string>>();
  const addRoot = (mapId: MapId, x: number, y: number): boolean => {
    const map = project.maps[mapId];
    if (!map || !inBounds(map, x, y) || !isPassable(project, map, x, y)) return false;
    let set = roots.get(mapId);
    if (!set) {
      set = new Set<string>();
      roots.set(mapId, set);
    }
    const key = `${x},${y}`;
    const before = set.size;
    set.add(key);
    return set.size !== before;
  };

  const startMap = project.maps[project.startMapId];
  const startValid = Boolean(
    startMap
    && inBounds(startMap, project.startPos.x, project.startPos.y)
    && isPassable(project, startMap, project.startPos.x, project.startPos.y)
    && hasMoveNeighbor(project, startMap, project.startPos.x, project.startPos.y),
  );
  if (startValid) addRoot(project.startMapId, project.startPos.x, project.startPos.y);
  else {
    problems.push({
      key: "start-position-unplayable",
      code: "start-position-unplayable",
      message: "플레이어 시작 위치가 통행 불가하거나 빠져나갈 수 없습니다.",
      mapId: project.startMapId,
      x: project.startPos.x,
      y: project.startPos.y,
    });
  }

  let reachable = new Map<MapId, Set<string>>();
  const recompute = (): void => {
    reachable = new Map<MapId, Set<string>>();
    for (const [mapId, encodedRoots] of roots) {
      const map = project.maps[mapId];
      if (!map) continue;
      const points = [...encodedRoots].map((value) => {
        const [x, y] = value.split(",").map(Number);
        return { x: x!, y: y! };
      });
      reachable.set(mapId, reachableCells(project, map, points));
    }
  };

  for (let guard = 0; guard <= links.length + Object.keys(project.maps).length; guard += 1) {
    recompute();
    let changed = false;
    for (const link of links) {
      const sourceMap = project.maps[link.sourceMapId];
      const sourceReach = reachable.get(link.sourceMapId);
      if (!sourceMap || !sourceReach || !eventInteractable(project, sourceMap, link.event, sourceReach)) continue;
      changed = addRoot(link.mapId, link.x, link.y) || changed;
    }
    if (!changed) break;
  }
  recompute();

  for (const link of links) {
    const destination = project.maps[link.mapId];
    const destinationPlayable = Boolean(
      destination
      && inBounds(destination, link.x, link.y)
      && isPassable(project, destination, link.x, link.y)
      && hasMoveNeighbor(project, destination, link.x, link.y),
    );
    if (!destinationPlayable) {
      problems.push({
        key: `transfer-destination:${link.key}`,
        code: "transfer-destination-unplayable",
        message: `전송 목적지 ${link.mapId} (${link.x},${link.y})가 없거나 통행할 수 없습니다.`,
        mapId: link.mapId,
        x: link.x,
        y: link.y,
      });
    }
    const sourceMap = project.maps[link.sourceMapId];
    const sourceReach = reachable.get(link.sourceMapId);
    if (!sourceMap || !sourceReach || !eventInteractable(project, sourceMap, link.event, sourceReach)) {
      problems.push({
        key: `transfer-source:${link.key}`,
        code: "transfer-source-unreachable",
        message: `문/전송 이벤트 ${link.event.id}에 시작 위치에서 도달할 수 없습니다.`,
        mapId: link.sourceMapId,
        x: link.event.x,
        y: link.event.y,
      });
    }
  }

  let reachableObjectives = 0;
  for (const objective of interactiveEvents) {
    const map = project.maps[objective.mapId]!;
    const reach = reachable.get(objective.mapId);
    const eventReachable = Boolean(reach && eventInteractable(project, map, objective.event, reach));
    if (eventReachable) reachableObjectives += 1;
    else if (!objective.hasTransfer) {
      problems.push({
        key: `objective:${objective.mapId}:${objective.event.id}`,
        code: "gameplay-event-unreachable",
        message: `게임플레이 이벤트 ${objective.event.id}에 시작 위치에서 도달할 수 없습니다.`,
        mapId: objective.mapId,
        eventId: objective.event.id,
        x: objective.event.x,
        y: objective.event.y,
      });
    }

    for (const [index, entry] of (objective.event.schedule ?? []).entries()) {
      const legacy = entry as unknown as { mapId?: MapId; x?: number; y?: number; at?: { mapId: MapId; x: number; y: number } };
      const at = legacy.at ?? legacy;
      const destination = at.mapId ? project.maps[at.mapId] : undefined;
      const destinationReach = at.mapId ? reachable.get(at.mapId) : undefined;
      if (!at.mapId || typeof at.x !== "number" || typeof at.y !== "number"
        || !destination || !inBounds(destination, at.x, at.y) || !isPassable(project, destination, at.x, at.y)
        || !destinationReach?.has(`${at.x},${at.y}`)) {
        problems.push({
          key: `schedule:${objective.mapId}:${objective.event.id}:${index}`,
          code: "npc-schedule-destination-unreachable",
          message: `NPC ${objective.event.id}의 일정 목적지 ${at.mapId ?? "?"} (${at.x ?? "?"},${at.y ?? "?"})에 도달할 수 없습니다.`,
          mapId: at.mapId,
          ...(typeof at.x === "number" ? { x: at.x } : {}),
          ...(typeof at.y === "number" ? { y: at.y } : {}),
        });
      }
    }

    const livingDestinations = objective.livingDestinations;
    for (const [index, at] of livingDestinations.entries()) {
      const destination = project.maps[at.mapId];
      const destinationReach = reachable.get(at.mapId);
      if (!destination || !inBounds(destination, at.x, at.y) || !isPassable(project, destination, at.x, at.y)
        || !destinationReach?.has(`${at.x},${at.y}`)) {
        problems.push({
          key: `living:${objective.mapId}:${objective.event.id}:${index}`,
          code: "npc-living-destination-unreachable",
          message: `NPC ${objective.event.id}의 이동 목적지 ${at.mapId} (${at.x},${at.y})에 도달할 수 없습니다.`,
          mapId: at.mapId,
          x: at.x,
          y: at.y,
        });
      }
    }
  }

  return { problems, reachableObjectives, transferLinks: links.length, scheduleDestinations, reachable };
}

function reachableCells(
  project: Project,
  map: GameMap,
  roots: readonly { x: number; y: number }[],
): Set<string> {
  const seen = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [];
  for (const root of roots) {
    if (!inBounds(map, root.x, root.y) || !isPassable(project, map, root.x, root.y)) continue;
    const key = `${root.x},${root.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(root);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [dx, dy] of DIRS) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || !canMove(project, map, current.x, current.y, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

function eventInteractable(project: Project, map: GameMap, event: GameEvent, reachable: ReadonlySet<string>): boolean {
  if (reachable.has(`${event.x},${event.y}`)) return true;
  return DIRS.some(([dx, dy]) => {
    const x = event.x + dx;
    const y = event.y + dy;
    if (!reachable.has(`${x},${y}`)) return false;
    return isPassable(project, map, x, y);
  });
}

function targetScopeViolations(base: Project, draft: Project, mapId: MapId, region: RegionRect): { count: number; sample?: string } {
  const before = base.maps[mapId];
  const after = draft.maps[mapId];
  if (!before || !after) return { count: before === after ? 0 : 1, sample: `맵 ${mapId} 추가/삭제` };
  if (before.width !== after.width || before.height !== after.height) {
    return { count: 1, sample: `맵 크기 ${before.width}×${before.height} → ${after.width}×${after.height}` };
  }
  const outsideCells = changedCoordinates(before, after).filter((cell) => !inRegion(cell.x, cell.y, region));
  const beforeEvents = new Map(before.events.map((event) => [event.id, event]));
  const afterEvents = new Map(after.events.map((event) => [event.id, event]));
  const eventIds = new Set([...beforeEvents.keys(), ...afterEvents.keys()]);
  const outsideEvents: string[] = [];
  for (const eventId of eventIds) {
    const previous = beforeEvents.get(eventId);
    const next = afterEvents.get(eventId);
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    const positions = [previous, next].filter((event): event is GameEvent => event !== undefined);
    if (positions.some((event) => !inRegion(event.x, event.y, region))) outsideEvents.push(eventId);
  }
  const count = outsideCells.length + outsideEvents.length;
  const firstCell = outsideCells[0];
  return {
    count,
    ...(firstCell
      ? { sample: `셀 ${firstCell.x},${firstCell.y}` }
      : outsideEvents[0]
        ? { sample: `이벤트 ${outsideEvents[0]}` }
        : {}),
  };
}

function changedCoordinates(before: GameMap | undefined, after: GameMap): { x: number; y: number }[] {
  if (!before || before.width !== after.width || before.height !== after.height) {
    const all: { x: number; y: number }[] = [];
    for (let y = 0; y < after.height; y += 1) for (let x = 0; x < after.width; x += 1) all.push({ x, y });
    return all;
  }
  const changed: { x: number; y: number }[] = [];
  for (let y = 0; y < after.height; y += 1) {
    for (let x = 0; x < after.width; x += 1) {
      const index = y * after.width + x;
      if (before.lowerTiles[index] !== after.lowerTiles[index]
        || before.upperTiles[index] !== after.upperTiles[index]
        || !stacksEqual(before.lowerTileStacks?.[index], after.lowerTileStacks?.[index])
        || !stacksEqual(before.upperTileStacks?.[index], after.upperTileStacks?.[index])) changed.push({ x, y });
    }
  }
  return changed;
}

function changedEventCount(before: GameMap | undefined, after: GameMap): number {
  if (!before) return after.events.length;
  const beforeById = new Map(before.events.map((event) => [event.id, JSON.stringify(event)]));
  const afterById = new Map(after.events.map((event) => [event.id, JSON.stringify(event)]));
  let changed = 0;
  for (const [id, value] of afterById) if (beforeById.get(id) !== value) changed += 1;
  for (const id of beforeById.keys()) if (!afterById.has(id)) changed += 1;
  return changed;
}

function hasMoveNeighbor(project: Project, map: GameMap, x: number, y: number): boolean {
  return DIRS.some(([dx, dy]) => canMove(project, map, x, y, x + dx, y + dy));
}

function connectsToStableCell(
  project: Project,
  before: GameMap,
  after: GameMap,
  mapId: string,
  startX: number,
  startY: number,
): boolean {
  const isStable = (x: number, y: number): boolean => {
    if (mapId === project.startMapId && x === project.startPos.x && y === project.startPos.y) return true;
    const index = y * after.width + x;
    return before.width === after.width
      && before.height === after.height
      && before.lowerTiles[index] === after.lowerTiles[index]
      && before.upperTiles[index] === after.upperTiles[index]
      && stacksEqual(before.lowerTileStacks?.[index], after.lowerTileStacks?.[index])
      && stacksEqual(before.upperTileStacks?.[index], after.upperTileStacks?.[index])
      && isPassable(project, after, x, y);
  };
  const queue = [{ x: startX, y: startY }];
  const seen = new Set<string>([`${startX},${startY}`]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (isStable(current.x, current.y)) return true;
    for (const [dx, dy] of DIRS) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || !canMove(project, after, current.x, current.y, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return false;
}

function restoreMapCell(target: GameMap, before: GameMap, index: number): void {
  target.lowerTiles[index] = before.lowerTiles[index]!;
  target.upperTiles[index] = before.upperTiles[index]!;
  restoreStackCell(target, "lowerTileStacks", before.lowerTileStacks?.[index], index);
  restoreStackCell(target, "upperTileStacks", before.upperTileStacks?.[index], index);
}

function restoreStackCell(
  map: GameMap,
  field: "lowerTileStacks" | "upperTileStacks",
  value: readonly number[] | undefined,
  index: number,
): void {
  const stacks = map[field] ?? {};
  if (value) stacks[index] = [...value];
  else delete stacks[index];
  if (Object.keys(stacks).length > 0) map[field] = stacks;
  else delete map[field];
}

function stacksEqual(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function scheduleFingerprint(project: Project): string {
  return JSON.stringify(Object.keys(project.maps).sort().map((mapId) => [
    mapId,
    project.maps[mapId]!.events.map((event) => [event.id, event.schedule ?? null]),
  ]));
}

function changedRegionCompositionScore(base: Project, draft: Project, mapId: MapId, region: RegionRect): number {
  const before = base.maps[mapId];
  const after = draft.maps[mapId];
  if (!before || !after || before.width !== after.width || before.height !== after.height) return 0;
  const signatures = new Set<string>();
  let changed = 0;
  for (const cell of changedCoordinates(before, after)) {
    if (!inRegion(cell.x, cell.y, region)) continue;
    const index = cell.y * after.width + cell.x;
    signatures.add(`${after.lowerTiles[index]}:${after.upperTiles[index]}:${JSON.stringify(after.lowerTileStacks?.[index] ?? [])}:${JSON.stringify(after.upperTileStacks?.[index] ?? [])}`);
    changed += 1;
  }
  if (changed === 0) return 100;
  const expectedVariety = Math.min(8, changed);
  return Math.round(Math.min(1, signatures.size / expectedVariety) * 100);
}
