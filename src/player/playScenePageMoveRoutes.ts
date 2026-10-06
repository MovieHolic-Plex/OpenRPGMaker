import type { EventAnimationType, EventPageMovement, MoveCommand } from "@/project/types";
import { store } from "@/project/store";
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { yieldingLivingMovers, livingRouteKeyTarget, livingRouteTargetKey, routeForLivingMovement } from "@/player/npcLivingTravel";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState"
import { terrainRevision } from "@/project/tilePassabilityComponents";

type PageMoveRouteSceneContext = Pick<
  PlaySceneContext,
  | "map"
  | "session"
  | "eventPositions"
  | "pageMoveRouteKeys"
  | "pageMoveRouteEventIds"
  | "autonomousNPCs"
  | "registerAutonomousMover"
> & Partial<Pick<PlaySceneContext, "commandMoveRouteEventIds">>;

const DIRECTIONAL_MOVES: MoveCommand[] = [
  { kind: "move", dir: "down" },
  { kind: "move", dir: "left" },
  { kind: "move", dir: "right" },
  { kind: "move", dir: "up" },
];

export function registerPageMoveRoutes(scene: PageMoveRouteSceneContext): void {
  const activeKeys = new Set<string>();
  const activePageRouteEventIds = new Set<string>();
  const project = store.getCurrent();
  for (const view of runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)) {
    if (scene.commandMoveRouteEventIds?.has(view.event.id)) continue;
    const movement = view.movement;
    const reusedLivingKey = movement.type === "living" ? reusableLivingRouteKey(scene, project, view) : undefined;
    if (reusedLivingKey) {
      activeKeys.add(reusedLivingKey);
      activePageRouteEventIds.add(view.event.id);
      const mover = scene.autonomousNPCs.get(view.event.id);
      if (mover) configurePageMover(mover, movement, "sequence", view.animationType);
      continue;
    }
    const route = routeForPageMovement(movement) ?? routeForLivingMovement({ project, map: scene.map, session: scene.session, view });
    if (!route) {
      // 지형이 바뀌어 갈 길이 없어졌다. 예전처럼 무버를 지우면(아래 정리 루프) 진행 중인 걸음의 보간까지 사라져
      // 스프라이트가 반 칸에 멈춘다. 걷는 중이면 무버를 남기고 남은 걸음만 비운다 — 걸음이 끝나면 경로가
      // 소진되어 다음 표면 갱신이 다시 짠다.
      const walking = movement.type === "living" ? scene.autonomousNPCs.get(view.event.id) : undefined;
      // 같은 페이지의 생활 경로로 걷던 무버만 남긴다. 추격 페이지에서 생활 페이지로 막 넘어온 무버는
      // strategy 가 chase 라 걸음을 비워도 계속 쫓아간다(리뷰 반례) — 예전처럼 지운다.
      const livingPrefix = `living:${view.event.id}:${view.pageId ?? "legacy"}:`;
      const ownLivingKeys = walking?.activeMove && scene.pageMoveRouteEventIds.has(view.event.id)
        ? [...scene.pageMoveRouteKeys].filter((kept) => kept.startsWith(livingPrefix))
        : [];
      if (walking && ownLivingKeys.length > 0) {
        walking.moves = [];
        walking.step = 0;
        activePageRouteEventIds.add(view.event.id);
        for (const kept of ownLivingKeys) activeKeys.add(kept);
      }
      continue;
    }
    const key = "key" in route ? route.key : `${view.event.id}:${view.pageId ?? "legacy"}`;
    activeKeys.add(key);
    activePageRouteEventIds.add(view.event.id);
    // 지형이 바뀐 뒤 새로 짠 생활 경로는 키가 같아도(같은 길이의 우회로) 무버를 다시 깔아야 한다.
    const livingStale = movement.type === "living" && livingRouteRevisionsOf(scene)[view.event.id] !== terrainRevision(scene.map);
    const existingMover = scene.autonomousNPCs.get(view.event.id);
    if (movement.type === "living" && existingMover && scene.pageMoveRouteEventIds.has(view.event.id)
      && [...scene.pageMoveRouteKeys].some((kept) => kept.startsWith(`living:${view.event.id}:${view.pageId ?? "legacy"}:`))) {
      // 같은 생활 페이지에서 지형 또는 목적지 변경으로 다시 짠 경우: 무버를 새로 만들지 않고 남은 걸음만 갈아 끼운다.
      // 새로 만들면 진행 중인 걸음(activeMove 보간)·타이머·방향이 초기화돼 NPC 가 제자리에 멈췄다가 튄다.
      // 새 경로는 이미 걸음의 목적지(논리 좌표)에서 짰으므로, 진행 중인 걸음이 끝난 뒤 이어서 소비하면 된다.
      for (const stale of [...scene.pageMoveRouteKeys]) if (stale.startsWith(`living:${view.event.id}:`)) scene.pageMoveRouteKeys.delete(stale);
      scene.pageMoveRouteKeys.add(key);
      existingMover.moves = route.moves;
      existingMover.step = 0;
      existingMover.repeat = route.repeat;
      existingMover.blockedSteps = 0;
      configurePageMover(existingMover, movement, route.strategy, view.animationType);
      livingRouteRevisions.set(scene, { ...livingRouteRevisionsOf(scene), [view.event.id]: terrainRevision(scene.map) });
      continue;
    }
    if (
      !livingStale
      && scene.pageMoveRouteKeys.has(key)
      && scene.pageMoveRouteEventIds.has(view.event.id)
      && scene.autonomousNPCs.has(view.event.id)
    ) {
      const mover = scene.autonomousNPCs.get(view.event.id);
      // 기존 무버는 속도/빈도만 재설정하고 facing 은 보존한다. refreshRuntimeSurfaces
      // 가 이벤트 조사 직후에도 호출되는데, 여기서 facing 을 기본 방향으로 되돌리면
      // turnActionEventTowardPlayer 가 플레이어 쪽으로 돌려놓은 방향이 즉시 취소된다
      // (= "말을 걸어도 NPC 가 쳐다보지 않는" 버그).
      if (mover) configurePageMover(mover, movement, route.strategy, view.animationType);
      continue;
    }
    removePageRouteForEvent(scene, view.event.id);
    scene.pageMoveRouteKeys.add(key);
    scene.pageMoveRouteEventIds.add(view.event.id);
    scene.registerAutonomousMover(view.event.id, route.moves, route.repeat);
    // 실제로 깐 생활 경로에만 그때의 지형 판을 기록한다.
    if (movement.type === "living") livingRouteRevisions.set(scene, { ...livingRouteRevisionsOf(scene), [view.event.id]: terrainRevision(scene.map) });
    const mover = scene.autonomousNPCs.get(view.event.id);
    if (mover) {
      // 신규 무버만 페이지 그래픽의 초기 방향으로 세팅한다.
      mover.facing = view.page?.graphic.direction ?? "down";
      configurePageMover(mover, movement, route.strategy, view.animationType);
    }
  }
  for (const eventId of [...scene.pageMoveRouteEventIds]) {
    if (!activePageRouteEventIds.has(eventId)) removePageRouteForEvent(scene, eventId);
  }
  for (const key of [...scene.pageMoveRouteKeys]) {
    if (!activeKeys.has(key)) scene.pageMoveRouteKeys.delete(key);
  }
}

