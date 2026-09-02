import type { BattleSnapshot } from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyAutoTransparencyKey } from "@/assets/transparentColorKey";
import { store } from "@/project/store";
import type { BattleAnimationRecord, BattleAnimationTiming } from "@/project/types";
import {
  battleAnimationFrameDurationMs,
  battleAnimationSheetAssetScale,
  battleAnimationSheetRendering,
} from "@/player/battleAnimationPlayback";
import {
  BATTLE_EFFECT_CSS_VARIABLES,
  flashCssVariables,
  screenShakeCssVariables,
} from "@/player/battleAnimationEffectStyle";
import { battlerSpriteNode, findBattlerNode } from "@/player/battleFieldDom";
import { battleAnimationAnchor, type BattleAnchorBox } from "@/player/battleAnimationAnchor";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";

type CellSourceRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export interface BattleAnimationPlayback {
  readonly element: HTMLElement;
  readonly animationKey: string | undefined;
  destroy(): void;
}

export function syncBattleAnimationLayer(
  layer: HTMLElement,
  snapshot: BattleSnapshot,
  sceneRoot: HTMLElement
): BattleAnimationPlayback | undefined {
  const lastAnimation = snapshot.lastAnimation;
  const animationKey = lastAnimation ? `${lastAnimation.animationId}:${lastAnimation.targetId}` : undefined;
  const existing = layer.querySelector<HTMLElement>("[data-testid='battle-animation']");
  if (!animationKey) {
    existing?.remove();
    sceneRoot.classList.remove("battle-screen-shake", "battle-screen-flash");
    // 대상 플래시는 배틀러 노드에 붙으므로 씬 클래스만 걷으면 남는다.
    for (const node of sceneRoot.querySelectorAll(".battle-animation-target-flash")) {
      node.classList.remove("battle-animation-target-flash");
    }
    return undefined;
  }
  if (existing?.dataset.animationKey === animationKey) {
    return {
      element: existing,
      animationKey,
      destroy(): void {
        /* retained across ticks */
      },
    };
  }
  existing?.remove();
  const playback = mountBattleAnimationPlayback(snapshot, sceneRoot);
  if (!playback) return undefined;
  playback.element.dataset.animationKey = animationKey;
  // **먼저 붙이고 나서 잰다.** 순서가 뒤였을 때 레이어의 패딩 박스가 0×0 으로 잡혀
  // 측정 경로가 통째로 폴백으로 떨어졌다(실측: data-animation-anchor-why "layerRect 0x0").
  // 요소가 자기 컨테이닝 블록 안에 들어간 뒤에 재는 것이 백분율의 정의와도 맞는다.
  layer.append(playback.element);
  positionAnimation(playback.element, layer, lastAnimation!);
  return playback;
}

