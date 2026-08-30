import type { BattleAnimationPosition, BattleAnimationScope } from "@/project/types";

/**
 * 전투 애니메이션의 앵커 계산 — **순수 함수**.
 *
 * 왜 분리했나: 예전에는 `positionAnimationOnTarget` 이 대상 노드의 `--battle-node-x/y`
 * **문자열을 그대로 복사**했다. 그 값은 배틀러의 **발**(`.battle-enemy`/`.battle-actor` 는
 * `translate(-50%, -100%)`)을 가리키는 백분율이라 두 가지가 동시에 깨졌다.
 *
 * 1. 애니메이션이 몸통이 아니라 발목 높이에 찍혔다. `.battle-animation` 은 240×240 박스에
 *    `translate(-50%, -55%)` 였으므로 시트 중심이 발에서 12px(= 240×5%) 위였고, 스프라이트
 *    높이는 144px 급이다.
 * 2. 백분율은 **소비하는 요소의 컨테이닝 블록**에서 풀린다. 애니메이션 레이어와 배틀러
 *    그룹은 서로 다른 박스이고, 12종 스킨 CSS 가 손으로 맞춘 inset 이 픽셀 단위로 같아야만
 *    성립했다. 과거 실측 72px 어긋남이 그 취약함의 기록이다
 *    (`src/styles/runtime/battle/04-anim-damage-layers.css` 머리 주석).
 *
 * 이제 앵커는 **대상 스프라이트를 실측**해서 정하고, 저작 스키마의 `position`/`scope` 계약을
 * 지킨다. 결과를 px 이 아니라 **레이어 박스에 대한 백분율**로 돌려주는 이유:
 * `.battle-scene` 에는 `transform: scale(var(--battle-stage-scale))` 이 걸려 있어
 * `getBoundingClientRect` 는 배율이 곱해진 시각 px 을 준다. px 로 심으면 배율만큼 어긋나지만,
 * **같은 레이어 rect 로 나눈 비율에서는 배율이 약분된다.** 데미지 팝업
 * (`battleFieldDom.showDamageFeedback`)이 이미 쓰는 방식이라 계산이 한 종류로 통일된다.
 */

/** 계산에 필요한 최소 사각. `DOMRect` 를 그대로 넣을 수 있고, 테스트는 리터럴만 넣는다. */
export interface BattleAnchorBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface BattleAnimationAnchorInput {
  /** 저작된 표시 위치. 없으면 `center` — RM2K3 기본값이자 기존 연출 의도에 가장 가깝다. */
  readonly position?: BattleAnimationPosition;
  /** 저작된 적용 범위. `screen` 이면 대상을 무시하고 무대 중심에 놓는다. */
  readonly scope?: BattleAnimationScope;
  /** 대상 **스프라이트**의 사각. 노드가 아니다 — 아군 노드는 176×192 고정 박스다. */
  readonly spriteBox?: BattleAnchorBox;
  /** `.battle-animation-layer` 의 사각. 애니메이션 엘리먼트의 컨테이닝 블록. */
  readonly layerBox: BattleAnchorBox;
}

export interface BattleAnimationAnchorPlacement {
  /** `left` 로 심을 백분율 문자열. */
  readonly left: string;
  /** `top` 으로 심을 백분율 문자열. */
  readonly top: string;
  /** 어느 계약으로 풀렸는지 — `data-animation-anchor` 로 찍어 사후 진단에 쓴다. */
  readonly anchor: BattleAnimationPosition;
}

/** 대상을 무시하고 무대 중심에 놓는 연출인가. RM2K3 의 전체화면 애니메이션이다. */
export function isScreenAnchoredAnimation(
  scope: BattleAnimationScope | undefined,
  position: BattleAnimationPosition | undefined
): boolean {
  return scope === "screen" || position === "screen";
}

/**
 * 앵커를 백분율로 계산한다. 잴 수 없으면 `undefined` — 호출부가 기존 `--battle-node-x/y`
 * 복사 경로로 조용히 떨어진다(레이아웃이 없는 happy-dom, 아직 로드 안 된 스프라이트).
 */
export function battleAnimationAnchor(
  input: BattleAnimationAnchorInput
): BattleAnimationAnchorPlacement | undefined {
  const { layerBox, scope, position } = input;
  if (!isMeasurable(layerBox)) return undefined;
  if (isScreenAnchoredAnimation(scope, position)) {
    return { left: "50%", top: "50%", anchor: "screen" };
  }
  const spriteBox = input.spriteBox;
  if (!spriteBox || !isMeasurable(spriteBox)) return undefined;
  const resolved: BattleAnimationPosition = position ?? "center";
  return {
    left: percentOf(spriteBox.left + spriteBox.width / 2 - layerBox.left, layerBox.width),
    top: percentOf(anchorY(resolved, spriteBox) - layerBox.top, layerBox.height),
    anchor: resolved,
  };
}

/** `head` 는 스프라이트 상단, `center` 는 세로 중심, `feet` 는 하단(= 접지선). */
function anchorY(position: BattleAnimationPosition, spriteBox: BattleAnchorBox): number {
  if (position === "head") return spriteBox.top;
  if (position === "feet") return spriteBox.top + spriteBox.height;
  return spriteBox.top + spriteBox.height / 2;
}

function isMeasurable(box: BattleAnchorBox): boolean {
  return box.width > 0 && box.height > 0;
}

/** 소수 셋째 자리까지 — 반올림 잔차가 문자열로 새지 않게 고정한다. */
function percentOf(offset: number, extent: number): string {
  return `${Math.round((offset / extent) * 100_000) / 1000}%`;
}
