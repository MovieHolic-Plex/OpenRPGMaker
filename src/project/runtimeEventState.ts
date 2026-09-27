import { resolveEventPage, type EventPageLocationContext } from "@/project/io";
import { resolveEventAppearanceGraphic } from "./characterAppearances";
import {
  CHARACTER_FOOTPRINT_AXIS_MAX,
  footprintBounds,
  normalizeCharacterFootprint,
  normalizeCharacterScale,
  normalizePassRows,
  passageBounds,
  pointRect,
  rectsOverlap,
} from "@/project/footprint";
import type {
  AssetRef,
  CharacterFootprint,
  Dir,
  EventAnimationType,
  EventPage,
  EventPageMovement,
  EventPriority,
  FootprintRect,
  GameMap,
  GameEvent,
  Project,
  Trigger,
} from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

const DEFAULT_PAGE_MOVEMENT: EventPageMovement = {
  type: "fixed",
  speed: 3,
  frequency: 3,
};

export interface RuntimeEventPosition {
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
}

export type RuntimeEventPositions = Record<string, RuntimeEventPosition>;

export interface RuntimeEventView {
  readonly event: GameEvent;
  readonly page: EventPage | undefined;
  readonly pageId: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly trigger: Trigger;
  readonly priority: EventPriority;
  readonly overlapForbidden: boolean;
  /** 몸 사각의 크기. 생략된 페이지는 1x1 로 정규화돼 언제나 존재한다. */
  readonly footprint: CharacterFootprint;
  /** 통행을 막는 행 수. 생략 시 footprint.height(= 몸 전체, 1차와 동일). */
  readonly passRows: number;
  /**
   * 몸 사각 — 조사·접촉 발동, 전투 히트, 점유, 렌더 중앙, 편집 클릭.
   *
   * 크기(footprint/passRows)가 아니라 **계산된 사각**을 내보내는 이유: 소비자가 크기에
   * passRows 를 적용하는 걸 잊으면 통행이 조용히 열린다. 이름 붙은 사각을 주면 그 실수를
   * 할 수 없다. 2차 스펙 §3.
   */
  readonly bodyRect: FootprintRect;
  /** 통행 차단 사각 — 몸 사각의 하단 passRows 행. passRows 가 전체면 bodyRect 와 같다. */
  readonly passRect: FootprintRect;
  /** 스프라이트 렌더 배율. 생략 시 1. 사각과 독립. */
  readonly scale: number;
  readonly transparent: boolean;
  readonly animationType: EventAnimationType;
  readonly movement: EventPageMovement;
  readonly sprite: AssetRef | undefined;
  readonly direction: Dir | undefined;
  readonly runtimeDirection: Dir | undefined;
}

export function initialRuntimeEventPositions(events: readonly GameEvent[]): RuntimeEventPositions {
  const positions: RuntimeEventPositions = {};
  for (const event of events) {
    positions[event.id] = { x: event.x, y: event.y };
  }
  return positions;
}

export function moveRuntimeEventPosition(
  positions: RuntimeEventPositions,
  eventId: string,
  x: number,
  y: number,
  direction?: Dir
): void {
  positions[eventId] = { x, y, direction: direction ?? positions[eventId]?.direction };
}

export function setRuntimeEventPositionDirection(
  positions: RuntimeEventPositions,
  eventId: string,
  direction: Dir
): void {
  const position = positions[eventId];
  if (!position) return;
  positions[eventId] = { ...position, direction };
}