export function mountBattleAnimationPlayback(
  snapshot: BattleSnapshot,
  sceneRoot: HTMLElement | null = null
): BattleAnimationPlayback | undefined {
  const lastAnimation = snapshot.lastAnimation;
  if (!lastAnimation) return undefined;

  const record = battleAnimationRecord(lastAnimation.animationId);
  const element = document.createElement("div");
  element.className = "battle-animation";
  element.dataset.testid = "battle-animation";
  element.dataset.animationId = lastAnimation.animationId;
  // 대상 id 를 그대로 남긴다 — animationKey 를 파싱하지 않고 앵커 계측이 대상 노드를 찾는다.
  element.dataset.animationTargetId = lastAnimation.targetId;
  setOptionalDataset(element, "animationName", lastAnimation.name);
  setOptionalDataset(element, "animationResourceId", lastAnimation.resourceId);
  setOptionalDataset(element, "animationScope", lastAnimation.scope);
  setOptionalDataset(element, "animationPosition", lastAnimation.position);
  element.dataset.animationSoundResourceIds = lastAnimation.soundResourceIds.join(",");
  element.dataset.animationFlashTargets = lastAnimation.flashTargets.join(",");
  element.dataset.animationScreenShake = String(lastAnimation.screenShake);
  element.dataset.animationFrameCount = String(lastAnimation.frameCount);
  element.dataset.currentFrame = "0";
  element.setAttribute("aria-label", lastAnimation.name ?? lastAnimation.animationId);
  element.setAttribute("role", "img");

  const context: AnimationRenderContext = {
    sceneRoot,
    targetNode: findBattlerNode(sceneRoot ?? document, lastAnimation.targetId),
    frameDurationMs: battleAnimationFrameDurationMs(record),
  };

  const timers = new Set<number>();
  const url = resolveAssetResourceUrl(record?.resourceId, { project: store.getCurrent() });
  if (url && record?.sheet && record.frames && record.frames.length > 0) {
    element.dataset.renderedFrameCount = String(record.frames.length);
    element.append(animationSheet(record, url));
    setActiveAnimationFrame(element, record, 0, context);
    startPlayback(element, record, timers, context);
  }

  return {
    element,
    animationKey: `${lastAnimation.animationId}:${lastAnimation.targetId}`,
    destroy(): void {
      for (const timer of timers) window.clearInterval(timer);
      timers.clear();
      // 중간에 파괴돼도 효과 흔적을 남기지 않는다 — 남으면 다음 액션이 물려받는다.
      clearEffectClasses(context);
      element.remove();
    },
  };
}

/**
 * 애니메이션을 새롭게 잰 앵커에 놓는다.
 *
 * 앵커는 저작된 `position`(head/center/feet/screen)과 `scope`(screen 여부)가 정하고, 기준은
 * 대상 **스프라이트를 실제로 잰** 사각이다. 산식 자신은 순수 함수 `battleAnimationAnchor` 에
 * 있어 타이밍 없이 단위 테스트된다.
 *
 * 재지 못하면(레이아웃이 없는 happy-dom, 아직 로드 전이라 rect 가 0×0 인 스프라이트) 예전
 * `--battle-node-x/y` 복사 경로로 떨어진다. 어느 경로를 탔는지는 `data-animation-anchor` 에
 * 남기므로 사후 진단에서 짐작할 필요가 없다.
 */
function positionAnimation(
  element: HTMLElement,
  layer: HTMLElement,
  animation: NonNullable<BattleSnapshot["lastAnimation"]>
): void {
  if (applyMeasuredAnchor(element, layer, animation)) return;
  // 아군 노드 testid 는 battle-actor-<id> 형식 — findBattlerNode 로 통일 조회한다.
  const target = findBattlerNode(document, animation.targetId);
  if (!target) return;
  element.style.setProperty("--battle-node-x", target.style.getPropertyValue("--battle-node-x"));
  element.style.setProperty("--battle-node-y", target.style.getPropertyValue("--battle-node-y"));
  element.dataset.animationAnchor = "fallback";
  // 스프라이트가 아직 로드되지 않아 rect 가 0×0 이면 폴백이 **영구**가 된다 — 앵커를 다시
  // 계산할 계기가 없기 때문이다. 프레임마다 다시 재서 측정이 되는 순간 승격시킨다.
  // 고정 대기가 아니라 rAF 이고, 프레임 예산이 있어 무한히 돌지 않는다.
  retryMeasuredAnchor(element, layer, animation, ANCHOR_RETRY_FRAMES);
}

/** 폴백에서 승격을 노리는 프레임 예산. 60fps 기준 약 0.5초 — 이미지 디코드가 끝나기에
 *  충분하고, 애니메이션 자체(기본 프레임 120ms x 프레임 수)보다 오래 매달리지 않는다. */
const ANCHOR_RETRY_FRAMES = 30;

