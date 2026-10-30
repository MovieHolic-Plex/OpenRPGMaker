// player/playSceneDoorEntry.ts
// 문으로 「걸어 들어가기」 — 이동 문의 발동·문간 걸음·도착 보호(project/doorEntries.ts 가 입구를 정한다).
//
//  - 발동: 문 앞 칸에 서서 문 쪽으로 이동 입력(키·패드·스틱)을 넣거나, 문을 본 채로 확인을 누르면 그 문의 이동 이벤트를 돌린다.
//    문 앞 칸을 밟는 것만으로는 발동하지 않는다 — 옛 맵의 문 앞 발판 이벤트(onStep)도 밟기 발동을 끈다(fireTouchTriggers).
//  - 문간 걸음: 이동 직전 문이 열리면(playSceneFieldFx.playDoorOpenBeforeTransfer) 주인공이 문 칸으로 한 걸음 들어가는 모습을 그린 뒤 옮긴다.
//    논리 칸은 바꾸지 않는다(그림만) — 곧 다른 맵으로 옮긴다.
//  - 도착: 문 앞 칸에 내리면 문을 등지고 서고, 그 칸을 떠나거나 이동 입력을 한 번 놓을 때까지 그 문으로 다시 들어가지 않는다
//    (나오면서 누르던 키로 곧장 되돌아 들어가는 왕복을 막는다).
import { characterSpriteY, updateCharacterDepth } from "@/player/characterDepth";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { doorEntriesForMap, doorEntryAt, isDoorstepPad, type DoorEntry } from "@/project/doorEntries";
import { PLAYER_COLLISION_TRIGGER_KINDS } from "@/project/eventTouchRules";
import { findRuntimeEventAtInMap } from "@/project/runtimeEventState";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import type { Dir } from "@/project/types";

type DoorScene = Pick<PlaySceneContext, "map" | "session" | "eventPositions" | "tileX" | "tileY" | "facing" | "runEvent" | "running">;

/** 도착 보호: 이 칸에 선 채로는 그 문으로 다시 들어가지 않는다(칸을 떠나거나 이동 입력을 놓으면 풀린다). */
const guards = new WeakMap<object, { readonly mapId: string; readonly x: number; readonly y: number }>();
/** 문간으로 걸어 들어가는 중(그림을 이 모듈이 움직인다 — 멈춤 프레임으로 덮지 않게). */
const walkingIn = new WeakSet<object>();

export function doorEntriesInScene(scene: Pick<PlaySceneContext, "map">): readonly DoorEntry[] {
  return scene.map ? doorEntriesForMap(store.getCurrent(), scene.map) : [];
}

/** 옛 문 앞 발판(밟아도 발동하지 않는 이동 이벤트)인가. */
export function isDoorstepPadInScene(scene: Pick<PlaySceneContext, "map">, eventId: string, x: number, y: number): boolean {
  return !!scene.map && isDoorstepPad(store.getCurrent(), scene.map, eventId, x, y);
}

/** 이 문 입구의 이동 이벤트가 지금 접촉(밟기·부딪힘) 페이지로 살아 있으면 그 id. */
function liveEntryEvent(scene: DoorScene, entry: DoorEntry): string | null {
  const project = store.getCurrent();
  const event = scene.map.events.find((e) => e.id === entry.eventId);
  if (!event) return null;
  const pos = scene.eventPositions?.[entry.eventId] ?? { x: event.x, y: event.y };
  const view = findRuntimeEventAtInMap(project, scene.map, scene.session, scene.eventPositions, pos.x, pos.y, PLAYER_COLLISION_TRIGGER_KINDS);
  return view?.event.id === entry.eventId ? entry.eventId : null;
}

/**
 * 문 앞 칸에서 dir 쪽(문)으로 들어간다. 들어갔으면 true(이번 입력은 쓴 것). viaAction = 확인 버튼(도착 보호를 보지 않는다).
 * 문 이벤트가 지금 접촉 페이지가 아니면(잠긴 문 대사 등 다른 페이지) false — 평소 처리(부딪힘·조사)로 넘긴다.
 */