export function runtimeEventView(
  event: GameEvent,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  project?: Pick<Project, "database" | "assets">,
  /**
   * 명명 로케이션 기하. `insideLocation` 페이지 조건이만 읽고, 순회기가 현재 맵에서 넘긴다.
   * 삹잡이 맵을 가로지러 오간 이벤트도 **지금 서 있는 맵**의 로케이션으로 평가된다.
   */
  pageContext?: EventPageLocationContext,
): RuntimeEventView {
  const authoredPage = resolveEventPage(event, session, pageContext);
  const page = authoredPage && project
    ? { ...authoredPage, graphic: resolveEventAppearanceGraphic(project, authoredPage.graphic) }
    : authoredPage;
  const location = session.eventLocations?.[event.id];
  const runtimePosition = positions[event.id];
  const position = location ? { x: location.x, y: location.y } : runtimePosition ?? { x: event.x, y: event.y };
  const runtimeDirection = location?.direction ?? runtimePosition?.direction;
  // 페이지가 있는데 조건이 맞는 페이지가 하나도 없으면(RPG 쯔꾸르 규칙대로) 그 이벤트는 맵에 없는 것과 같다 —
  // 보이지도, 막지도 않는다. 예전에는 기본값 same·겹침 금지로 서서, 한 번 돈 자동 컷신(once: 셀프 스위치 A 가 켜져
  // 페이지가 꺼짐)이 도착 칸 옆에 보이지 않는 벽으로 남아 기억 방 메멘토에 못 갔다(2026-09-24 회상 스토리).
  const dormant = !page && (event.pages?.length ?? 0) > 0;
  const transparent = dormant || page?.graphic.transparent === true;
  const footprint = normalizeCharacterFootprint(page?.footprint);
  const passRows = normalizePassRows(page?.passRows, footprint.height);
  return {
    event,
    page,
    pageId: page?.id,
    x: position.x,
    y: position.y,
    trigger: page?.trigger ?? event.trigger,
    priority: dormant ? "below" : page?.priority ?? "same",
    overlapForbidden: dormant ? false : page?.overlapForbidden ?? true,
    footprint,
    passRows,
    bodyRect: footprintBounds(position.x, position.y, footprint),
    passRect: passageBounds(position.x, position.y, footprint, passRows),
    scale: normalizeCharacterScale(page?.graphic.scale),
    transparent,
    animationType: page?.animationType ?? "normal",
    movement: page?.movement ?? legacyMovement(event),
    sprite: transparent ? undefined : page?.graphic.sprite ?? event.sprite,
    direction: runtimeDirection ?? page?.graphic.direction,
    runtimeDirection,
  };
}

/**
 * 이 맵에 있는 런타임 이벤트 뷰를 순서대로 방문한다 — 이 파일의 유일한 순회 원본.
 * visit 이 true 를 내면 즉시 멈춘다(찾기 질의는 배열을 만들지 않는다).
 *
 * 왜: 예전에는 모든 질의가 runtimeEventViewsForMap 으로 **전체 배열**을 만든 뒤 find/some
 * 했다. 그 배열은 다른 모든 맵의 이벤트까지 훑고 Set 3종을 새로 만든다. NPC 마다 프레임당
 * 1~3회 불려 O(N²) 가 됐다(실측 0.04~0.16ms/호출).
 */
function forEachRuntimeEventView(
  project: Pick<Project, "maps"> & Partial<Pick<Project, "database" | "assets">>,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  visit: (view: RuntimeEventView) => boolean | void,
  /**
   * 주면 이 사각과 **절대 겹칠 수 없는** 이벤트는 뷰를 만들지 않고 건너뛴다. 뷰 만들기는 페이지
   * 조건 평가와 객체 몇 개 할당이라, 사각 질의(통행·조사·시야·A* 의 칸마다 호출)를 이벤트 수만큼
   * 곱하던 비용이다. 판정은 앵커 좌표만으로 한다 — 몸 사각은 앵커 기준 가로 [x-3, x+4],
   * 세로 [y-7, y] 안에 있다(축 상한 8, footprintBounds). 통행 사각은 몸 사각의 부분집합이다.
   */
  near?: FootprintRect,
): void {
  const appearanceProject = project.database && project.assets ? { database: project.database, assets: project.assets } : undefined;
  const pageContext: EventPageLocationContext = { locations: map.locations };
  const erased = idSet(session.erasedEventIds);
  const removedOnCurrentMap = removedEventSet(session, map.id);
  const locations = session.eventLocations;
  const included = new Set<string>();
  for (const event of map.events) {
    if (erased?.has(event.id)) continue;
    if (removedOnCurrentMap?.has(event.id)) continue;
    const location = locations?.[event.id];
    if (location && location.mapId !== map.id) continue;
    included.add(event.id);
    if (near && !anchorMayOverlap(location ?? positions[event.id] ?? event, near)) continue;
    if (visit(runtimeEventView(event, session, positions, appearanceProject, pageContext)) === true) return;
  }
  // 다른 맵의 이벤트는 **이 맵으로 옮겨진 것만** 후보다. 옮겨진 이벤트가 없으면
  // 맵 전체 순회를 건너뛴다(대부분의 프레임이 여기에 해당한다). 후보 집합은 다른 맵이
  // 실제로 있을 때만 만든다 — 맵이 하나뿐인 프로젝트에서 헛일이 되지 않게.
  let incoming: ReadonlySet<string> | undefined;
  let incomingResolved = false;
  for (const sourceMap of Object.values(project.maps)) {
    if (sourceMap.id === map.id) continue;
    if (!incomingResolved) {
      incomingResolved = true;
      incoming = incomingEventIds(locations, map.id, included, erased);
    }
    if (!incoming) break;
    const removedOnSourceMap = removedEventSet(session, sourceMap.id);
    for (const event of sourceMap.events) {
      if (!incoming.has(event.id)) continue;
      if (included.has(event.id)) continue;
      if (removedOnSourceMap?.has(event.id)) continue;
      included.add(event.id);
      if (near && !anchorMayOverlap(locations?.[event.id] ?? positions[event.id] ?? event, near)) continue;
      if (visit(runtimeEventView(event, session, positions, appearanceProject, pageContext)) === true) return;
    }
  }
  const spawned = session.spawnedEvents;
  if (!spawned) return;
  for (const spawnedEventId in spawned) {
    const spawn = spawned[spawnedEventId];
    if (!spawn || spawn.mapId !== map.id) continue;
    if (included.has(spawnedEventId)) continue;
    if (near && !anchorMayOverlap(locations?.[spawnedEventId] ?? positions[spawnedEventId] ?? spawn, near)) {
      included.add(spawnedEventId);
      continue;
    }
    const event = materializeSpawnedEvent(project, spawnedEventId, spawn);
    if (!event) continue;
    included.add(spawnedEventId);
    if (visit(runtimeEventView(event, session, positions, appearanceProject, pageContext)) === true) return;
  }
}