function applyMeasuredAnchor(
  element: HTMLElement,
  layer: HTMLElement,
  animation: NonNullable<BattleSnapshot["lastAnimation"]>
): boolean {
  const target = findBattlerNode(document, animation.targetId);
  const spriteBox = measuredSpriteBox(target);
  const containingBlock = anchorContainingBlock(element, layer);
  const layerBox = paddingBox(containingBlock);
  const placement = battleAnimationAnchor({
    position: animation.position,
    scope: animation.scope,
    spriteBox,
    layerBox,
  });
  if (!placement) {
    // **왜** 못 쟀는지 남긴다. 폴백은 좌표가 눈에 띄게 달라지는 경로이므로, "이상한 자리에
    // 떴다" 는 신고를 받았을 때 원인을 짐작하지 않고 DOM 에서 바로 읽을 수 있어야 한다.
    element.dataset.animationAnchorWhy = !target
      ? "noTarget"
      : !spriteBox || spriteBox.height <= 0 || spriteBox.width <= 0
        ? `spriteRect ${Math.round(spriteBox?.width ?? -1)}x${Math.round(spriteBox?.height ?? -1)}`
        : `layerRect ${Math.round(layerBox.width)}x${Math.round(layerBox.height)}`
          + ` cb ${containingBlock.className || containingBlock.tagName}`;
    return false;
  }
  delete element.dataset.animationAnchorWhy;
  element.dataset.animationAnchorCb = containingBlock.className || containingBlock.tagName;
  element.style.left = placement.left;
  element.style.top = placement.top;
  element.dataset.animationAnchor = placement.anchor;
  return true;
}

function retryMeasuredAnchor(
  element: HTMLElement,
  layer: HTMLElement,
  animation: NonNullable<BattleSnapshot["lastAnimation"]>,
  framesLeft: number
): void {
  if (framesLeft <= 0) return;
  requestAnimationFrame(() => {
    // 재생이 끝나 레이어에서 떼어졌거나 다른 애니메이션으로 교체됐으면 더 볼 것이 없다.
    if (!element.isConnected) return;
    if (applyMeasuredAnchor(element, layer, animation)) return;
    retryMeasuredAnchor(element, layer, animation, framesLeft - 1);
  });
}

/**
 * 백분율이 실제로 풀리는 **컨테이닝 블록**을 고른다.
 *
 * 레이어 엘리먼트를 그대로 쓰면 안 된다 — `.battle-animation-layer` 는 절대배치된 그리드
 * 아이템이고, 그 그리드 영역이 접히는 스킨에서는 자기 박스가 0×0 이 된다(실측 2026-08-30,
 * 출하 플레이어 + 기본 스킨 rm2003: `client 0x0 offset 0x0 connected true`). 그 0 으로
 * 나누면 앵커가 통째로 폴백으로 떨어지고, 폴백이 쓰는 `--battle-node-x/y` 백분율도 **같은**
 * 0×0 박스에서 풀리므로 이펙트가 무대 좌상단으로 끌려간다 — 감독이 신고한 "좌표가 이상함" 의
 * 실제 모습이다.
 *
 * 절대배치 요소의 `offsetParent` 는 정의상 그 요소의 컨테이닝 블록을 만드는 조상이다.
 * 그래서 CSS 가 레이어를 어떻게 바꾸든 브라우저가 실제로 쓰는 기준과 계산이 어긋나지 않는다.
 */
function anchorContainingBlock(element: HTMLElement, layer: HTMLElement): HTMLElement {
  const parent = element.offsetParent;
  if (parent instanceof HTMLElement && parent.clientWidth > 0 && parent.clientHeight > 0) return parent;
  return layer;
}

/**
 * 요소의 **패딩 박스**를 시각 px 로 만든다.
 *
 * `left`/`top` 백분율은 컨테이닝 블록의 패딩 박스에서 풀리는데 `getBoundingClientRect` 는
 * 경계 박스다. `clientLeft`/`clientWidth` 는 무대 배율이 곱해지지 않은 레이아웃 px 이므로,
 * 경계 박스와 `offsetWidth` 의 비로 배율을 구해 같은 좌표계로 옮긴다.
 */
