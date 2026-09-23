/**
 * Room Harness 공유 세션 엔진 — 킷(interior/dungeon/…) 공통 오케스트레이션.
 * 세션 저장/로드, advance 루프, 맵트리 등록, 원샷 파이프라인, 평가를 한 곳에서 담당한다.
 * 툴 파일은 이 함수들을 kitId로 호출하는 얇은 래퍼가 된다(툴 이름은 키트별 유지).
 */
import { getRoomKit } from "./registry";
import { loadSession as loadFromBag, listSessions as listFromBag, saveSession as saveToBag } from "./sessionStore";
import type { RoomHarnessIssue, RoomSession } from "./types";
import { ToolError, type ToolExecResult } from "@/editor/tools/types";
import type { Command, GameMap, Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { exceedsMapDimensionLimit, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";

const ROOM_SESSION_BAG = "roomHarnessSessions";

export function saveRoomSession(project: Project, session: RoomSession): void {
  saveToBag(project, ROOM_SESSION_BAG, session);
}
const saveSession = saveRoomSession;

export function loadRoomSession(project: Project, sessionId: string): RoomSession | null {
  const session = loadFromBag<RoomSession>(project, ROOM_SESSION_BAG, sessionId);
  if (!session) return null;
  return { ...session, checkpoints: session.checkpoints ?? [], lockedRoomIds: session.lockedRoomIds ?? [] };
}

export function listRoomSessions(project: Project): readonly RoomSession[] {
  return listFromBag<RoomSession>(project, ROOM_SESSION_BAG).map((session) => ({
    ...session,
    checkpoints: session.checkpoints ?? [],
    lockedRoomIds: session.lockedRoomIds ?? [],
  }));
}

/**
 * 세션이 만든 맵에 플랜 원본을 남긴다 — 세션은 직렬화되지 않으므로 이것이 유일한 영속 흔적이다.
 * `furnish_interior_space{mapId}` 가 프로젝트 재오픈 후에도 동작하는 근거(진단 근본원인 8).
 */
function stampRoomHarnessPlan(project: Project, mapId: string, kitId: string, plan: unknown): void {
  const map = project.maps[mapId];
  if (!map) return;
  map.roomHarnessPlan = { kitId, plan: structuredClone(plan) };
}

/** mapId 로 살아 있는 세션 찾기(가장 마지막 것). 없으면 null. */
export function findRoomSessionByMapId(project: Project, mapId: string): RoomSession | null {
  const matches = listRoomSessions(project).filter((session) => session.mapId === mapId);
  return matches.length > 0 ? matches[matches.length - 1]! : null;
}

/**
 * mapId 로 세션을 확보한다 — 살아 있으면 그대로, 없으면 맵에 남은 `roomHarnessPlan` 으로 재수립한다.
 *
 * 재수립 세션은 checkpoints 가 비어 있다(과거 레이어 스냅샷은 메모리에만 있었으므로 복원 불가).
 * 방 단위 재시공에는 plan + 현재 맵만 있으면 충분하다.
 */
export function ensureRoomSessionForMap(project: Project, mapId: string): RoomSession {
  const existing = findRoomSessionByMapId(project, mapId);
  if (existing) return existing;
  const map = project.maps[mapId];
  if (!map) {
    throw new ToolError(`map 없음: ${mapId} — get_project_summary 로 유효한 맵 id 를 확인하세요`, {
      code: "map-not-found",
      mapId,
    });
  }
  const stamped = map.roomHarnessPlan;
  if (!stamped) {
    throw new ToolError(
      `맵 ${mapId} 는 방 하네스로 시공된 맵이 아닙니다 — 방 단위 재시공 대신 `
        + `fill_region / tile_erase / place_props 로 직접 편집하세요.`,
      { code: "invalid-args", mapId },
    );
  }
  const kit = requireKit(stamped.kitId);
  kit.ensureHarness(project);
  const checklist: RoomSession["checklist"] = Object.fromEntries(kit.buildOrder.map((layer) => [layer, "done"]));
  const session: RoomSession = {
    id: `room_${stamped.kitId}_${mapId}_restored`,
    kitId: stamped.kitId,
    plan: stamped.plan,
    checklist,
    mapId,
    log: [`[restore] ${mapId} 플랜을 맵에서 복원했습니다(세션 미보존)`],
    checkpoints: [],
    lockedRoomIds: [],
  };
  saveSession(project, session);
  return session;
}

function warningIssue(session: RoomSession, layer: string, message: string): RoomHarnessIssue {
  const coordinate = message.match(/\((-?\d+),\s*(-?\d+)\)/);
  return {
    code: message.startsWith("walkability:") ? "walkability" : "layer-warning",
    severity: message.startsWith("walkability:") ? "error" : "warning",
    message,
    mapId: session.mapId,
    layer,
    ...(coordinate ? { x: Number(coordinate[1]), y: Number(coordinate[2]) } : {}),
  };
}

// 세션이 만든 맵은 맵 트리에도 올라가야 에디터 맵 목록/전환 UI에 보인다(mapTools create_map 관례).
function registerMapInTree(draft: Project, mapId: string): void {
  if (!draft.maps[draft.mapTree.mapId]) {
    draft.mapTree = { mapId, children: [] };
  } else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some((child) => child.mapId === mapId)) {
    draft.mapTree.children.push({ mapId, children: [] });
  }
}

function requireKit(kitId: string) {
  const kit = getRoomKit(kitId);
  if (!kit) throw new ToolError(`알 수 없는 하네스 킷: ${kitId}`, { code: "invalid-args" });
  return kit;
}

/** 맵의 저작량(칠한 타일 수·이벤트 수) — 폐기 경고에 실수치를 싣기 위한 측정. */
function measureMapAuthoring(map: { lowerTiles: number[]; upperTiles: number[]; events: unknown[] }): {
  paintedTiles: number;
  events: number;
} {
  const painted = (tiles: number[]): number => tiles.reduce((n, tile) => (tile > 0 ? n + 1 : n), 0);
  return { paintedTiles: painted(map.lowerTiles) + painted(map.upperTiles), events: map.events.length };
}

/**
 * 저작 흔적이 없는 맵: 방 하네스 플랜 없음(진행 중인 세션 맵이 아님), 이벤트 0,
 * 아래층은 한 종류 타일(또는 비어 있음), 윗층은 비어 있음.
 */
function isPristineBlankMap(map: { lowerTiles: number[]; upperTiles: number[]; events: unknown[]; roomHarnessPlan?: unknown }): boolean {
  if (map.roomHarnessPlan !== undefined) return false;
  if (map.events.length > 0) return false;
  if (map.upperTiles.some(tile => tile > 0)) return false;
  const lower = new Set(map.lowerTiles.filter(tile => tile > 0));
  return lower.size <= 1;
}

/**
 * **기존 맵 무음 교체 차단** (2026-08-29 modify 진단 근본원인 1).
 *
 * `project.maps[mapId] = kit.createEmptyMap(plan)` 은 존재 검사가 없었다. 실측: 타일 300칸 +
 * 이벤트 1개가 있는 20×15 맵에 같은 mapId 로 `start_interior_room_session` 을 걸면
 * `ok:true` / issues 0 / warnings 0 으로 16×13 빈 방이 되고 저작물이 사라졌다.
 * `create_map`(mapTools.ts) · `build_castle` · `author_village` 는 전부 `map-exists` 가드가 있는데
 * 이 경로만 없었다.
 *
 * `replaceExisting:true` 를 명시하면 통과시키되 무엇을 버렸는지 실수치로 경고에 남긴다.
 */
/** 이어받는 빈 맵의 이름 — name 인자를 생략하면 create_map 때 붙인 장소 이름을 킷 기본 이름으로 덮지 않는다. */
function inheritedBlankMapName(project: Project, mapId: string, args: Record<string, unknown>): string | undefined {
  const existing = project.maps[mapId];
  if (!existing || args.replaceExisting === true || !isPristineBlankMap(existing)) return undefined;
  if (typeof args.name === "string" && args.name.trim()) return undefined;
  return existing.name?.trim() || undefined;
}

function guardExistingMap(project: Project, mapId: string, args: Record<string, unknown>): string[] {
  const existing = project.maps[mapId];
  if (!existing) return [];
  if (args.replaceExisting !== true && isPristineBlankMap(existing)) {
    // create_map 으로 자리만 잡아 둔 맵(이벤트 0, 한 가지 바닥 타일, 윗층 없음)은 잃을 저작물이 없다.
    // 예전에는 여기서 map-exists 로 막아 모델이 다른 mapId 로 새 방을 만들었고, 같은 이름의 빈 맵이
    // 고아로 남았다(2026-09-23 등대지기 재시험: 「서리불꽃 등대 꼭대기」 20×15 빈 맵 + 실제 20×16).
    return [`create_map 으로 만든 빈 맵 ${mapId}(${existing.width}×${existing.height}, 이벤트 0)를 이어받아 방을 시공했습니다.`];
  }
  if (args.replaceExisting !== true) {
    throw new ToolError(
      `이미 존재하는 맵입니다: ${mapId} — 기존 실내/방 맵을 고치려면 그 맵을 대상으로 `
        + `furnish_interior_space / fill_region / tile_erase / place_props 를 쓰세요. `
        + `정말 새 방이 필요하면 다른 mapId 를 쓰고, 기존 맵을 버리는 파괴적 재시공이면 replaceExisting:true 를 명시하세요.`,
      { code: "map-exists", mapId },
    );
  }
  const measured = measureMapAuthoring(existing);
  return [
    `기존 맵 ${mapId}(${existing.width}×${existing.height}, 칠한 타일 ${measured.paintedTiles}칸, `
      + `이벤트 ${measured.events}개)를 폐기하고 새 방으로 교체했습니다 — replaceExisting:true 로 요청됨.`,
  ];
}

/**
 * 지원 상한 검사 — `kit.createEmptyMap`/`kit.runPipeline` 이 셀 배열을 잡기 **전에** 건다.
 *
 * 킷 파서(interiorKit/dungeonKit)에는 하한만 있어서 상한이 없는 유일한 방 생성 경로였다.
 * 킷마다 넣지 않고 엔진 한 곳에 두는 이유: 새 킷이 붙어도 자동으로 같은 계약을 받고,
 * demo 플랜(파서를 안 타는 경로)도 같이 걸린다(OPRN-OUT-018).
 */
function assertRoomPlanSize(mapId: string, plan: unknown): void {
  const record = plan as { readonly width?: unknown; readonly height?: unknown } | null;
  const width = typeof record?.width === "number" ? record.width : 0;
  const height = typeof record?.height === "number" ? record.height : 0;
  if (!exceedsMapDimensionLimit(width, height)) return;
  throw new ToolError(`${mapSizeLimitMessage("방 크기")} — 요청: ${mapId} (${width}×${height})`, {
    code: "map-too-large",
    mapId,
  });
}

/** 멀티턴 세션 시작 — 빈 맵 + 체크리스트 생성. */
export function startRoomSession(project: Project, kitId: string, args: Record<string, unknown>): ToolExecResult {
  const kit = requireKit(kitId);
  kit.ensureHarness(project);
  const parsed = kit.parsePlan(args);
  const plan = kit.preparePlan?.(parsed, project) ?? parsed;
  const mapId = kit.mapIdOf(plan);
  const sessionId = `room_${kit.kitId}_${mapId}_${Date.now().toString(36)}`;
  const checklist: RoomSession["checklist"] = Object.fromEntries(
    kit.buildOrder.map((l) => [l, l === "plan" ? "done" : "open"]),
  );
  const keptName = inheritedBlankMapName(project, mapId, args);
  const replaceWarnings = guardExistingMap(project, mapId, args);
  assertRoomPlanSize(mapId, plan);
  const map = kit.createEmptyMap(plan);
  if (keptName) map.name = keptName;
  project.maps[mapId] = map;
  stampRoomHarnessPlan(project, mapId, kit.kitId, plan);
  registerMapInTree(project, mapId);
  const startWarnings = [...replaceWarnings, ...reconcilePlayerStart(project, mapId)];
  const session: RoomSession = {
    id: sessionId,
    kitId: kit.kitId,
    plan,
    checklist,
    mapId,
    log: [kit.startLog?.(plan) ?? `[plan] ${mapId}`],
    checkpoints: [{
      index: 0,
      layer: "plan",
      state: "done",
      summary: "계획 확정",
      issues: [],
      mapSnapshot: structuredClone(map),
    }],
    lockedRoomIds: [],
  };
  saveSession(project, session);
  return {
    summary: `${kit.kitId} 세션 ${sessionId} 시작 · map=${mapId}`,
    // mapId 를 data 에 명시한다 — 완료 게이트(workItemOutcome.MAP_CREATING_TOOLS)가 세션 시작을
    // 맵 생성으로 세면서 어느 맵인지 알아야 한다.
    data: { sessionId, kitId: kit.kitId, mapId, plan, checklist, buildOrder: kit.buildOrder, nextLayer: kit.buildOrder.find((l) => l !== "plan") ?? null },
    ...(startWarnings.length > 0 ? { warnings: startWarnings } : {}),
  };
}

/**
 * 방 맵이 **시작 맵을 교체**했을 때 플레이어 시작 위치를 방 안 통행 가능한 칸으로 옮긴다.
 *
 * 2026-08-23 실측: 빈 시작 맵에 `start_interior_room_session` 을 걸면 새 실내 맵이 시작 맵을
 * 덮어써 기존 시작 좌표가 벽이 되고, 커밋이 `시작 위치가 통행 불가 타일입니다: (10, 8)` 로
 * 거부됐다. 모델은 좌표를 4번 바꿔 재시도했지만 원인이 자기 인자가 아니라 시작 좌표라 전부 실패했다.
 * 빈 시작 맵의 기본 좌표는 저작된 의도가 아니므로, 요청된 시공을 살리고 좌표를 옮긴 뒤 경고한다.
 */
function reconcilePlayerStart(project: Project, mapId: string): string[] {
  if (project.startMapId !== mapId) return [];
  const map = project.maps[mapId];
  if (!map) return [];
  const start = project.startPos;
  if (isPassable(project, map, start.x, start.y)) return [];
  for (let y = map.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!isPassable(project, map, x, y)) continue;
      project.startPos = { x, y };
      return [
        `실내 맵이 시작 맵(${mapId})을 교체해 기존 시작 위치 (${start.x}, ${start.y})가 벽이 되었습니다 — ` +
          `방 안 통행 가능한 칸 (${x}, ${y})로 옮겼습니다. 다른 위치를 원하면 set_start_position을 쓰세요.`,
      ];
    }
  }
  return [
    `실내 맵이 시작 맵(${mapId})을 교체했지만 통행 가능한 칸을 찾지 못했습니다 — ` +
      `바닥(floor) 레이어를 먼저 시공하거나 다른 맵에 방을 만드세요.`,
  ];
}