/** 몸 사각이 앵커에서 벗어날 수 있는 최대 칸 수(footprintBounds 와 축 상한에서 파생). */
const BODY_REACH_LEFT = Math.floor((CHARACTER_FOOTPRINT_AXIS_MAX - 1) / 2);
const BODY_REACH_RIGHT = CHARACTER_FOOTPRINT_AXIS_MAX - 1 - BODY_REACH_LEFT;
const BODY_REACH_UP = CHARACTER_FOOTPRINT_AXIS_MAX - 1;

/** false 면 이 앵커의 어떤 몸 사각도 rect 와 겹치지 않는다. true 는 "뷰를 만들어 확인하라". */
function anchorMayOverlap(anchor: { readonly x: number; readonly y: number }, rect: FootprintRect): boolean {
  const { x, y } = anchor;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  return x + BODY_REACH_RIGHT >= rect.left
    && x - BODY_REACH_LEFT <= rect.right
    && y >= rect.top
    && y - BODY_REACH_UP <= rect.bottom;
}

export function runtimeEventViewsForMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions
): RuntimeEventView[] {
  const views: RuntimeEventView[] = [];
  forEachRuntimeEventView(project, map, session, positions, (view) => {
    views.push(view);
  });
  return views;
}

/** 이벤트 하나만 필요한 질의. 전체 배열을 만들지 않고 찾는 즉시 멈춘다. */
export function runtimeEventViewById(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  eventId: string
): RuntimeEventView | undefined {
  // forEachRuntimeEventView 와 같은 포함 규칙을 **그 id 하나에만** 적용한다. 예전에는 id 를 비교하기
  // 전에 맵의 모든 이벤트 뷰(페이지 조건 평가 포함)를 만들었다 — NPC 마다 프레임당 1~3회 불려
  // NPC 수의 제곱으로 커졌다. 순서·중복 규칙은 순회 원본과 같다: 현재 맵 → 옮겨 온 이벤트 → 소환.
  const appearanceProject = runtimeAppearanceProject(project);
  const pageContext: EventPageLocationContext = { locations: map.locations };
  const erased = session.erasedEventIds;
  const location = session.eventLocations?.[eventId];
  for (const event of map.events) {
    if (event.id !== eventId) continue;
    if (erased?.includes(eventId)) continue;
    if (session.removedEventIds?.[map.id]?.includes(eventId)) continue;
    if (location && location.mapId !== map.id) continue;
    return runtimeEventView(event, session, positions, appearanceProject, pageContext);
  }
  if (location?.mapId === map.id && !erased?.includes(eventId)) {
    for (const sourceMap of Object.values(project.maps)) {
      if (sourceMap.id === map.id) continue;
      if (session.removedEventIds?.[sourceMap.id]?.includes(eventId)) continue;
      const event = sourceMap.events.find((entry) => entry.id === eventId);
      if (event) return runtimeEventView(event, session, positions, appearanceProject, pageContext);
    }
  }
  const spawn = session.spawnedEvents?.[eventId];
  if (!spawn || spawn.mapId !== map.id) return undefined;
  const event = materializeSpawnedEvent(project, eventId, spawn);
  return event ? runtimeEventView(event, session, positions, appearanceProject, pageContext) : undefined;
}

function runtimeAppearanceProject(
  project: Pick<Project, "maps"> & Partial<Pick<Project, "database" | "assets">>,
): Pick<Project, "database" | "assets"> | undefined {
  return project.database && project.assets ? { database: project.database, assets: project.assets } : undefined;
}

