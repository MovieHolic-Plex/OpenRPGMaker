// player/playSceneDoorway.ts
// 이동 경로의 «문으로 나가기(exitVia)»·«문으로 들어오기(enterVia)» — 경로가 그 단계에 닿은 순간 보통 걸음과 문 단계로 펼친다.
//
// 왜(2026-10-22 사용자): 짐꾼이 문 «한 칸 앞»에서 사라졌다. 장면이 걸음을 손으로 세어 문 앞에서 멈추고 지웠기 때문이다
// (문 이벤트는 대개 막힌 벽 칸이라 그 위로는 걸을 수 없었다). 나가기는 문 칸 «위로» 한 걸음까지 걷고(마지막 걸음만 통과),
// 문 여는 소리·여는 프레임 → 사라짐 → 닫는 소리. 들어오기는 거꾸로. 소리·프레임·순간 이동은 아래 doorCue·placeAt 단계다.
//
// 걸음은 approach 와 같은 계획 함수(planApproach, 거리 0)와 같은 보통 move 다 — 속도는 인물 자신의 속도(characterMotion).
import { canMove, inBounds } from "@/project/collision";
import { passageBounds, UNIT_FOOTPRINT } from "@/project/footprint";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import {
  findBlockingEventOverlappingRect, moveRuntimeEventPosition, runtimeEventViewById, runtimeEventViewsForMap, type RuntimeEventView,
} from "@/project/runtimeEventState";
import { store } from "@/project/store";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { chebyshev, DIR_DELTA, planApproach, type StageCell } from "@/project/staging/approach";
import { characterSpriteY, footprintSpriteX, updateCharacterDepth } from "@/player/characterDepth";
import { mapTileSize } from "@/project/tileGeometry";
import { setNpcIdleFrame } from "@/player/playSceneAutonomousSprites";
import type { AutonomousNpcSceneContext, AutonomousNpcSprite } from "@/player/playSceneAutonomousTypes";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { Command, Dir, MoveCommand } from "@/project/types";

/** 기본 문 소리(번들 CC0 SE). */
export const DOOR_OPEN_SE = "cc0-se-osx-door-open";
export const DOOR_CLOSE_SE = "cc0-se-osx-door-close-01";
/** 문 이벤트 그림의 방향 줄 = 닫힘 → 열림(RPG Maker 문 캐릭터 시트 관례). */
const DOOR_FRAME_DIRS: readonly Dir[] = ["down", "left", "right", "up"];
const DOOR_FRAME_MS = 90;
const STEP_IN_ORDER: readonly Dir[] = ["down", "left", "right", "up"];

type DoorScene = Pick<AutonomousNpcSceneContext, "map" | "session" | "eventPositions" | "tileX" | "tileY" | "eventSprites"> &
  Partial<Pick<AutonomousNpcSceneContext, "moving" | "movingTo">>;
type DoorRef = { readonly target?: string; readonly x?: number; readonly y?: number };
type Doorway = { readonly cell: StageCell; readonly doorEventId: string | null; readonly framed: boolean; readonly isDoor: boolean };

function hasTransfer(commands: readonly Command[] | undefined): boolean {
  return JSON.stringify(commands ?? []).includes('"kind":"transfer"');
}

function shownGraphic(view: RuntimeEventView): boolean {
  return !view.transparent && Boolean(view.sprite || view.page?.graphic.appearanceId);
}