function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** (x,y) 에서 가장 가까운 통행 가능 칸. 원래 착지 의도를 최대한 보존한다. */
function nearestPassableCell(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let cy = 0; cy < map.height; cy += 1) {
    for (let cx = 0; cx < map.width; cx += 1) {
      if (!isPassable(project, map, cx, cy)) continue;
      const distance = (cx - x) ** 2 + (cy - y) ** 2;
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

/**
 * 교체된 맵을 겨냥한 **다른 맵의 transfer 착지점**을 되살린다.
 *
 * 2026-08-29 실측: 방 맵은 전면 VOID 로 시작해 방 footprint 만 바닥으로 칠하므로, 기존 맵을
 * 교체하면 마을 문에서 들어오는 착지 칸이 벽이 되거나(맵 축소 시) 경계 밖으로 나간다.
 * 커밋 게이트가 `transfer-impassable` / `transfer-bounds` 로 거부하는데, 원인이 모델의 인자가
 * 아니라 **다른 맵에 있는 좌표**라서 재시도가 전부 실패한다.
 *
 * `enforceWalkability` 는 `plan.door` 기준 BFS 만 뚫으므로 외부 착지 칸을 보호하지 않는다.
 * 시작 위치 보정([[reconcilePlayerStart]])만으로는 이 축이 남는다 — 두 축은 독립이다.
 */
function reconcileInboundTransfers(project: Project, mapId: string): string[] {
  const map = project.maps[mapId];
  if (!map) return [];

  const broken: Extract<Command, { kind: "transfer" }>[] = [];
  const collect = (commands: readonly Command[] | undefined): void => {
    for (const command of commands ?? []) {
      if (command.kind === "transfer" && command.mapId === mapId) {
        if (!inBounds(map, command.x, command.y) || !isPassable(project, map, command.x, command.y)) {
          broken.push(command);
        }
      }
      // 분기 안쪽도 봐야 한다 — 마을 문은 대개 choices/fork 안에 들어 있다.
      if (command.kind === "choices") {
        for (const option of command.options) collect(option.branch);
        collect(command.cancelBranch);
      } else if (command.kind === "presentItem") {
        presentItemBranchLists(command).forEach(collect);
      } else if (command.kind === "fork") {
        collect(command.then);
        collect(command.else);
      } else if (command.kind === "loop") {
        collect(command.body);
      } else if (command.kind === "shop") {
        collect(command.transactionBranch);
      }
    }
  };
  for (const candidate of Object.values(project.maps)) {
    for (const event of candidate.events) {
      collect(event.commands);
      for (const page of event.pages ?? []) collect(page.commands);
    }
  }
  for (const commonEvent of project.commonEvents) collect(commonEvent.commands);

  if (broken.length === 0) return [];

  // 착지 칸이 여러 개 깨졌어도 목적지는 보통 하나(현관)다. 좌표별로 한 번만 계산하고
  // 경고도 좌표별로 접는다 — 같은 문구 15줄이 되면 정작 다른 경고를 못 찾는다.
  const moved = new Map<string, { from: { x: number; y: number }; to: { x: number; y: number }; count: number }>();
  const unresolved = new Set<string>();
  for (const command of broken) {
    const key = `${command.x},${command.y}`;
    const already = moved.get(key);
    if (already) {
      command.x = already.to.x;
      command.y = already.to.y;
      already.count += 1;
      continue;
    }
    if (unresolved.has(key)) continue;
    const target = nearestPassableCell(project, map, command.x, command.y);
    if (!target) {
      unresolved.add(key);
      continue;
    }
    moved.set(key, { from: { x: command.x, y: command.y }, to: { x: target.x, y: target.y }, count: 1 });
    command.x = target.x;
    command.y = target.y;
  }

  const warnings: string[] = [];
  for (const entry of moved.values()) {
    warnings.push(
      `방 맵이 ${mapId}을 교체해 이 맵으로 들어오는 착지 좌표 (${entry.from.x}, ${entry.from.y})가 ` +
        `통행 불가/경계 밖이 되었습니다 — 가장 가까운 통행 가능한 칸 (${entry.to.x}, ${entry.to.y})로 옮겼습니다` +
        `${entry.count > 1 ? ` (transfer ${entry.count}건)` : ""}. 다른 위치를 원하면 해당 transfer 명령을 직접 고치세요.`,
    );
  }
  for (const key of unresolved) {
    warnings.push(
      `방 맵이 ${mapId}을 교체해 착지 좌표 (${key})가 통행 불가가 되었으나 대신할 통행 가능한 칸이 없습니다 — ` +
        `바닥(floor) 레이어를 먼저 시공하세요.`,
    );
  }
  return warnings;
}

/**
 * 기존 맵을 통째로 교체한 직후에 깨지는 **프로젝트 수준 계약**을 보정한다.
 *
 * 맵 하나만 보면 완결이지만 프로젝트에는 그 맵을 가리키는 좌표가 두 종류 더 있다:
 * 플레이어 시작 위치와 다른 맵에서 들어오는 transfer 착지점. 둘 다 커밋 게이트가
 * `error` 로 막으므로, 보정하지 않으면 시공 자체가 성공했는데도 적용이 거부된다.
 */
function reconcileMapReplacement(project: Project, mapId: string): string[] {
  return [...reconcilePlayerStart(project, mapId), ...reconcileInboundTransfers(project, mapId)];
}

/** 세션 체크리스트의 다음 open 레이어 하나를 시공/검증. */
export function advanceRoomBuild(project: Project, sessionId: string, forceLayer?: string): ToolExecResult {
  const session = loadRoomSession(project, sessionId);
  if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
  const kit = requireKit(session.kitId);
  kit.ensureHarness(project);
  const layer = forceLayer ?? kit.buildOrder.find((l) => l !== "plan" && session.checklist[l] === "open");
  if (!layer) {
    return { summary: "모든 레이어 완료", data: { sessionId, checklist: session.checklist, done: true } };
  }
  const map = project.maps[session.mapId];
  if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
  const result = kit.applyLayer(map, session.plan, layer, project);
  project.maps[session.mapId] = result.map;
  session.checklist[layer] = result.ok ? "done" : "failed";
  session.log.push(`[${layer}] ${result.summary}`);
  const issues = result.warnings.map((warning) => warningIssue(session, layer, warning));
  session.checkpoints.push({
    index: session.checkpoints.length,
    layer,
    state: session.checklist[layer]!,
    summary: result.summary,
    issues,
    mapSnapshot: structuredClone(result.map),
  });
  saveSession(project, session);
  const nextLayer = kit.buildOrder.find((l) => session.checklist[l] === "open") ?? null;
  // 마지막 레이어까지 끝난 시점에만 보정한다. 시작 시점(빈 맵)에는 통행 가능한 칸이 없어
  // 착지점을 옮길 곳이 없고, 중간 레이어에서 옮기면 다음 레이어가 그 칸을 다시 막을 수 있다.
  const reconcileWarnings = nextLayer === null ? reconcileMapReplacement(project, session.mapId) : [];
  const warnings = [...result.warnings, ...reconcileWarnings];
  return {
    summary: result.summary,
    warnings,
    data: { sessionId, layer, ok: result.ok, warnings, checklist: session.checklist, nextLayer, done: !nextLayer },
  };
}

/** 원샷 파이프라인 — 모든 레이어 시공. args.demo 지정 시 데모 플랜 사용. */
export function runRoomPipeline(project: Project, kitId: string, args: Record<string, unknown>): ToolExecResult {
  const kit = requireKit(kitId);
  kit.ensureHarness(project);
  const demo = args.demo ? String(args.demo) : "";
  let plan;
  if (demo) {
    const found = kit.demoMatch?.(demo) ?? kit.demoPlans.find((p) => (p as { theme?: string }).theme === demo);
    if (!found) throw new ToolError(`unknown demo ${demo}`, { code: "invalid-args" });
    plan = found;
    if (args.mapId || args.name) {
      plan = { ...(found as Record<string, unknown>), ...(args.mapId ? { mapId: String(args.mapId) } : {}), ...(args.name ? { name: String(args.name) } : {}) } as typeof found;
    }
  } else {
    plan = kit.parsePlan(args);
  }
  plan = kit.preparePlan?.(plan, project) ?? plan;
  const mapId = kit.mapIdOf(plan);
  const keptName = inheritedBlankMapName(project, mapId, args);
  const replaceWarnings = guardExistingMap(project, mapId, args);
  assertRoomPlanSize(mapId, plan);
  const result = kit.runPipeline(plan, project);
  if (keptName) result.map.name = keptName;
  project.maps[mapId] = result.map;
  stampRoomHarnessPlan(project, mapId, kit.kitId, plan);
  registerMapInTree(project, mapId);
  // 멀티턴 경로(startRoomSession)에만 있던 보정을 원샷에도 건다. 이게 빠져 있어서
  // "이 맵을 집으로 만들어라" 가 `시작 위치가 통행 불가 타일입니다` 로 거부됐다(2026-08-29 실측).
  const reconcileWarnings = reconcileMapReplacement(project, mapId);
  // 교체 가드 경고(#262)까지 합친다 — 기존 맵을 덮어썼다는 사실이 결과에 남아야 한다.
  const warnings = [...replaceWarnings, ...result.warnings, ...reconcileWarnings];
  return {
    summary: result.ok ? `${kit.kitId} 파이프라인 완료 ${mapId}` : `${kit.kitId} 파이프라인 이슈 ${result.warnings.length}`,
    warnings,
    data: { kitId: kit.kitId, mapId, plan, log: result.log, warnings, ok: result.ok },
  };
}

/** 완성 세션 맵 평가. */
export function evaluateRoom(project: Project, sessionId: string, attempt = 1): ToolExecResult {
  const session = loadRoomSession(project, sessionId);
  if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
  const kit = requireKit(session.kitId);
  if (!kit.evaluate) throw new ToolError(`${kit.kitId}는 평가를 지원하지 않는다`, { code: "invalid-args" });
  const map = project.maps[session.mapId];
  if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
  const report = kit.evaluate(map, session.plan, attempt, project);
  return {
    summary: report.ok ? `${kit.kitId} 평가 합격 (score ${report.score})` : `${kit.kitId} 평가 ${report.issues.length}건 (score ${report.score})`,
    data: { sessionId, mapId: session.mapId, report },
  };
}

/** 킷 데모 플랜 나열. */
export function listRoomDemos(kitId: string): ToolExecResult {
  const kit = requireKit(kitId);
  return { summary: `${kit.kitId} 데모 ${kit.demoPlans.length}종`, data: { kitId: kit.kitId, themes: kit.themes, plans: kit.demoPlans } };
}
