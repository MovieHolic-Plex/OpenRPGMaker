// 명작 공백 #32(2026-09-27) — 클릭(탭)으로 걷기(To the Moon 식 포인트 앤 클릭 이동).
//
// system.pointerMovement 가 켜진 게임에서 맵 타일을 누르면 기존 경로 탐색(planPathfindMove)으로
// 주인공이 그 칸까지 걷는다. 이벤트를 누르면 그 옆까지 걸어가 조사한다. 이벤트 실행 중·메뉴·컷신에는 무시한다.
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { hasRelief } from "@/project/relief/walk";
import { reliefPickPoint } from "@/project/relief/screen";
import { planPathfindMove } from "@/player/playScenePathfinding";
import { startPlayerRoute } from "@/player/playerRouteState";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { currentTouchControls } from "@/player/touchControlSettings";
import { isTouchUiHost } from "@/player/touchTap";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { MoveCommand } from "@/project/types";
import { playerAlwaysRun } from "@/player/playerPreferences";

/**
 * 탭(클릭)으로 걷는 길이 이 칸 수보다 길면 달린다(2026-10-25). 짧은 길은 걸어서 정확히 멈추고, 먼 길은 빨리 간다.
 * RPG 쯔꾸르 MZ 는 목적지 이동이면 늘 달리고(Game_Player.updateDashing), FF 픽셀 리마스터 모바일도 탭 이동은 달리기 속도다.
 * 「항상 달리기」 옵션이 켜져 있으면 짧은 길도 달린다.
 */
export const TAP_RUN_MIN_STEPS = 5;

function startPointerRoute(scene: PlaySceneContext, moves: MoveCommand[]): void {
  startPlayerRoute(scene, moves, false);
  if (!scene.playerRoute) return;
  scene.playerRoute.pointer = true;
  scene.playerRoute.yieldsToEvents = true;
  const steps = moves.filter((move) => move.kind === "move" || move.kind === "stepForward").length;
  scene.playerRoute.dash = playerAlwaysRun() || steps >= TAP_RUN_MIN_STEPS;
}

/** 화면 좌표 → 타일. 맵 밖이면 undefined. */
export function pointerTile(scene: PlaySceneContext, worldX: number, worldY: number): { x: number; y: number } | undefined {
  const size = mapTileSize(scene.map);
  if (hasRelief(scene.map.relief)) {
    const hit = reliefPickPoint(scene.map.relief, worldX, worldY, size);
    return hit?.face === "top" ? { x: hit.x, y: hit.y } : undefined;
  }
  const x = Math.floor(worldX / size);
  const y = Math.floor(worldY / size);
  if (x < 0 || y < 0 || x >= scene.map.width || y >= scene.map.height) return undefined;
  return { x, y };
}

export function pointerMovementEnabled(touch = false): boolean {
  if (store.getCurrent().system.pointerMovement === true) return true;
  // 터치 UI(휴대폰·태블릿)는 맵 탭 걷기가 기본으로 켜져 있다(system.touchControls.tapToMove · 플레이어 옵션, 2026-10-24).
  return touch && currentTouchControls().tapToMove;
}

export type PointerMoveOutcome = "disabled" | "busy-running" | "busy-moving" | "busy-locked" | "here" | "act" | "noPath" | "walking" | "approach";

/** 탭으로 시작한 걸음이 끝나면 정면을 조사한다(사람·물건을 탭했을 때). 패드를 만지면 취소. */
const pendingTapActions = new WeakSet<object>();

/** 매 프레임: 탭 걸음이 끝났으면 확인(조사) 엣지를 한 번 넣는다. */
export function consumePendingTapAction(scene: Pick<PlaySceneContext, "playerRoute" | "moving" | "input_">): void {
  if (!pendingTapActions.has(scene)) return;
  if (scene.playerRoute?.pointer === true || scene.moving) return;
  pendingTapActions.delete(scene);
  if (!scene.playerRoute) scene.input_.injectActionEdge();
}

/** 패드·키로 방향을 넣으면 탭 걸음을 그만둔다(손으로 잡은 조작이 이긴다). 걷던 한 칸은 마저 걷는다. */
export function cancelPointerRoute(scene: Pick<PlaySceneContext, "playerRoute">): void {
  if (scene.playerRoute?.pointer === true) scene.playerRoute = null;
  pendingTapActions.delete(scene);
}