function paddingBox(node: HTMLElement): BattleAnchorBox {
  const rect = node.getBoundingClientRect();
  const scale = node.offsetWidth > 0 ? rect.width / node.offsetWidth : 1;
  return {
    left: rect.left + node.clientLeft * scale,
    top: rect.top + node.clientTop * scale,
    width: node.clientWidth * scale,
    height: node.clientHeight * scale,
  };
}

function measuredSpriteBox(node: HTMLElement | null): BattleAnchorBox | undefined {
  if (!node) return undefined;
  return battlerSpriteNode(node).getBoundingClientRect();
}

function setOptionalDataset(element: HTMLElement, key: string, value: string | undefined): void {
  if (value) element.dataset[key] = value;
}

function battleAnimationRecord(animationId: string): BattleAnimationRecord | undefined {
  return store.getCurrent().database.battleAnimations.find((record) => record.id === animationId);
}

/**
 * 씬 루트에 적힌 전투 속도 배율을 읽는다(battleDom 의 setSpeed 가 `data-battle-speed` 로 쓴다).
 *
 * 예전에는 시퀀서만 배율을 적용하고 애니메이션은 상수 120ms 로 돌았다. 그래서 3배속을 켜면
 * 대사·모션은 빨라지는데 **이펙트만 원속도로 남아** 다음 행동 위로 겹쳤고, 배속을 연출
 * 검수용으로 쓸 수 없었다.
 */
export function battleAnimationFrameMs(
  sceneRoot: HTMLElement | null,
  record?: BattleAnimationRecord
): number {
  const raw = Number(sceneRoot?.dataset.battleSpeed);
  // 시퀀서와 같은 하한(0.2)을 쓴다 — 여기만 다르면 배속을 올릴수록 서로 어긋난다.
  const speed = Number.isFinite(raw) && raw > 0 ? Math.max(0.2, raw) : 1;
  return Math.max(10, Math.round(battleAnimationFrameDurationMs(record) / speed));
}

function startPlayback(
  element: HTMLElement,
  record: BattleAnimationRecord,
  timers: Set<number>,
  context: AnimationRenderContext
): void {
  const frames = record.frames ?? [];
  if (frames.length <= 1) return;
  let index = 0;
  const timer = window.setInterval(() => {
    index += 1;
    if (index >= frames.length) {
      window.clearInterval(timer);
      timers.delete(timer);
      finishPlayback(element, context);
      return;
    }
    setActiveAnimationFrame(element, record, index, context);
  }, battleAnimationFrameMs(context.sceneRoot, record));
  timers.add(timer);
}

/**
 * 재생이 끝나면 그림을 걷는다.
 *
 * 예전에는 `clearInterval` 만 하고 마지막 프레임을 그대로 뒀다. 엘리먼트 제거는 다음
 * 엔트리이거나 시퀀스 종료 시점이라, 그 사이 약 1초 동안 **마지막 컷이 화면에 얼어붙어**
 * 있었다. 감독 눈에는 "이펙트가 안 사라진다" 로 보인다.
 */
function finishPlayback(element: HTMLElement, context: AnimationRenderContext): void {
  for (const frame of element.querySelectorAll<HTMLElement>(".battle-animation-frame")) {
    frame.hidden = true;
  }
  element.dataset.playbackFinished = "true";
  clearEffectClasses(context);
}

function animationSheet(record: BattleAnimationRecord, url: string): HTMLElement {
  const sheet = document.createElement("div");
  sheet.className = "battle-animation-sheet";
  sheet.dataset.testid = "battle-animation-sheet";
  const frames = record.frames ?? [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    if (!frame) continue;
    sheet.append(animationFrame(record, frame.cells, frameIndex, url));
  }
  return sheet;
}

