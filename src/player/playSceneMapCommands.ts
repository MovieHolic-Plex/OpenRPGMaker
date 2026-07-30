import { canMove, isPassable } from "@/project/collision";
import { setMapTileOverride } from "@/project/session";
import { store } from "@/project/store";
import type { MapId, TransferFade } from "@/project/types";
import { characterSpriteX, characterSpriteY, updateCharacterDepth } from "@/player/characterDepth";
import type { StepResult } from "@/player/interpreter";
import { applyMapOverrides, fireAutoTriggers } from "@/player/playSceneMapRuntime";
import { dialogueHost } from "@/player/playSceneDom";
import { parseTransitionKind, usesOverlayTransition } from "@/player/transitions/transitionModel";
import { runTransitionPhase } from "@/player/transitions/transitionOverlay";
import type { PlaySceneContext, TransferRequest } from "@/player/playSceneTypes";
import { resetFollowerTrailNearPlayer } from "@/player/followers";
import { syncFollowerSprites } from "@/player/playSceneFollowers";

type FlashScreenStep = Extract<StepResult, { kind: "flashScreen" }>;
type ShakeScreenStep = Extract<StepResult, { kind: "shakeScreen" }>;

export function applyChangeTileStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "changeTile" }>
): void {
  const targetMap = store.getCurrent().maps[step.mapId];
  if (!targetMap) return;
  const index = step.y * targetMap.width + step.x;
  if (index < 0 || index >= targetMap.lowerTiles.length) return;
  setMapTileOverride(scene.session, step.mapId, step.layer, index, step.tile);
  if (step.mapId === scene.getMapId()) applyMapOverrides(scene);
}

type FadeColor = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
};

export const TRANSFER_FADE_DURATION_MS = 500;

export async function transferTo(scene: PlaySceneContext, request: TransferRequest): Promise<void> {
  const project = store.getCurrent();
  const targetMap = project.maps[request.mapId];
  if (!targetMap) {
    console.warn(`[player] transfer target map missing: ${request.mapId}`);
    return;
  }
  const destination = nearestPassableTile(project, targetMap, request.x, request.y);
  // 전환 연출: 모자이크/블라인드는 DOM 오버레이, 그 외(기본)는 카메라 페이드.
  const transition = parseTransitionKind(request.transition);
  const overlayTransition = usesOverlayTransition(transition);
  const host = overlayTransition ? dialogueHost(scene) : undefined;
  const fadeColor = overlayTransition ? null : transferFadeColor(request.fade ?? "black");
  if (host) {
    await runTransitionPhase(host, transition, "out", TRANSFER_FADE_DURATION_MS);
  } else if (fadeColor) {
    await fadeCamera(scene, "out", fadeColor);
  }
  scene.loadMap(request.mapId);
  scene.tileX = destination.x;
  scene.tileY = destination.y;
  scene.session.x = destination.x;
  scene.session.y = destination.y;
  resetFollowerTrailNearPlayer(scene.session, targetMap);
  if (request.direction && request.direction !== "retain") scene.facing = request.direction;
  scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
  scene.player.setPosition(characterSpriteX(destination.x), characterSpriteY(destination.y));
  updateCharacterDepth(scene.player, "same");
  syncFollowerSprites(scene);
  scene.moving = false;
  scene.centerCamera();
  if (host) {
    await runTransitionPhase(host, transition, "in", TRANSFER_FADE_DURATION_MS);
  } else if (fadeColor) {
    await fadeCamera(scene, "in", fadeColor);
  }
  void fireAutoTriggers(scene);
}

function transferFadeColor(fade: TransferFade): FadeColor | null {
  switch (fade) {
    case "black":
      return { red: 0, green: 0, blue: 0 };
    case "white":
      return { red: 255, green: 255, blue: 255 };
    case "none":
      return null;
  }
}

export function fadeCamera(scene: PlaySceneContext, phase: "in" | "out", color: FadeColor, durationMs = TRANSFER_FADE_DURATION_MS): Promise<void> {
  return new Promise((resolve) => {
    const eventName = phase === "out" ? "camerafadeoutcomplete" : "camerafadeincomplete";
    scene.cameras.main.once(eventName, () => resolve());
    if (phase === "out") {
      scene.cameras.main.fadeOut(durationMs, color.red, color.green, color.blue);
      return;
    }
    scene.cameras.main.fadeIn(durationMs, color.red, color.green, color.blue);
  });
}

