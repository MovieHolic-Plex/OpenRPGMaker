import { mapTileSize } from "@/project/tileGeometry";
import { carryPursuitThroughDoor } from "./horrorRuntime";
import { diagnosticObserved, diagnosticToken, publishDiagnostic } from "@/util/diagnosticObserver";
import { isPassable, isPassableLanding } from "@/project/collision";
import { setMapTileOverride } from "@/project/session";
import { runtimeMap } from "@/project/runtimeMap";
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
// 잎 모듈에서 가져온다 — playSceneMovement 를 통하면 전투·농사·조우까지 끌려온다(playerRouteState 주석).
import { clearPlayerRouteThrough } from "@/player/playerRouteState";
import { maybeAutosave } from "@/player/autosave";
import { fireLocationTransitionTriggersAfterTransfer } from "@/player/playSceneLocationTransitions";
import { abortHop } from "@/player/characterHopRuntime";
import { clearFurniturePush, furniturePushPosition } from "@/player/furniturePushAnimation";

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

/** Coordinates are already committed by the interpreter; discard only affected motion. */
export function applyEventRelocationStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "relocateEvents" }>
): void {
  for (const eventId of step.eventIds) {
    if (scene.autonomousNPCs.get(eventId)?.activeMove?.hop) {
      abortHop(scene, eventId, scene.eventSprites.get(eventId));
    }
    if (furniturePushPosition(scene, eventId)) clearFurniturePush(scene);
    scene.autonomousNPCs.delete(eventId);
    scene.commandMoveRouteEventIds.delete(eventId);
    scene.pageMoveRouteEventIds.delete(eventId);
  }
}

type FadeColor = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
};

export const TRANSFER_FADE_DURATION_MS = 500;

export async function transferTo(scene: PlaySceneContext, request: TransferRequest): Promise<void> {
  const diagnosticOwner = diagnosticToken();
  const project = store.getCurrent();
  const targetMap = project.maps[request.mapId];
  if (!targetMap) {
    if (diagnosticObserved("transfer")) publishDiagnostic({ category: "transfer", phase: "missing" });
    console.warn(`[player] transfer target map missing: ${request.mapId}`);
    return;
  }
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
  // Resolve once against destination runtime terrain and destination-scoped event positions.
  // Queue this final landing, not the requested tile or the source map's position overlay.
  const destinationMap = runtimeMap(targetMap, scene.session);
  const destination = nearestPassableTile(project, destinationMap, request.x, request.y);
  const body = resolvePlayerBody(project, scene.session);
  const landing = resolveFootprintLanding(
    project, destinationMap, scene.session,
    request.mapId === scene.map.id ? scene.eventPositions : {},
    destination.x, destination.y, body.footprint, undefined, body.passRows
  );
  carryPursuitThroughDoor({ project, map: scene.map, session: scene.session, positions: scene.eventPositions }, scene.autonomousNPCs,
    { mapId: request.mapId, ...landing });
  // 드나듦 트리거의 «나간 맵» 은 loadMap 이 scene.map 을 갈아치기 **전**에 잡아야 한다.
  const departureMapId = scene.map.id;
  scene.loadMap(request.mapId);
  scene.tileX = landing.x;
  scene.tileY = landing.y;
  scene.session.x = landing.x;
  scene.session.y = landing.y;
  if (diagnosticOwner && diagnosticOwner === diagnosticToken() && diagnosticObserved("transfer")) publishDiagnostic({ category: "transfer", phase: "completed", x: landing.x, y: landing.y });
  if (resolveCompanionRules(project.system.companions).clearOnTransfer) {
    removeFollowerFromSession(scene.session, { all: true });
  }
  resetFollowerTrailNearPlayer(scene.session, destinationMap, project.system.companions);
  if (request.direction && request.direction !== "retain") scene.facing = request.direction;
  scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
  scene.player.setPosition(footprintSpriteX(landing.x, body.footprint, mapTileSize(scene.map)), characterSpriteY(landing.y, mapTileSize(scene.map)));
  updateCharacterDepth(scene.player, "same");
  syncFollowerSprites(scene);
  scene.moving = false;
  // 강제 이동 루트는 전이를 넘어 살아남는다(진행 중인 걸음만 끊는다). 그 루트의 통과 설정은
  // 출발 맵 기준으로 켠 것이라 여기서 끈다 — clearPlayerRouteThrough 주석의 수명 계약.
  clearPlayerRouteThrough(scene);
  scene.centerCamera();
  if (host) {
    await runTransitionPhase(host, transition, "in", TRANSFER_FADE_DURATION_MS);
  } else if (fadeColor) {
    await fadeCamera(scene, "in", fadeColor);
  }
  // 오토세이브 훅(PlayScene 경로 전용): 전이 좌표/맵이 세션에 커밋된 뒤, 도착 맵의
  // 자동 트리거가 상태를 바꾸기 전 시점을 굽는다. 정책(save 금지·디바운스·컷신)은 maybeAutosave 가 판정.
  maybeAutosave(project, scene.session, "transfer");
  // 순간이동은 중간 걸음이 없지만 «나갔다/들어왔다» 는 그대로 사실이다.
  // 자동 트리거보다 **먼지** 판정하는 것은 우선순위 선언이다: 도착 맵의 자동 이벤트가
  // 먼지 돌아 running 을 썼으면 구역 진입 이벤트가 조용하 생략된다. 모두 자기 지점에서
  // 한 번만 돌는 사건이고, «어떤 구역에 들어왔는가» 가 맵 전역 연출보다 국지적이다.
  fireLocationTransitionTriggersAfterTransfer(scene, departureMapId);
  void fireAutoTriggers(scene);
}