function animationFrame(
  record: BattleAnimationRecord,
  cells: NonNullable<BattleAnimationRecord["frames"]>[number]["cells"],
  frameIndex: number,
  url: string
): HTMLElement {
  const frameNode = document.createElement("div");
  frameNode.className = "battle-animation-frame";
  frameNode.dataset.testid = `battle-animation-frame-${frameIndex + 1}`;
  frameNode.dataset.frameIndex = String(frameIndex);
  for (const cell of cells) {
    if (!cell.visible || !record.sheet) continue;
    frameNode.append(animationCell(record, cell, url));
  }
  return frameNode;
}

function animationCell(
  record: BattleAnimationRecord,
  cell: NonNullable<BattleAnimationRecord["frames"]>[number]["cells"][number],
  url: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  if (!record.sheet) return canvas;
  canvas.className = "battle-animation-cell";
  canvas.dataset.testid = "battle-animation-cell";
  canvas.dataset.pattern = String(cell.pattern);
  canvas.width = record.sheet.frameWidth;
  canvas.height = record.sheet.frameHeight;
  // 프레임 비트맵은 **시트 배율**로 논리 px 에 옮긴다 — 320 시대 RM 시트는 2(96px → 192),
  // 번들 고해상도 시트는 0.5(384px → 같은 192). 축소되는 시트는 보간을 켜야 가장자리가 안 깨진다.
  const sheetScale = battleAnimationSheetAssetScale(record.sheet);
  canvas.dataset.rendering = battleAnimationSheetRendering(record.sheet);
  canvas.style.width = `${record.sheet.frameWidth * sheetScale}px`;
  canvas.style.height = `${record.sheet.frameHeight * sheetScale}px`;
  // 셀 좌표는 시트 해상도와 무관하게 **RM px**(320×240 기준 저작 데이터)다. 전투 씬의 논리
  // 해상도는 640×480 이라 항상 2를 곱한다 — 시트 배율을 여기에 곱하면 고해상도 시트의 오프셋이 1/4 로 준다.
  const assetScale = BATTLE_ASSET_PIXEL_SCALE;
  canvas.style.left = `calc(50% + ${cell.x * assetScale}px)`;
  canvas.style.top = `calc(50% + ${cell.y * assetScale}px)`;
  canvas.style.opacity = String(Math.max(0, Math.min(255, cell.opacity)) / 255);
  canvas.style.transform = `translate(-50%, -50%) scale(${Math.max(1, cell.zoom) / 100})`;

  const column = cell.pattern % record.sheet.columns;
  const row = Math.floor(cell.pattern / record.sheet.columns);
  drawChromaKeyedCell(canvas, url, {
    x: column * record.sheet.frameWidth,
    y: row * record.sheet.frameHeight,
    width: record.sheet.frameWidth,
    height: record.sheet.frameHeight,
  });
  return canvas;
}

/**
 * 프레임을 그릴 때 필요한 대상들.
 * `targetNode` 는 flash.target === "target" 을 대상에게만 걸기 위해 필요하다 —
 * 예전에는 대상 지정을 무시하고 무조건 화면 전체를 번쩍였다.
 */
type AnimationRenderContext = {
  readonly sceneRoot: HTMLElement | null;
  readonly targetNode: HTMLElement | null;
  readonly frameDurationMs: number;
};

function setActiveAnimationFrame(
  element: HTMLElement,
  record: BattleAnimationRecord,
  frameIndex: number,
  context: AnimationRenderContext
): void {
  element.dataset.currentFrame = String(frameIndex);
  const frames = element.querySelectorAll<HTMLElement>(".battle-animation-frame");
  for (const frame of frames) {
    frame.hidden = frame.dataset.frameIndex !== String(frameIndex);
  }
  const timing = record.timings?.find((entry) => entry.frameIndex === frameIndex);
  element.dataset.activeSoundResourceId = timing?.soundResourceId ?? "";
  element.dataset.activeFlashTarget = timing?.flash?.target ?? "";
  element.dataset.activeScreenShake = String(Boolean(timing?.screenShake));
  element.classList.toggle("battle-animation-flash-active", Boolean(timing?.flash));
  element.classList.toggle("battle-animation-shake-active", Boolean(timing?.screenShake));
  applyTimingEffects(context, timing);
  playTimingSound(timing?.soundResourceId);
}