/** 문 칸: 문 이벤트 id → 그 칸, x,y → 그 칸, 둘 다 없으면 from 에서 가장 가까운 이동(transfer) 이벤트. */
function resolveDoorway(scene: DoorScene, ref: DoorRef, from: StageCell, selfId: string): Doorway | null {
  const project = store.getCurrent();
  const id = ref.target?.trim() ?? "";
  const frameDoor = (view: RuntimeEventView): Doorway => ({
    cell: { x: view.x, y: view.y }, doorEventId: view.event.id, isDoor: true, framed: shownGraphic(view),
  });
  if (id) {
    const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, id);
    return view ? frameDoor(view) : null;
  }
  if (Number.isFinite(ref.x) && Number.isFinite(ref.y)) {
    const cell = { x: Math.round(ref.x!), y: Math.round(ref.y!) };
    const onEvent = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
      .find((v) => v.x === cell.x && v.y === cell.y && v.event.id !== selfId && hasTransfer(v.page?.commands));
    if (onEvent) return frameDoor(onEvent);
    return { cell, doorEventId: null, framed: false, isDoor: isDoorArtCell(project, scene.map, cell.x, cell.y) };
  }
  const gates = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
    .filter((v) => v.event.id !== selfId && hasTransfer(v.page?.commands));
  if (gates.length === 0) return null;
  const nearest = gates.reduce((best, v) => (chebyshev(v, from) < chebyshev(best, from) ? v : best));
  return frameDoor(nearest);
}

function standableFor(scene: DoorScene, actorId: string) {
  const project = store.getCurrent();
  const map = scene.map;
  const player = scene.moving && scene.movingTo ? scene.movingTo : { x: scene.tileX, y: scene.tileY };
  return (c: StageCell): boolean => {
    if (!inBounds(map, c.x, c.y)) return false;
    const rect = passageBounds(c.x, c.y, UNIT_FOOTPRINT, 1);
    if (isSpatialPlacementBlocking(project, scene.session, map.id, rect)) return false;
    if (findBlockingEventOverlappingRect(project, map, scene.session, scene.eventPositions, rect, actorId)) return false;
    return !(c.x === player.x && c.y === player.y);
  };
}

function doorFrames(door: Doorway, opening: boolean, se: string): MoveCommand[] {
  const target = door.doorEventId ?? undefined;
  if (!door.framed || !target) return [{ kind: "doorCue", se, ms: se ? 160 : 0 }];
  const frames = opening ? [1, 2, 3] : [2, 1, 0];
  return frames.map((frame, i): MoveCommand => ({ kind: "doorCue", target, frame, ms: DOOR_FRAME_MS, ...(i === 0 && se ? { se } : {}) }));
}

function soundFor(door: Doorway, explicit: string | undefined, fallback: string): string {
  if (explicit !== undefined) return explicit.trim();
  return door.isDoor ? fallback : "";
}

/** exitVia 펼치기: 문 칸 앞까지 걸음 → 여는 소리·프레임 → 통과 켜고 문 칸으로 한 걸음 → 사라짐 → 닫는 소리·프레임. */
export function expandExitVia(scene: DoorScene, actorId: string, from: StageCell, command: Extract<MoveCommand, { kind: "exitVia" }>): MoveCommand[] {
  const door = resolveDoorway(scene, command, from, actorId);
  if (!door) {
    console.warn(`[player] exitVia — ${actorId}: 문(${command.target ?? (command.x !== undefined ? `${command.x},${command.y}` : "가장 가까운 이동 이벤트")})을 찾지 못했다. 제자리에서 사라진다`);
    return [{ kind: "changeOpacity", delta: -255 }, { kind: "setThrough", enabled: true }];
  }
  const project = store.getCurrent();
  const map = scene.map;
  const standable = standableFor(scene, actorId);
  const isDoorCell = (c: StageCell) => c.x === door.cell.x && c.y === door.cell.y;
  const plan = from.x === door.cell.x && from.y === door.cell.y ? { steps: [] as Dir[], goal: from } : planApproach({
    width: map.width,
    height: map.height,
    // 문 칸으로 들어서는 마지막 걸음은 통과로 걷는다(문 이벤트는 대개 막힌 벽 칸).
    canStep: (a, b) => isDoorCell(b) || canMove(project, map, a.x, a.y, b.x, b.y),
    canStand: (c) => isDoorCell(c) || standable(c),
  }, from, door.cell, 0);
  const steps = plan?.steps ?? [];
  if (!plan || !isDoorCell(plan.goal)) {
    console.warn(`[player] exitVia — ${actorId}: 문 (${door.cell.x},${door.cell.y}) 까지 길이 없다. 가장 가까운 칸에서 사라진다`);
  }
  const reached = Boolean(plan && isDoorCell(plan.goal));
  const walk = steps.map((dir): MoveCommand => ({ kind: "move", dir }));
  const last = reached && walk.length > 0 ? walk.pop()! : null;
  const openSe = soundFor(door, command.se, DOOR_OPEN_SE);
  const closeSe = soundFor(door, command.closeSe, DOOR_CLOSE_SE);
  return [
    ...walk,
    ...(reached ? doorFrames(door, true, openSe) : []),
    { kind: "setThrough", enabled: true },
    ...(last ? [last] : []),
    // 사라진 인물은 투명·통과로 남는다 — 문 칸을 막지 않는다. 이어서 지우기(Erase)나 «떠남» 스위치.
    { kind: "changeOpacity", delta: -255 },
    ...(reached ? doorFrames(door, false, closeSe) : []),
  ];
}