function faceToward(from: { x: number; y: number }, to: { x: number; y: number }): "up" | "down" | "left" | "right" {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** 클릭 한 번을 처리한다. 결과는 호출측이 QA 영수증(data-pointer-move)으로 남긴다. */
export function handlePointerMove(scene: PlaySceneContext, tile: { x: number; y: number }, options: { readonly touch?: boolean } = {}): PointerMoveOutcome {
  const touch = options.touch === true;
  if (!pointerMovementEnabled(touch)) return "disabled";
  if (scene.running) return "busy-running";
  if (isCutsceneInputLocked(scene.session)) return "busy-locked";
  // 걷는 중의 탭은 목적지를 바꾼다(지금 칸을 마저 걷고 새 길로) — 단 이벤트가 건 강제 경로는 건드리지 않는다.
  if (scene.moving && (!touch || (scene.playerRoute && scene.playerRoute.pointer !== true))) return "busy-moving";
  const from = scene.moving ? { ...scene.movingTo } : { x: scene.tileX, y: scene.tileY };
  pendingTapActions.delete(scene);
  if (tile.x === from.x && tile.y === from.y) {
    if (!touch) return "here";
    // 자기 자신을 탭 = 정면 조사(A 와 같다).
    if (!scene.moving) scene.input_.injectActionEdge();
    return "act";
  }
  const project = store.getCurrent();
  const views = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions);
  const within = (view: (typeof views)[number], x: number, y: number): boolean =>
    x >= view.bodyRect.left && x <= view.bodyRect.right && y >= view.bodyRect.top && y <= view.bodyRect.bottom;
  const hasFigure = (view: (typeof views)[number]): boolean => Boolean(view.page?.graphic?.sprite || view.page?.graphic?.appearanceId) && !view.transparent;
  // 사람 그림은 한 칸보다 키가 커서(24×32) 머리가 윗칸에 걸친다 — 머리를 탭해도 그 사람이다.
  const tappedEvent = views.find((view) => view.page && within(view, tile.x, tile.y))
    ?? views.find((view) => view.page && hasFigure(view) && within(view, tile.x, tile.y + 1));
  const plan = (x: number, y: number): MoveCommand[] | null => {
    if (x === from.x && y === from.y) return [];
    const result = planPathfindMove(scene, { kind: "pathfindMove", target: "player", x, y, speed: 4, wait: false }, undefined);
    return result && result.moves.length > 0 ? [...result.moves] : null;
  };
  if (!tappedEvent || !touch) {
    const moves = plan(tile.x, tile.y);
    if (moves && moves.length > 0) {
      startPointerRoute(scene, moves);
      return "walking";
    }
    if (!touch) return "noPath";
  }
  // 사람·물건·막힌 칸: 곁 네 칸 중 가장 가까운 곳까지 걷고 그쪽을 보고, 사람·물건이면 말을 건다.
  let best: MoveCommand[] | null = null;
  let bestNeighbor: { x: number; y: number } | null = null;
  for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]] as const) {
    const neighbor = { x: tile.x + dx, y: tile.y + dy };
    const moves = plan(neighbor.x, neighbor.y);
    if (moves && (!best || moves.length < best.length)) { best = moves; bestNeighbor = neighbor; }
  }
  if (!best || !bestNeighbor) return "noPath";
  const turn: MoveCommand = { kind: "turn", dir: faceToward(bestNeighbor, tile) };
  startPointerRoute(scene, [...best, turn]);
  if (tappedEvent) pendingTapActions.add(scene);
  return "approach";
}

type CameraLike = { readonly scrollX: number; readonly scrollY: number; readonly zoom: number; readonly width: number; readonly height: number; readonly worldView?: { readonly x: number; readonly y: number } };
type PointerInputHost = {
  cameras?: { main?: CameraLike };
  game?: { canvas?: HTMLCanvasElement; registry?: { get?: (key: string) => unknown } };
  events?: { once?: (event: string, fn: () => void) => void };
};

/** 화면(client) 좌표 → 월드 좌표. 캔버스 CSS 상자와 카메라 스크롤·줌으로 되돌린다(QA clickTile 의 역변환). */
export function clientToWorld(
  rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  camera: CameraLike,
  clientX: number,
  clientY: number,
): { x: number; y: number } | undefined {
  if (rect.width <= 0 || rect.height <= 0 || camera.width <= 0 || camera.height <= 0 || camera.zoom <= 0) return undefined;
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return undefined;
  return {
    x: (camera.worldView?.x ?? camera.scrollX) + localX / (rect.width / camera.width) / camera.zoom,
    y: (camera.worldView?.y ?? camera.scrollY) + localY / (rect.height / camera.height) / camera.zoom,
  };
}