/**
 * 이미 같은 목표로 걷고 있는 생활 NPC 의 기존 경로 키. 있으면 BFS 를 다시 돌리지 않는다.
 *
 * 왜: 예전에는 표면 갱신(인터프리터 스텝·병렬 이벤트·시간표 점검)마다 생활 NPC 전원이 맵 전체
 * BFS 를 돌고, 키에 현재 좌표가 들어가 있어 한 걸음만 걸어도 무버를 새로 등록했다. 결과 경로는
 * 같은 목표로 가는 나머지 경로라 동작이 같다. 목표가 바뀌었거나 무버가 경로를 다 썼으면 undefined 를
 * 내서 예전처럼 새로 계산한다.
 */
function reusableLivingRouteKey(
  scene: PageMoveRouteSceneContext,
  project: ReturnType<typeof store.getCurrent>,
  view: Parameters<typeof routeForLivingMovement>[0]["view"],
): string | undefined {
  const eventId = view.event.id;
  if (!scene.pageMoveRouteEventIds.has(eventId)) return undefined;

  const mover = scene.autonomousNPCs.get(eventId);
  if (!mover) return undefined;
  const yielding = yieldingLivingMovers.has(mover);
  if (!yielding && (mover.moves.length === 0 || mover.step >= mover.moves.length)) return undefined;
  const prefix = `living:${eventId}:${view.pageId ?? "legacy"}:`;
  let existing: string | undefined;
  for (const key of scene.pageMoveRouteKeys) {
    if (key.startsWith(prefix)) { existing = key; break; }
  }
  if (!existing) return undefined;
  // 대피는 사건 재탐색이 관리한다. 표면 갱신이 원래 목적지로 덮어쓰지 않는다.
  if (yielding) return existing;
  if (livingRouteRevisionsOf(scene)[eventId] !== terrainRevision(scene.map)) return undefined;
  const target = livingRouteTargetKey({ project, map: scene.map, session: scene.session, view }, livingRouteKeyTarget(existing));
  return target !== null && target === livingRouteKeyTarget(existing) ? existing : undefined;
}