/** 이 맵으로 옮겨졌고 아직 방문되지 않은 이벤트 id. 없으면 undefined. */
function incomingEventIds(
  locations: PlaySessionLike["eventLocations"],
  mapId: string,
  included: ReadonlySet<string>,
  erased: ReadonlySet<string> | undefined
): ReadonlySet<string> | undefined {
  if (!locations) return undefined;
  let ids: Set<string> | undefined;
  for (const eventId in locations) {
    if (locations[eventId]?.mapId !== mapId) continue;
    if (included.has(eventId)) continue;
    if (erased?.has(eventId)) continue;
    ids ??= new Set<string>();
    ids.add(eventId);
  }
  return ids;
}

/**
 * 이 이벤트가 런타임에서 사라졌는가 — erase(전역) 또는 remove(맵별). forEachRuntimeEventView
 * 가 순회에서 빼는 두 조건과 **같은 술어**다. 이벤트 순회를 거치지 않고 project.maps 를
 * 직접 훑는 곳(npcSchedules 등)이 같은 판정을 베끼지 않도록 여기서 한 번만 정의한다.
 */
export function runtimeEventGone(session: PlaySessionLike, mapId: string, eventId: string): boolean {
  if (session.erasedEventIds?.includes(eventId) === true) return true;
  return session.removedEventIds?.[mapId]?.includes(eventId) === true;
}

function idSet(ids: readonly string[] | undefined): ReadonlySet<string> | undefined {
  return ids && ids.length > 0 ? new Set(ids) : undefined;
}

function removedEventSet(session: PlaySessionLike, mapId: string): ReadonlySet<string> | undefined {
  return idSet(session.removedEventIds?.[mapId]);
}

function materializeSpawnedEvent(
  project: Pick<Project, "maps">,
  eventId: string,
  spawn: NonNullable<PlaySessionLike["spawnedEvents"]>[string]
): GameEvent | null {
  const template = findTemplateEvent(project, spawn.templateMapId, spawn.templateEventId);
  if (!template) return null;
  return {
    ...template,
    id: eventId,
    x: spawn.x,
    y: spawn.y,
    pages: template.pages?.map((page) => ({ ...page, commands: [...page.commands] })),
    commands: [...template.commands],
  };
}

function findTemplateEvent(
  project: Pick<Project, "maps">,
  templateMapId: string,
  templateEventId: string
): GameEvent | undefined {
  const preferred = project.maps[templateMapId]?.events.find((event) => event.id === templateEventId);
  if (preferred) return preferred;
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === templateEventId);
    if (event) return event;
  }
  return undefined;
}

function legacyMovement(event: GameEvent): EventPageMovement {
  return event.moveRoute
    ? { ...DEFAULT_PAGE_MOVEMENT, type: "custom", route: event.moveRoute }
    : DEFAULT_PAGE_MOVEMENT;
}

/**
 * 사각과 겹치는 이벤트를 찾는다 — 이 파일의 **조사·접촉** 히트테스트 원본.
 * 점 질의(findRuntimeEventAtInMap 등)는 전부 여기에 1x1 사각으로 위임한다.
 *
 * `bodyRect` 를 쓴다 — 3x3 의 상체를 보고도 말을 걸 수 있어야 한다(2차 스펙 §3).
 * 통행 차단은 `passRect` 를 쓰는 별도 계열이다(findBlocking*).
 */
export function findEventOverlappingRect(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  rect: FootprintRect,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  let found: RuntimeEventView | undefined;
  forEachRuntimeEventView(project, map, session, positions, (event) => {
    if (!rectsOverlap(event.bodyRect, rect)) return false;
    if (!matchesTrigger(event.trigger.kind, triggerKind)) return false;
    found = event;
    return true;
  }, rect);
  return found;
}

/**
 * 이벤트 배열 형태. map 을 안 받아 runtimeEventViewsForMap 을 못 쓰므로
 * 사각 질의 원본에 위임하지 못하고 자기 .find 조건만 bodyRect 로 바꾼다.
 */
export function findRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  const rect = pointRect(x, y);
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => rectsOverlap(event.bodyRect, rect) && matchesTrigger(event.trigger.kind, triggerKind));
}

/**
 * 사각과 겹치면서 통행을 막는 이벤트 — **passRect** 계열의 원본.
 * 3x3 몸에 passRows 1 이면 발밑 한 줄만 여기에 걸리고 상체 두 줄은 지나갈 수 있다.
 *
 * excludeEventId 는 자기 자신(움직이는 NPC)을 뺀다.
 */