// Flash Screen: 카메라 전체를 지정 색상으로 깜빡인다. fadeCamera 와 동일한
// Promise 패턴을 따른다. Phaser cameras.main.flash(duration, r, g, b) 사용.
export function flashCamera(scene: PlaySceneContext, step: FlashScreenStep): Promise<void> {
  return new Promise((resolve) => {
    scene.cameras.main.once("cameraflashcomplete", () => resolve());
    scene.cameras.main.flash(step.durationMs, step.red, step.green, step.blue);
  });
}

// Shake Screen: 카메라를 지정 시간 동안 흔든다. intensity 는 0~1 범위의 세기.
// RM2K3 의 흔들림 강도(1~10)를 Phaser 의 0~1 비율로 정규화한다.
export function shakeCamera(scene: PlaySceneContext, step: ShakeScreenStep): Promise<void> {
  return new Promise((resolve) => {
    scene.cameras.main.once("camerashakecomplete", () => resolve());
    const intensity = Math.min(0.05, Math.max(0.001, step.intensity / 100));
    scene.cameras.main.shake(step.durationMs, intensity);
  });
}

/**
 * 이 칸에서 **밖으로 한 걸음이라도 나갈 수 있는가**.
 *
 * 왜 필요한가(2026-07-27 실측): 착지 판정은 `isPassable` 을 썼는데, 그 함수는 스스로
 * "레거시 호환: 단순 passability(방향 무시) — EditScene 표시 등에 사용" 이라고 적혀 있는
 * 4방향 OR 판정이다. 반면 실제 이동은 `canMove` 로 **출발 칸의 나가는 비트 AND 도착 칸의
 * 들어오는 비트**를 본다. 둘의 기준이 달라서, 한 방향만 열린 타일(나무 데크 가장자리
 * 192/228/229/230 처럼 실제로 존재한다)에 transfer 로 내려놓으면 isPassable 은 통과시키지만
 * canMove 는 네 방향 모두 막아 **완전히 갇힌다**. 저장소에 갇힘 탈출 로직은 없다.
 */
function canLeaveTile(
  project: ReturnType<typeof store.getCurrent>,
  map: ReturnType<typeof store.getCurrent>["maps"][MapId],
  x: number,
  y: number
): boolean {
  return (
    canMove(project, map, x, y, x + 1, y) ||
    canMove(project, map, x, y, x - 1, y) ||
    canMove(project, map, x, y, x, y + 1) ||
    canMove(project, map, x, y, x, y - 1)
  );
}

export function nearestPassableTile(
  project: ReturnType<typeof store.getCurrent>,
  map: ReturnType<typeof store.getCurrent>["maps"][MapId],
  x: number,
  y: number
): { x: number; y: number } {
  const fx = Math.max(0, Math.min(map.width - 1, x));
  const fy = Math.max(0, Math.min(map.height - 1, y));
  // 착지 가능 = 밟을 수 있고(isPassable) **거기서 나갈 수도 있다**(canLeaveTile).
  const landable = (px: number, py: number): boolean =>
    isPassable(project, map, px, py) && canLeaveTile(project, map, px, py);
  if (landable(fx, fy)) return { x: fx, y: fy };
  for (let radius = 0; radius < Math.max(map.width, map.height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (landable(fx + dx, fy + dy)) return { x: fx + dx, y: fy + dy };
      }
    }
  }
  // 나갈 수 있는 칸이 정말 하나도 없는 맵(전부 막힌 방 등)이면, 최소한 밟을 수는 있는 칸으로
  // 물러선다 — 예전 동작과 같다. 아무 데도 못 가는 것보다는 낫다.
  for (let radius = 0; radius < Math.max(map.width, map.height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (isPassable(project, map, fx + dx, fy + dy)) return { x: fx + dx, y: fy + dy };
      }
    }
  }
  return { x: fx, y: fy };
}
