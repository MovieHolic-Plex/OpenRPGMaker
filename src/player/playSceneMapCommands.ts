import { isPassable, isPassableLanding } from "@/project/collision";
import { setMapTileOverride } from "@/project/session";
import { store } from "@/project/store";
import type { MapId, TransferFade } from "@/project/types";
import { characterSpriteY, footprintSpriteX, updateCharacterDepth } from "@/player/characterDepth";
import { resolveFootprintLanding } from "@/project/footprintLanding";
import { resolvePlayerBody } from "@/project/playerFootprint";
import type { StepResult } from "@/player/interpreter";
import { applyMapOverrides, fireAutoTriggers } from "@/player/playSceneMapRuntime";
import { dialogueHost } from "@/player/playSceneDom";
import { holdScreenFlash } from "@/player/playSceneScreenEffects";
import { parseTransitionKind, usesOverlayTransition } from "@/player/transitions/transitionModel";
import { runTransitionPhase } from "@/player/transitions/transitionOverlay";
import type { PlaySceneContext, TransferRequest } from "@/player/playSceneTypes";
import { removeFollowerFromSession, resetFollowerTrailNearPlayer, resolveCompanionRules } from "@/project/followers";
import { syncFollowerSprites } from "@/player/playSceneFollowers";
import { maybeAutosave } from "@/player/autosave";

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
  // 다중 타일 주인공은 목적지 한 칸이 비어 있어도 **몸이** 안 들어갈 수 있다 — 가까운 유효
  // 칸으로 밀어낸다. 1x1 은 검사 없이 지정 좌표를 그대로 받으므로 기존 워프와 동작이 같다.
  // loadMap 뒤에 계산하는 이유: 도착 맵의 런타임 이벤트 좌표(scene.eventPositions)를 봐야 한다.
  const body = resolvePlayerBody(project, scene.session);
  const landing = resolveFootprintLanding(
    project,
    targetMap,
    scene.session,
    scene.eventPositions,
    destination.x,
    destination.y,
    body.footprint,
    undefined, // maxRadius 는 기본값(8) 그대로
    body.passRows
  );
  scene.tileX = landing.x;
  scene.tileY = landing.y;
  scene.session.x = landing.x;
  scene.session.y = landing.y;
  if (resolveCompanionRules(project.system.companions).clearOnTransfer) {
    removeFollowerFromSession(scene.session, { all: true });
  }
  resetFollowerTrailNearPlayer(scene.session, targetMap, project.system.companions);
  if (request.direction && request.direction !== "retain") scene.facing = request.direction;
  scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
  scene.player.setPosition(footprintSpriteX(landing.x, body.footprint), characterSpriteY(landing.y));
  updateCharacterDepth(scene.player, "same");
  syncFollowerSprites(scene);
  scene.moving = false;
  scene.centerCamera();
  if (host) {
    await runTransitionPhase(host, transition, "in", TRANSFER_FADE_DURATION_MS);
  } else if (fadeColor) {
    await fadeCamera(scene, "in", fadeColor);
  }
  // 오토세이브 훅(PlayScene 경로 전용): 전이 좌표/맵이 세션에 커밋된 뒤, 도착 맵의
  // 자동 트리거가 상태를 바꾸기 전 시점을 굽는다. 정책(save 금지·디바운스·컷신)은 maybeAutosave 가 판정.
  maybeAutosave(project, scene.session, "transfer");
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
    let settled = false;
    const holdMs = Math.max(800, step.durationMs);
    holdScreenFlash(scene, { r: step.red, g: step.green, b: step.blue, a: 0.85 }, holdMs);
    const cam = scene.cameras?.main;
    if (cam && typeof cam.flash === "function") {
      cam.flash(holdMs, step.red, step.green, step.blue, true);
    }
    const graphics = typeof scene.add?.graphics === "function" ? scene.add.graphics() : null;
    if (graphics) {
      graphics.setScrollFactor(0);
      graphics.setDepth(900_000);
      const width = (cam?.width && cam.width > 1) ? cam.width : 320;
      const height = (cam?.height && cam.height > 1) ? cam.height : 240;
      const color = ((step.red & 255) << 16) | ((step.green & 255) << 8) | (step.blue & 255);
      graphics.fillStyle(color, 0.85);
      graphics.fillRect(0, 0, width, height);
    }
    const finish = (): void => {
      if (settled) return;
      settled = true;
      graphics?.destroy();
      const screen = scene.session.m2Runtime?.screen;
      if (screen?.tint === "255,255,255,0.85") {
        screen.tint = "none";
        screen.tintDurationMs = 0;
      }
      resolve();
    };
    const timeout = typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? window.setTimeout
      : setTimeout;
    timeout(finish, holdMs);
  });
}

export function shakeIntensityRatio(power: number): number {
  if (!Number.isFinite(power)) return SHAKE_MIN_RATIO;
  return Math.min(SHAKE_MAX_RATIO, Math.max(SHAKE_MIN_RATIO, power / 100));
}

/** 강도 1 의 자연값. 0 을 주면 흔들림이 아예 없어 "명령이 무시됐다" 로 보인다. */
const SHAKE_MIN_RATIO = 0.01;
/** 강도 10 의 자연값. 뷰포트의 10% — RM2K3 최대 흔들림에 해당한다. */
const SHAKE_MAX_RATIO = 0.1;

// Shake Screen: 카메라를 지정 시간 동안 흔든다.
export function shakeCamera(scene: PlaySceneContext, step: ShakeScreenStep): Promise<void> {
  return new Promise((resolve) => {
    scene.cameras.main.once("camerashakecomplete", () => resolve());
    scene.cameras.main.shake(step.durationMs, shakeIntensityRatio(step.intensity));
  });
}

export function nearestPassableTile(
  project: ReturnType<typeof store.getCurrent>,
  map: ReturnType<typeof store.getCurrent>["maps"][MapId],
  x: number,
  y: number
): { x: number; y: number } {
  const fx = Math.max(0, Math.min(map.width - 1, x));
  const fy = Math.max(0, Math.min(map.height - 1, y));
  if (isPassableLanding(project, map, fx, fy)) return { x: fx, y: fy };
  for (let radius = 0; radius < Math.max(map.width, map.height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (isPassableLanding(project, map, fx + dx, fy + dy)) return { x: fx + dx, y: fy + dy };
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