export function findBlockingEventOverlappingRect(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  rect: FootprintRect,
  excludeEventId?: string
): RuntimeEventView | undefined {
  let found: RuntimeEventView | undefined;
  forEachRuntimeEventView(project, map, session, positions, (event) => {
    if (!rectsOverlap(event.passRect, rect)) return false;
    if (event.event.id === excludeEventId) return false;
    if (event.priority !== "same" || !event.overlapForbidden) return false;
    found = event;
    return true;
  }, rect);
  return found;
}

/**
 * 한 번의 동기 탐색(A* 한 번) 동안 쓰는 "막는 이벤트" 판정기. findBlockingEventOverlappingRect 와
 * **같은 답**을 내지만, 막는 이벤트의 passRect 를 처음 부를 때 한 번만 모은다.
 *
 * 왜: A* 는 칸마다 막힘을 묻고, 예전 질의는 그때마다 맵의 모든 이벤트를 훑었다(앵커 사전 거르기가
 * 뷰 생성은 줄이지만 순회는 남는다). 도달 불가 추격이 이벤트 300개 맵에서 한 번에 약 250ms 였다.
 * 탐색 도중에는 이벤트가 움직이지 않으므로 모아 둔 목록이 곧 원본 질의의 답이다. **탐색 하나마다
 * 새로 만든다** — 앞 NPC 가 움직인 결과를 다음 NPC 가 봐야 하므로 프레임 단위로 공유하지 않는다.
 */
export function createBlockingEventQuery(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  excludeEventId?: string,
): (rect: FootprintRect) => boolean {
  // 칸 → 그 칸을 덮는 막는 사각들. 모은 목록을 질의마다 전부 훑으면 A* 후보 칸마다 이벤트 수만큼 비교해
  // 도달 불가 추격(이벤트 300개)이 한 번에 약 35ms, 여러 명이면 수백 ms 였다(브라우저 실측 최대 516ms).
  // 질의 사각이 닿는 칸만 본다. 좌표가 소수일 수 있으므로(이벤트 좌표는 정수를 강제하지 않는다) 등록과 질의
  // 모두 floor(left)..floor(right) 의 정수 격자를 쓴다 — 겹치는 두 사각은 반드시 공통 격자 칸을 가진다.
  // 맵 밖 사각도 그대로 담기게 키는 좌표 문자열이 아니라 정수 쌍을 섞는다.
  let grid: Map<number, FootprintRect[]> | undefined;
  const cellKey = (x: number, y: number) => x * 73_856_093 ^ y * 19_349_663;
  return (rect) => {
    if (!grid) {
      const built = new Map<number, FootprintRect[]>();
      forEachRuntimeEventView(project, map, session, positions, (event) => {
        if (event.event.id === excludeEventId) return;
        if (event.priority !== "same" || !event.overlapForbidden) return;
        const blocker = event.passRect;
        for (let y = Math.floor(blocker.top); y <= Math.floor(blocker.bottom); y += 1) {
          for (let x = Math.floor(blocker.left); x <= Math.floor(blocker.right); x += 1) {
            const key = cellKey(x, y);
            const bucket = built.get(key);
            if (bucket) bucket.push(blocker);
            else built.set(key, [blocker]);
          }
        }
      });
      grid = built;
    }
    for (let y = Math.floor(rect.top); y <= Math.floor(rect.bottom); y += 1) {
      for (let x = Math.floor(rect.left); x <= Math.floor(rect.right); x += 1) {
        const bucket = grid.get(cellKey(x, y));
        if (!bucket) continue;
        // 해시 키가 겹칠 수 있으니 실제 겹침으로 확인한다(겹치는 사각은 이 칸을 덮으므로 반드시 여기 있다).
        for (const blocker of bucket) if (rectsOverlap(blocker, rect)) return true;
      }
    }
    return false;
  };
}

export function findRuntimeEventAtInMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  return findEventOverlappingRect(project, map, session, positions, pointRect(x, y), triggerKind);
}

export function findBlockingRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  const rect = pointRect(x, y);
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => rectsOverlap(event.passRect, rect) && event.priority === "same" && event.overlapForbidden);
}

export function findBlockingRuntimeEventAtInMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  return findBlockingEventOverlappingRect(project, map, session, positions, pointRect(x, y));
}

export function eventBlocksPlayerAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): boolean {
  return findBlockingRuntimeEventAt(events, session, positions, x, y) !== undefined;
}

function matchesTrigger(
  actual: Trigger["kind"],
  expected: Trigger["kind"] | readonly Trigger["kind"][]
): boolean {
  if (typeof expected === "string") return actual === expected;
  return expected.includes(actual);
}