export function tryEnterDoor(scene: DoorScene, dir: Dir | undefined, options: { readonly viaAction?: boolean } = {}): boolean {
  if (!dir || !scene.map || scene.running) return false;
  const entry = doorEntryAt(store.getCurrent(), scene.map, scene.tileX, scene.tileY, dir);
  if (!entry) return false;
  if (!options.viaAction) {
    const guard = guards.get(scene);
    if (guard && guard.mapId === scene.map.id && guard.x === scene.tileX && guard.y === scene.tileY) return false;
  }
  const eventId = liveEntryEvent(scene, entry);
  if (!eventId) return false;
  scene.facing = dir;
  void scene.runEvent(eventId);
  return true;
}

/** 매 틱(멈춰 있을 때): 도착 보호를 푼다 — 칸을 떠났거나 이동 입력을 놓았다. */
export function updateDoorEntryGuard(scene: Pick<PlaySceneContext, "map" | "tileX" | "tileY">, inputIdle: boolean): void {
  const guard = guards.get(scene);
  if (!guard) return;
  if (inputIdle || guard.mapId !== scene.map?.id || guard.x !== scene.tileX || guard.y !== scene.tileY) guards.delete(scene);
}

/** 옮겨 온 직후: 문 앞 칸에 내렸으면 도착 보호를 건다. */
export function noteDoorArrival(scene: Pick<PlaySceneContext, "map" | "tileX" | "tileY">): void {
  if (!scene.map) return;
  const entry = doorEntryAt(store.getCurrent(), scene.map, scene.tileX, scene.tileY);
  if (entry) guards.set(scene, { mapId: scene.map.id, x: scene.tileX, y: scene.tileY });
  else guards.delete(scene);
}

export function doorWalkInActive(scene: object): boolean {
  return walkingIn.has(scene);
}

const WALK_IN_FRAME_MS = 90;
const DIR_DELTA: Record<string, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/**
 * 이동 직전: 주인공이 eventId 문의 문 앞 칸에서 문을 보고 서 있으면 문 칸으로 한 걸음 걸어 들어가는 그림을 그린다(논리 칸은 그대로).
 * 문이 열린 뒤 부른다. 걸었으면 true.
 */
export function walkIntoDoorway(scene: PlaySceneContext, eventId: string | undefined): Promise<boolean> {
  if (!eventId || !scene.map || !scene.player || scene.moving) return Promise.resolve(false);
  // 이동을 돌린 이벤트가 입구 이벤트이거나, 입구 발판이 부른 문 본체(문 칸에 선 이벤트)면 그 입구다.
  const body = scene.map.events.find((e) => e.id === eventId);
  const entry = doorEntriesInScene(scene).find((e) => e.step.x === scene.tileX && e.step.y === scene.tileY
    && (e.eventId === eventId || (body && body.x === e.door.x && body.y === e.door.y)));
  if (!entry || scene.facing !== entry.dir) return Promise.resolve(false);
  const size = mapTileSize(scene.map);
  const d = DIR_DELTA[entry.dir]!;
  const player = scene.player;
  const fromX = player.x, fromY = player.y;
  const toX = fromX + d.x * size;
  const toY = characterSpriteY(scene.tileY + d.y, size) + (fromY - characterSpriteY(scene.tileY, size));
  const duration = Math.max(180, Math.min(320, scene.moveDurationMs || 240));
  walkingIn.add(scene);
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; walkingIn.delete(scene); resolve(true); };
    const started = scene.time?.now ?? 0;
    const tick = () => {
      if (done) return;
      const now = scene.time?.now ?? started + duration;
      const k = Math.min(1, Math.max(0, (now - started) / duration));
      player.x = fromX + (toX - fromX) * k;
      player.y = fromY + (toY - fromY) * k;
      updateCharacterDepth(player, "same");
      const frame = Math.floor((now - started) / WALK_IN_FRAME_MS) % Math.max(1, scene.playerSprite.walkFrameCount);
      player.setFrame(scene.playerSprite.walkFrameFor(entry.dir, frame));
      if (k >= 1) { player.setFrame(scene.playerSprite.idleFrameFor(entry.dir)); finish(); }
    };
    const timer = scene.time?.addEvent?.({ delay: 16, loop: true, callback: () => { tick(); if (done) timer?.remove(false); } });
    if (!timer) { finish(); return; }
    // 장면이 멈추거나 맵이 바뀌어도 이동은 이어져야 한다 — 길이의 두 배가 지나면 끝낸 것으로 친다.
    setTimeout(() => { timer.remove(false); finish(); }, duration * 2 + 200);
  });
}