/** enterVia 펼치기: 안 보이게 문 칸으로 → 여는 소리·프레임 → 나타남 → 한 걸음 들어섬 → 통과 끔 → 닫는 소리·프레임. */
export function expandEnterVia(scene: DoorScene, actorId: string, from: StageCell, command: Extract<MoveCommand, { kind: "enterVia" }>): MoveCommand[] {
  const door = resolveDoorway(scene, command, from, actorId);
  if (!door) {
    console.warn(`[player] enterVia — ${actorId}: 문을 찾지 못했다. 그 자리에서 나타난다`);
    return [{ kind: "changeOpacity", delta: 255 }];
  }
  const standable = standableFor(scene, actorId);
  const dir = command.dir ?? STEP_IN_ORDER.find((d) => standable({ x: door.cell.x + DIR_DELTA[d].x, y: door.cell.y + DIR_DELTA[d].y })) ?? "down";
  const openSe = soundFor(door, command.se, DOOR_OPEN_SE);
  const closeSe = soundFor(door, command.closeSe, DOOR_CLOSE_SE);
  return [
    { kind: "changeOpacity", delta: -255 },
    { kind: "setThrough", enabled: true },
    { kind: "placeAt", x: door.cell.x, y: door.cell.y },
    { kind: "turn", dir },
    ...doorFrames(door, true, openSe),
    { kind: "changeOpacity", delta: 255 },
    { kind: "move", dir },
    { kind: "setThrough", enabled: false },
    ...doorFrames(door, false, closeSe),
  ];
}

/** doorCue: 문 소리 + 문 이벤트 그림을 열림 단계 프레임으로. 쉬는 시간(ms)은 호출부가 경로 대기로 건다. */
export function applyDoorCue(scene: DoorScene, command: Extract<MoveCommand, { kind: "doorCue" }>, playSe: (resourceId: string) => void): void {
  if (command.se) playSe(command.se);
  const id = command.target?.trim();
  if (!id || command.frame === undefined) return;
  const project = store.getCurrent();
  const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, id);
  if (!view || !shownGraphic(view)) return;
  const dir = DOOR_FRAME_DIRS[Math.max(0, Math.min(3, Math.round(command.frame)))]!;
  moveRuntimeEventPosition(scene.eventPositions, id, view.x, view.y, dir);
  setNpcIdleFrame(scene.eventSprites.get(id), view.page?.graphic.pattern ?? 0, dir, view.animationType, true);
}

/** placeAt: 같은 맵 안 순간 이동(enterVia 의 등장 칸). */
export function applyPlaceAt(scene: DoorScene, actorId: string, mover: AutonomousMover, sprite: AutonomousNpcSprite | undefined, view: RuntimeEventView, command: Extract<MoveCommand, { kind: "placeAt" }>): void {
  const x = Math.round(command.x), y = Math.round(command.y);
  if (!inBounds(scene.map, x, y)) return;
  moveRuntimeEventPosition(scene.eventPositions, actorId, x, y, mover.facing);
  if (sprite) {
    sprite.setPosition(footprintSpriteX(x, view.footprint, mapTileSize(scene.map)), characterSpriteY(y, mapTileSize(scene.map)));
    updateCharacterDepth(sprite, view.priority);
  }
}