/**
 * 프레임 타이밍의 flash/screenShake 를 화면에 반영한다.
 *
 * flash 는 `target` 이 정한 곳에만 건다 — "screen" 은 씬 전체, "target" 은 대상 배틀러 노드.
 * 예전에는 존재 여부만 보고 무조건 씬 전체를 번쩍여서, 한 명만 회복해도 화면이 통째로 밝아졌다.
 * 대상 노드를 못 찾으면(레이아웃/스킨 차이) 씬 플래시로 떨어뜨려 연출이 통째로 사라지지 않게 한다.
 */
function applyTimingEffects(context: AnimationRenderContext, timing: BattleAnimationTiming | undefined): void {
  const { sceneRoot, targetNode } = context;
  const flash = timing?.flash;
  const screenShake = timing?.screenShake;
  const flashOnTarget = Boolean(flash) && flash!.target === "target" && targetNode !== null;

  if (targetNode) {
    setEffectVariables(targetNode, flashOnTarget ? flash : undefined, undefined, context.frameDurationMs);
    targetNode.classList.toggle("battle-animation-target-flash", flashOnTarget);
  }
  if (!sceneRoot) return;
  setEffectVariables(sceneRoot, flashOnTarget ? undefined : flash, screenShake, context.frameDurationMs);
  sceneRoot.classList.toggle("battle-screen-shake", Boolean(screenShake));
  sceneRoot.classList.toggle("battle-screen-flash", Boolean(flash) && !flashOnTarget);
}

/** 재생 종료·엔트리 교체 시 효과 흔적을 걷는다. 남으면 다음 액션이 물려받는다. */
function clearEffectClasses(context: AnimationRenderContext): void {
  context.sceneRoot?.classList.remove("battle-screen-shake", "battle-screen-flash");
  context.targetNode?.classList.remove("battle-animation-target-flash");
}

function setEffectVariables(
  host: HTMLElement,
  flash: BattleAnimationTiming["flash"],
  screenShake: BattleAnimationTiming["screenShake"],
  frameDurationMs: number
): void {
  // 효과 없는 프레임에서 걷어내지 않으면 다음 효과가 이전 값을 물려받는다.
  for (const name of BATTLE_EFFECT_CSS_VARIABLES) host.style.removeProperty(name);
  const variables = {
    ...(flash ? flashCssVariables(flash, frameDurationMs) : {}),
    ...(screenShake ? screenShakeCssVariables(screenShake, frameDurationMs) : {}),
  };
  for (const [name, value] of Object.entries(variables)) host.style.setProperty(name, value);
}

function playTimingSound(soundResourceId: string | undefined): void {
  const url = resolveAssetResourceUrl(soundResourceId, { project: store.getCurrent() });
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = 0.4;
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "NotAllowedError") return;
    throw error;
  });
}

function drawChromaKeyedCell(canvas: HTMLCanvasElement, url: string, source: CellSourceRect): void {
  const image = new Image();
  image.addEventListener("load", () => {
    const context = canvas.getContext("2d");
    if (!context) return;
    const { x, y, width, height } = source;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, x, y, width, height, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    // 단일 색(마젠타/녹색/검은 등 어떤 단색 배경이든) 을 자동 감지해 키아웃한다.
    // 투명 PNG 는 테두리가 이미 alpha=0 이라 no-op 이다.
    applyAutoTransparencyKey(pixels.data, width, height);
    context.putImageData(pixels, 0, 0);
    canvas.dataset.rendered = "true";
  });
  image.src = url;
}
