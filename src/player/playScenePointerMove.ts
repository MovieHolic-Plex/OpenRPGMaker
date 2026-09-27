// 명작 공백 #32(2026-09-27) — 클릭(탭)으로 걷기(To the Moon 식 포인트 앤 클릭 이동).
//
// system.pointerMovement 가 켜진 게임에서 맵 타일을 누르면 기존 경로 탐색(planPathfindMove)으로
// 주인공이 그 칸까지 걷는다. 이벤트를 누르면 그 옆까지 걸어가 조사한다. 이벤트 실행 중·메뉴·컷신에는 무시한다.
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { planPathfindMove } from "@/player/playScenePathfinding";
import { startPlayerRoute } from "@/player/playerRouteState";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import type { PlaySceneContext } from "@/player/playSceneTypes";

/** 화면 좌표 → 타일. 맵 밖이면 undefined. */
export function pointerTile(scene: PlaySceneContext, worldX: number, worldY: number): { x: number; y: number } | undefined {
  const size = mapTileSize(scene.map);
  const x = Math.floor(worldX / size);
  const y = Math.floor(worldY / size);
  if (x < 0 || y < 0 || x >= scene.map.width || y >= scene.map.height) return undefined;
  return { x, y };
}

export function pointerMovementEnabled(): boolean {
  return store.getCurrent().system.pointerMovement === true;
}

export type PointerMoveOutcome = "disabled" | "busy-running" | "busy-moving" | "busy-locked" | "here" | "noPath" | "walking";

/** 클릭 한 번을 처리한다. 결과는 호출측이 QA 영수증(data-pointer-move)으로 남긴다. */
export function handlePointerMove(scene: PlaySceneContext, tile: { x: number; y: number }): PointerMoveOutcome {
  if (!pointerMovementEnabled()) return "disabled";
  if (scene.running) return "busy-running";
  if (scene.moving) return "busy-moving";
  if (isCutsceneInputLocked(scene.session)) return "busy-locked";
  if (tile.x === scene.tileX && tile.y === scene.tileY) return "here";
  const plan = planPathfindMove(scene, { kind: "pathfindMove", target: "player", x: tile.x, y: tile.y, speed: 4, wait: false }, undefined);
  if (!plan || plan.moves.length === 0) return "noPath";
  startPlayerRoute(scene, plan.moves, false);
  return "walking";
}

type CameraLike = { readonly scrollX: number; readonly scrollY: number; readonly zoom: number; readonly width: number; readonly height: number };
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
    x: camera.scrollX + localX / (rect.width / camera.width) / camera.zoom,
    y: camera.scrollY + localY / (rect.height / camera.height) / camera.zoom,
  };
}

// 메뉴·대사·선택지·터치 컨트롤·단추 위의 누름은 그 UI 의 것이다 — 걷기로 가로채지 않는다.
// 터치패드 컨테이너(.touch-pad)는 무대 전체를 덮는 inset:0 통과막이라 고르면 안 된다 — 실제 컨트롤만 본다.
const UI_TARGET_SELECTOR = "button, input, textarea, select, a, .dialogue-box, .choice-list, .touch-dpad, .touch-actions, [data-testid='main-menu'], [data-testid='battle-scene']";

/**
 * PlayScene.create 에서 한 번. 출하 플레이어는 Phaser 마우스·터치 입력을 끄고(createPlayGame keyboardOnly)
 * 캔버스를 pointer-events:none 으로 두므로, 문서의 pointerdown 을 캔버스 상자로 걸러 받는다.
 */
export function installPointerMove(scene: PlaySceneContext & PointerInputHost): void {
  if (typeof window === "undefined") return;
  const onPointerDown = (event: PointerEvent): void => {
    const host = scene.game?.registry?.get?.("dialogueHost");
    const receipt = (value: string): void => {
      if (host instanceof HTMLElement) host.dataset.pointerMove = value;
    };
    if (event.button !== 0) return;
    if (!pointerMovementEnabled()) return receipt("disabled");
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(UI_TARGET_SELECTOR)) return receipt("ui");
    const canvas = scene.game?.canvas;
    const camera = scene.cameras?.main;
    if (!canvas || !camera) return receipt("noCanvas");
    const world = clientToWorld(canvas.getBoundingClientRect(), camera, event.clientX, event.clientY);
    if (!world) return receipt("outside");
    const tile = pointerTile(scene, world.x, world.y);
    receipt(tile ? `${handlePointerMove(scene, tile)}:${tile.x},${tile.y}` : "outside");
  };
  // 플레이 화면은 playInputBlocker 가 누름을 캡처 단계에서 삼킨다(root 리스너). window 캡처는 그보다 먼저 본다 —
  // 여기서는 읽기만 하고 전파를 막지 않으므로 차단기의 포커스·기본동작 규칙은 그대로다.
  window.addEventListener("pointerdown", onPointerDown, true);
  const remove = (): void => window.removeEventListener("pointerdown", onPointerDown, true);
  scene.events?.once?.("shutdown", remove);
  scene.events?.once?.("destroy", remove);
}
