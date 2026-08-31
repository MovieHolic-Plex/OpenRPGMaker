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
  readonly outOfScopeChanges?: number;
  readonly reachableObjectives?: number;
  readonly unreachableObjectives?: number;
  readonly transferLinks?: number;
  readonly scheduleDestinations?: number;
  /** Changed-region tile-pair variety, 0..100. This is a deterministic composition heuristic, not image vision. */
  readonly compositionScore?: number;
  /** 다듬기(polish) 전용 — 경계 연속성 0..100. regionBlend.analyzeRegionBlend 가 채운다. */
  readonly blendScore?: number;
  /** 다듬기 전 같은 척도의 점수. 개선/악화를 비교하는 근거다. */
  readonly blendScoreBefore?: number;
  /** 바깥 길·물이 영역 경계에서 끊긴 칸 수. */
  readonly brokenCrossings?: number;
  /** 이 초안이 새로 막은 진입 칸 수. */
  readonly blockedEntrances?: number;
  /** 경계 바로 밖 1칸에서 오토타일 변형만 고친 칸 수. */
  readonly seamCells?: number;
}

/**
 * 권고 보고서. **어떤 필드도 적용을 막지 않는다.**
 *
 * 왜 (2026-08-30): 영역작업(AI) 뒤에 있던 검증게이트가 휴리스틱 한 건으로 제안 전체를 반려해,
 * 사용자에게 아무것도 남지 않는 일이 반복됐다(나무 0그루 오판, 호수 마을 맵의 전면 반려).
 * 이제 검사는 사실만 보고하고, 적용 여부는 사용자 결정(적용/버리기)과 되돌리기가 정한다.
 * severity 는 소견의 세기이며 정책이 아니다 — 이 값으로 적용을 거부하는 코드를 다시 만들지 말 것.
 */
export interface HarnessReviewReport {
  readonly issues: readonly HarnessIssue[];
  readonly metrics: HarnessGameplayMetrics;
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

/**
 * 영역 초안 진단. **읽기 전용이다** — 초안을 고치지도, 적용을 막지도 않는다.
 *
 * 반환하는 project 는 입력 초안의 복제 그대로다(호출부가 소유권을 갖도록 분리만 한다).
 * 예전에는 여기서 고립 통행 셀을 원본으로 되돌리고 도달 불가 소품 이벤트를 지웠는데,
 * 그 결과 유령 미리보기에서 본 것과 적용된 것이 달라져 "AI 가 깐 게 사라졌다" 가 됐다.
 */
export function reviewRegionDraft(input: {
  readonly base: Project;
  readonly draft: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  /**
   * 스코프 검사(영역 밖 변경 감지)에만 쓰는 사각형. 기본값은 region.
   * 다듬기가 경계 1칸의 오토타일 변형을 마감하므로 그 경로만 region 을 1칸 넓혀 넘긴다 —
   * 고립·도달·일정 검사는 계속 region 기준이다.
   */
  readonly scopeRegion?: RegionRect;
}): HarnessReviewResult {
  const project = cloneDetachedDraft(input.draft);
  const issues: HarnessIssue[] = [];
  let changedCells = 0;
  let changedEvents = 0;
  let passableChangedCells = 0;

  const scope = targetScopeViolations(input.base, project, input.mapId, input.scopeRegion ?? input.region);
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
      if (isPassable(project, after, cell.x, cell.y)) passableChangedCells += 1;
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
  const navigation = inspectWorldNavigation(project);
  const baselineProblemKeys = new Set(baseNavigation.problems.map((problem) => problem.key));
  // 기준 프로젝트에 이미 있던 문제는 이번 작업의 소견이 아니다 — 새로 생긴 것만 보고한다.
  const newNavigationProblems = navigation.problems.filter((problem) => !baselineProblemKeys.has(problem.key));
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
    outOfScopeChanges: scope.count,
    reachableObjectives: navigation.reachableObjectives,
    unreachableObjectives: newNavigationProblems.length,
    transferLinks: navigation.transferLinks,
    scheduleDestinations: navigation.scheduleDestinations,
    compositionScore: changedRegionCompositionScore(input.base, project, input.mapId, input.region),
  };
  return { project, report: { issues, metrics } };
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