/** 생활 NPC 경로를 짤 때의 지형 판(revision). 씬마다, 맵이 바뀌면 판이 달라 자연히 무효다. */
const livingRouteRevisions = new WeakMap<object, Readonly<Record<string, number>>>();
function livingRouteRevisionsOf(scene: object): Readonly<Record<string, number>> {
  return livingRouteRevisions.get(scene) ?? {};
}

export function clampNpcSetting(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(8, Math.max(1, Math.trunc(value)));
}

export function npcMoveDurationMs(speed: number): number {
  const rank = clampNpcSetting(speed);
  return Math.max(80, 640 - rank * 80);
}

export function npcMoveIntervalMs(frequency: number): number {
  const rank = clampNpcSetting(frequency);
  return Math.max(80, 1040 - rank * 160);
}

export function npcPageMoveIntervalMs(movement: EventPageMovement): number {
  return movement.moveIntervalMs !== undefined
    ? Math.max(80, Math.min(10000, Math.round(movement.moveIntervalMs)))
    : npcMoveIntervalMs(movement.frequency);
}

function routeForPageMovement(
  movement: EventPageMovement
): (Pick<AutonomousMover, "moves" | "repeat" | "strategy">) | null {
  switch (movement.type) {
    case "fixed":
      return null;
    case "random":
      return { moves: [...DIRECTIONAL_MOVES], repeat: true, strategy: "random" };
    case "approach":
      return { moves: [...DIRECTIONAL_MOVES], repeat: true, strategy: "approach" };
    case "chase":
      return { moves: [], repeat: true, strategy: "chase" };
    case "custom":
      return movement.route
        ? { moves: [...movement.route.moves], repeat: movement.route.repeat, strategy: "sequence" }
        : null;
    case "living":
      return null;
  }
}

function configurePageMover(
  mover: AutonomousMover,
  movement: EventPageMovement,
  strategy: AutonomousMover["strategy"],
  animationType: EventAnimationType
): void {
  mover.strategy = strategy;
  // 생활 이동과 명시적으로 skippable:false인 순찰은 막힌 걸음을 보존한다.
  mover.preserveBlockedSteps = movement.type === "custom" && movement.route?.skippable === false;
  mover.retryBlockedSteps = movement.type === "living" || mover.preserveBlockedSteps;
  mover.livingRoute = movement.type === "living";
  mover.directionFix = animationType === "fixedDirection" || animationType === "fixedDirectionStep";
  mover.speedRank = clampNpcSetting(movement.speed);
  mover.frequencyRank = clampNpcSetting(movement.frequency);
  mover.moveDurationMs = npcMoveDurationMs(movement.speed);
  mover.moveIntervalMs = npcPageMoveIntervalMs(movement);
  mover.sightRange = normalizeOptionalRange(movement.sightRange);
  mover.giveUpRange = normalizeOptionalRange(movement.giveUpRange);
  mover.pathfind = movement.pathfind !== false;
}

function removePageRouteForEvent(scene: PageMoveRouteSceneContext, eventId: string): void {
  if (scene.pageMoveRouteEventIds.delete(eventId)) scene.autonomousNPCs.delete(eventId);
  for (const key of [...scene.pageMoveRouteKeys]) {
    if (key.startsWith(`${eventId}:`)) scene.pageMoveRouteKeys.delete(key);
  }
}

function normalizeOptionalRange(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.trunc(value));
}