// 메뉴·대사·선택지·터치 컨트롤·단추 위의 누름은 그 UI 의 것이다 — 걷기로 가로채지 않는다.
// 터치패드 컨테이너(.touch-pad)는 무대 전체를 덮는 inset:0 통과막이라 고르면 안 된다 — 실제 컨트롤만 본다.
const UI_TARGET_SELECTOR = "button, input, textarea, select, a, .dialogue-box, .choice-list, .touch-dpad, .touch-stick-zone, .touch-actions, [data-testid='main-menu'], [data-testid='battle-scene'], .runtime-shop-overlay";

/** 터치의 「탭」: 짧고(400ms) 거의 안 움직인 누름만 걷기로 친다 — 끌기·길게 누르기는 아니다. */
const TOUCH_TAP_MAX_MS = 400;
const TOUCH_TAP_MAX_MOVE = 14;

/**
 * PlayScene.create 에서 한 번. 출하 플레이어는 Phaser 마우스·터치 입력을 끄고(createPlayGame keyboardOnly)
 * 캔버스를 pointer-events:none 으로 두므로, 문서의 pointerdown 을 캔버스 상자로 걸러 받는다.
 */
export function installPointerMove(scene: PlaySceneContext & PointerInputHost): void {
  if (typeof window === "undefined") return;
  const receiptHost = (): HTMLElement | null => {
    const host = scene.game?.registry?.get?.("dialogueHost");
    return host instanceof HTMLElement ? host : null;
  };
  const receipt = (value: string): void => {
    const host = receiptHost();
    if (host) host.dataset.pointerMove = value;
  };
  const resolve = (event: PointerEvent, touch: boolean): void => {
    if (!pointerMovementEnabled(touch)) return receipt("disabled");
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(UI_TARGET_SELECTOR)) return receipt("ui");
    // 대사·선택지가 떠 있으면 탭은 대사 넘기기다(touchTap) — 걷지 않는다.
    if (touch && document.querySelector(".dialogue-overlay:not(:empty) .dialogue-box, .choices-active")) return receipt("ui");
    const canvas = scene.game?.canvas;
    const camera = scene.cameras?.main;
    if (!canvas || !camera) return receipt("noCanvas");
    const world = clientToWorld(canvas.getBoundingClientRect(), camera, event.clientX, event.clientY);
    if (!world) return receipt("outside");
    const tile = pointerTile(scene, world.x, world.y);
    if (tile && touch) showTapRipple(canvas, event.clientX, event.clientY);
    receipt(tile ? `${handlePointerMove(scene, tile, { touch })}:${tile.x},${tile.y}` : "outside");
  };
  let touchDown: { id: number; x: number; y: number; at: number } | null = null;
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      // 터치 UI 화면에서만, 그리고 뗄 때 판정한다(엄지로 끌던 손가락이 지나가며 걷기를 시작하지 않게).
      touchDown = isTouchUiHost(scene.game?.canvas) ? { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() } : null;
      return;
    }
    resolve(event, false);
  };
  const onPointerUp = (event: PointerEvent): void => {
    const start = touchDown;
    if (!start || start.id !== event.pointerId) return;
    touchDown = null;
    if (performance.now() - start.at > TOUCH_TAP_MAX_MS) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOUCH_TAP_MAX_MOVE) return;
    resolve(event, true);
  };
  const onPointerCancel = (): void => { touchDown = null; };
  // 플레이 화면은 playInputBlocker 가 누름을 캡처 단계에서 삼킨다(root 리스너). window 캡처는 그보다 먼저 본다 —
  // 여기서는 읽기만 하고 전파를 막지 않으므로 차단기의 포커스·기본동작 규칙은 그대로다.
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerCancel, true);
  const remove = (): void => {
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerCancel, true);
  };
  scene.events?.once?.("shutdown", remove);
  scene.events?.once?.("destroy", remove);
}

/** 탭한 자리에 짧은 고리 — 손가락이 어디를 눌렀는지, 걷기가 접수됐는지 보인다. */
function showTapRipple(canvas: HTMLCanvasElement, clientX: number, clientY: number): void {
  const host = canvas.closest(".play-viewport") ?? canvas.parentElement;
  if (!(host instanceof HTMLElement)) return;
  const box = host.getBoundingClientRect();
  const ring = document.createElement("div");
  ring.className = "touch-tap-ripple";
  ring.dataset.testid = "touch-tap-ripple";
  ring.style.left = `${clientX - box.left}px`;
  ring.style.top = `${clientY - box.top}px`;
  host.append(ring);
  window.setTimeout(() => ring.remove(), 450);
}