/**
 * 같은 맵 안에서 주인공을 한 칸으로 옮긴다(디버그 순간이동). transferTo 의 착지 뒤 화면 동기화와
 * 같은 몫 — 세션·칸 좌표만 쓰면 스프라이트와 카메라가 옛 자리에 남아 화면과 판정이 어긋난다.
 * 맵을 다시 싣지 않으므로 NPC 위치·지운 이벤트는 그대로다.
 */
export function placePlayerOnCurrentMap(scene: PlaySceneContext, x: number, y: number): void {
  const project = store.getCurrent();
  const body = resolvePlayerBody(project, scene.session);
  scene.tileX = x;
  scene.tileY = y;
  scene.session.x = x;
  scene.session.y = y;
  resetFollowerTrailNearPlayer(scene.session, runtimeMap(scene.map, scene.session), project.system.companions);
  scene.player.setPosition(footprintSpriteX(x, body.footprint, mapTileSize(scene.map)), characterSpriteY(y, mapTileSize(scene.map)));
  updateCharacterDepth(scene.player, "same");
  syncFollowerSprites(scene);
  scene.moving = false;
  // 순간이동은 걸음을 떼지 않으므로 연타 디바운스 키를 여기서 비운다 — 안 비우면 옮긴 자리에서 같은
  // NPC 에게 다시 말을 걸 수 없다.
  scene.lastActionTargetKey = "";
  scene.centerCamera();
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
  const landing = scanSquareRings(map, fx, fy, (cx, cy) => isPassableLanding(project, map, cx, cy));
  if (landing) return landing;
  // 나갈 수 있는 칸이 정말 하나도 없는 맵(전부 막힌 방 등)이면, 최소한 밟을 수는 있는 칸으로
  // 물러선다 — 예전 동작과 같다. 아무 데도 못 가는 것보다는 낫다.
  return scanSquareRings(map, fx, fy, (cx, cy) => isPassable(project, map, cx, cy)) ?? { x: fx, y: fy };
}

/**
 * 중심에서 바깥으로 정사각 고리를 하나씩 훑어 처음 맞는 칸을 낸다.
 *
 * 예전에는 반경마다 **안쪽 정사각 전체**를 다시 훑어 최악 O(D³) 였다(시간표 NPC 가 막힌 목표를
 * 가질 때 100ms 마다 불린다). 안쪽은 이전 반경에서 이미 전부 실패했으므로 고리만 보면 된다.
 * 한 반경 안의 방문 순서(행 우선: dy 오름차순, 그 안에서 dx 오름차순)는 그대로라 결과가 같다.
 */
function scanSquareRings(
  map: { readonly width: number; readonly height: number },
  fx: number,
  fy: number,
  accept: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  const limit = Math.max(map.width, map.height);
  for (let radius = 0; radius < limit; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const edgeRow = dy === -radius || dy === radius;
      const step = edgeRow || radius === 0 ? 1 : radius * 2;
      for (let dx = -radius; dx <= radius; dx += step) {
        if (accept(fx + dx, fy + dy)) return { x: fx + dx, y: fy + dy };
      }
    }
  }
  return null;
}
