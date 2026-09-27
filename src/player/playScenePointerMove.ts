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

/** 클릭 한 번을 처리한다. 걷기를 시작했으면 true. */
export function handlePointerMove(scene: PlaySceneContext, tile: { x: number; y: number }): boolean {
  if (!pointerMovementEnabled()) return false;
  if (scene.running || scene.moving || isCutsceneInputLocked(scene.session)) return false;
  if (tile.x === scene.tileX && tile.y === scene.tileY) return false;
  const plan = planPathfindMove(scene, { kind: "pathfindMove", target: "player", x: tile.x, y: tile.y, speed: 4, wait: false }, undefined);
  if (!plan || plan.moves.length === 0) return false;
  startPlayerRoute(scene, plan.moves, false);
  return true;
}

/** PlayScene.create 에서 한 번. Phaser 포인터를 월드 좌표로 바꿔 넘긴다. */
type PointerLike = { readonly worldX: number; readonly worldY: number };
type PointerInputHost = { input?: { on?: (event: string, fn: (pointer: PointerLike) => void) => void } };

export function installPointerMove(scene: PlaySceneContext & PointerInputHost): void {
  scene.input?.on?.("pointerdown", (pointer: PointerLike) => {
    const tile = pointerTile(scene, pointer.worldX, pointer.worldY);
    if (tile) handlePointerMove(scene, tile);
  });
}
