/**
 * 캐릭터 체공(hop) 채널 — 접지 좌표를 건드리지 않고 스프라이트만 위로 띄운다.
 *
 * 왜 `sprite.y` 를 쓰지 않는가 (실측):
 * - depth 가 `characterDepth(priority, sprite.y)` 로 계산된다(characterDepth.ts:58,82).
 *   TILE_SIZE=16 이라 타일 한 줄이 정확히 depth 16 단위여서, 16px 만 띄우면 한 줄 위
 *   캐릭터·솔리드 가구(×) 뒤로 들어간다.
 * - 카메라가 스프라이트 객체를 직접 따라간다(`startFollow(player, true, 0.2, 0.2)`,
 *   PlayScene.ts). y 를 올리면 화면 전체가 아크를 지연 추종해 떤다.
 * - 조명 광원이 `sprite.y` 를 나눠 타일을 만든다(playSceneLighting.ts:166) — 횃불이 함께 뜬다.
 * - e2e/드라이버 다섯 곳이 `Math.floor(sprite.y / 16)` 로 타일을 뽑는다. y 가 정확히 타일
 *   경계라 1px 만 띄워도 타일 값이 통째로 한 칸 튄다.
 * - 액션 전투의 넉백은 sprite.y 를 절대 좌표로 트윈한다(playSceneActionCombat.ts) — 오프셋이 지워진다.
 *
 * 그래서 리프트는 **원점(origin)** 에 넣는다. 원점은 이미 `placeCharacterSprite` 가 (0.5, 1) 로
 * 소유하고 있고, 원점을 늘리면 렌더만 위로 올라가고 `sprite.y` 는 접지선에 남는다.
 *
 * ⚠️ Phaser `setFrame` 은 `updateDisplayOrigin()` 을 호출해 원점을 기본값으로 되돌린다.
 * 따라서 리프트는 **프레임 갱신 뒤에** 다시 얹어야 한다. 호출 순서가 이 모듈의 계약이다.
 */

import { TILE_SIZE } from "@/assets/bundled";

/** 캐릭셋 프레임 세로 픽셀(RESOURCE_SLICING.charset 24×32). 스프라이트가 높이를 못 줄 때의 폴백. */
export const CHARSET_FRAME_HEIGHT = 32;

export type CharacterHopKind = "jump" | "fall";

export type CharacterHop = {
  readonly kind: CharacterHopKind;
  /** 점프면 최고점, 낙하면 시작 높이. 월드 픽셀. */
  readonly liftPx: number;
  readonly durationMs: number;
  /** 착지 시 재생할 효과음 리소스 id. */
  readonly se?: string;
  /** 착지 임팩트(흔들림·먼지)를 낼지. 낙하는 기본 true, 점프는 기본 false. */
  readonly impact: boolean;
};

/** 제자리 홉/한 칸 점프의 기본 최고점. 타일 3/4 높이면 캐릭셋 24×32 에서 눈에 확실히 보인다. */
export const DEFAULT_JUMP_PEAK_PX = Math.round(TILE_SIZE * 0.75);
export const DEFAULT_JUMP_DURATION_MS = 300;
/** 낙하 등장 기본 높이 — 320×240 화면에서 8칸이면 화면 위 밖에서 떨어진다. */
export const DEFAULT_FALL_HEIGHT_PX = TILE_SIZE * 8;
export const DEFAULT_FALL_DURATION_MS = 620;

export const MAX_HOP_LIFT_PX = TILE_SIZE * 60;
export const MIN_HOP_DURATION_MS = 60;
export const MAX_HOP_DURATION_MS = 5_000;

/** 저작 값은 어디서도 clamp 되지 않으므로(shapeCommandFields 는 requireNumber 뿐) 런타임에서 잠근다. */
export function clampHopLiftPx(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_HOP_LIFT_PX, Math.round(value)));
}

export function clampHopDurationMs(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_JUMP_DURATION_MS;
  return Math.max(MIN_HOP_DURATION_MS, Math.min(MAX_HOP_DURATION_MS, Math.round(value)));
}

/** 저작 명령(`jump`/`dropIn`) 의 옵션 필드. 구조적 타입이라 이 모듈은 프로젝트 타입을 몰라도 된다. */
export type HopOptions = {
  readonly heightPx?: number;
  readonly durationMs?: number;
  readonly se?: string;
  readonly impact?: boolean;
};

export function jumpHop(options: HopOptions = {}): CharacterHop {
  return {
    kind: "jump",
    liftPx: clampHopLiftPx(options.heightPx ?? DEFAULT_JUMP_PEAK_PX),
    durationMs: clampHopDurationMs(options.durationMs ?? DEFAULT_JUMP_DURATION_MS),
    se: options.se,
    impact: options.impact ?? false,
  };
}

/** 낙하는 착지 임팩트가 기본 on 이다 — 보스가 떨어졌는데 화면이 안 흔들리면 무게가 없다. */
export function fallHop(options: HopOptions = {}): CharacterHop {
  return {
    kind: "fall",
    liftPx: clampHopLiftPx(options.heightPx ?? DEFAULT_FALL_HEIGHT_PX),
    durationMs: clampHopDurationMs(options.durationMs ?? DEFAULT_FALL_DURATION_MS),
    se: options.se,
    impact: options.impact ?? true,
  };
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

/**
 * 점프 아크 — 양 끝이 0 인 포물선. peak*4p(1-p) 는 p=0.5 에서 정확히 peak 다.
 * 시작·끝이 0 이므로 착지 프레임에서 리프트가 반드시 지면으로 돌아온다.
 */
export function jumpArcLiftPx(progress: number, peakPx: number): number {
  const p = clampProgress(progress);
  return clampHopLiftPx(peakPx) * 4 * p * (1 - p);
}

/**
 * 낙하 헤드스타트 — 낙하 구간을 자유낙하 곡선의 **중간부터** 잘라 쓴다.
 *
 * 왜 (실측): 초속 0 인 순수 `1-p²` 는 620ms / 128px 기본값에서 앞 절반(310ms)에 32px,
 * 즉 전체의 25% 만 내려온다. 화면에서는 캐릭터가 위쪽에 붙어 어물거리다 마지막에 훅
 * 지나가 "떨어진다" 보다 "사라진다" 로 읽힌다.
 *
 * 그리고 `dropIn` 은 **화면 밖에서 떨어져 들어오는** 등장 연출이라 등장 순간의 속도가 0 인
 * 것이 오히려 비물리적이다. u = p₀ + (1-p₀)p 로 곡선을 p₀ 지점부터 시작하면 가속도는
 * 그대로 등가속이면서 초속만 붙는다. 0.45 에서 앞 절반 이동량이 25% → 41% 가 된다.
 */
export const FALL_HEAD_START = 0.45;

/**
 * 낙하 — 등가속(중력)에 헤드스타트를 얹는다. (1-u²)/(1-p₀²) 는 p=0 에서 1, p=1 에서 0 이고
 * 도함수 크기가 u 에 비례해 계속 빨라진다(등가속 유지).
 */
export function fallLiftPx(progress: number, heightPx: number): number {
  const p = clampProgress(progress);
  const u = FALL_HEAD_START + (1 - FALL_HEAD_START) * p;
  const span = 1 - FALL_HEAD_START * FALL_HEAD_START;
  return clampHopLiftPx(heightPx) * ((1 - u * u) / span);
}

export function characterHopLiftPx(hop: CharacterHop, progress: number): number {
  return hop.kind === "fall" ? fallLiftPx(progress, hop.liftPx) : jumpArcLiftPx(progress, hop.liftPx);
}

/**
 * 스쿼시·스트레치 채널 — 리프트만 있는 강체 이동은 무게가 없다. 빠를 때 세로로 늘고
 * 착지에서 납작해지는 두 프레임이 "떨어졌다" 를 만든다.
 *
 * 스케일은 이 런타임에서 아무도 안 건드린다(액션 전투 스윙 스쿼시가 같은 채널을 같은 방식으로
 * 쓴다 — playSceneActionCombat.ts `pulsePlayerSwing`). 원점이 (0.5, 1) 이라 세로 스케일은
 * **발밑을 축으로** 늘어난다 — 접지선이 흔들리지 않는다.
 */
export const HOP_STRETCH_MAX = 0.22;
export const HOP_SQUASH_MAX = 0.26;
export const HOP_SQUASH_MS = 150;
/** 이 높이에서 스쿼시·스트레치가 최대. 3 칸 — 제자리 홉(12px)이 만화처럼 늘어나지 않게 잠근다. */
const SQUASH_GATE_LIFT_PX = TILE_SIZE * 3;

export type HopScale = { readonly x: number; readonly y: number };

export const HOP_SCALE_NEUTRAL: HopScale = { x: 1, y: 1 };

/** 곡선의 최대 속도를 1 로 정규화한 이번 프레임의 속력. 낙하는 헤드스타트만큼 이미 빠르다. */
export function hopSpeedRatio(hop: CharacterHop, progress: number): number {
  const p = clampProgress(progress);
  if (hop.kind === "fall") return FALL_HEAD_START + (1 - FALL_HEAD_START) * p;
  // 점프 도함수는 4·peak·(1-2p) — 이·착지에서 최대, 최고점에서 0 이다.
  return Math.abs(1 - 2 * p);
}

function squashGate(liftPx: number): number {
  return Math.max(0, Math.min(1, clampHopLiftPx(liftPx) / SQUASH_GATE_LIFT_PX));
}

/** 체공 중 스트레치. 세로로 늘린 만큼 가로를 조금 줄여 부피가 유지되는 것처럼 보이게 한다. */
export function hopStretchScale(hop: CharacterHop, progress: number): HopScale {
  const amount = HOP_STRETCH_MAX * squashGate(hop.liftPx) * hopSpeedRatio(hop, progress);
  return { x: 1 - amount * 0.6, y: 1 + amount };
}

/** 착지 프레임의 눌림. 즉시 이 값으로 눌렀다가 HOP_SQUASH_MS 동안 원래대로 튀어 돌아온다. */
export function hopLandingSquashScale(hop: CharacterHop): HopScale {
  const amount = HOP_SQUASH_MAX * squashGate(hop.liftPx);
  return { x: 1 + amount * 0.7, y: 1 - amount };
}

/**
 * 원근 채널 — 공중에 있는 동안 스프라이트를 키운다.
 *
 * 왜 필요한가 (실측): 탑다운에서 "화면상 세로 이동" 은 북/남으로 걷는 것과 픽셀 변화가 같다.
 * 리프트만 있으면 8 칸 낙하가 "위쪽 타일에서 걸어 내려온다" 로 읽힌다 — 높이를 주장하는 신호가
 * 그림자(0.35→0.75) 하나뿐이기 때문이다. 크기 변화만이 "지면 위의 먼 곳" 과 "카메라에 가까운
 * 공중" 을 구분한다.
 *
 * 왜 정규화 리프트에 **선형** 인가: 핀홀 모델(D/(D−lift)) 은 ds/dlift 가 높은 곳에서 최대라
 * 성장분을 화면 밖에서 다 써버리고 착지 직전 구간에서는 크기가 거의 멈춘다. 리프트에 선형이면
 * 낙하 곡선의 등가속이 그대로 실려 초반엔 크게 유지되다 마지막 구간에서 1 로 빠르게 수축한다 —
 * 눈이 보고 있는 구간에서 변화가 일어난다.
 *
 * 발밑 앵커는 `hopOriginY` 가 scaleY 로 나누기 때문에 배율과 무관하게 유지된다. 즉 스프라이트는
 * **위로만** 커지고 접지선은 그대로다. p=1 에서 리프트가 정확히 0 이므로 배율도 정확히 1 로 닫힌다 —
 * 착지 스쿼시가 접지 크기에서 시작한다.
 */
export const HOP_PERSPECTIVE_MAX = 0.35;
/** 이 시작 높이에서 원근이 최대. 4 칸 — 제자리 홉(12px)은 6% 만 받아 줌 글리치로 보이지 않는다. */
const PERSPECTIVE_GATE_LIFT_PX = TILE_SIZE * 4;

function perspectiveGate(startLiftPx: number): number {
  return clampProgress(startLiftPx / PERSPECTIVE_GATE_LIFT_PX);
}

/** 이번 프레임의 원근 배율. 가로·세로가 같은 값이다 — 원근은 부피 보존이 아니라 거리다. */
export function hopPerspectiveScale(hop: CharacterHop, liftPx: number): HopScale {
  const startPx = clampHopLiftPx(hop.liftPx);
  if (startPx <= 0) return HOP_SCALE_NEUTRAL;
  const amount = HOP_PERSPECTIVE_MAX * perspectiveGate(startPx) * clampProgress(liftPx / startPx);
  return { x: 1 + amount, y: 1 + amount };
}

/**
 * 한 프레임의 체공 배율 — 스트레치(속도) × 원근(높이). 두 채널을 곱해 하나로 넘긴다.
 * 곱인 이유: 스트레치는 부피 보존(세로↑ 가로↓)이고 원근은 등방 확대라 서로 다른 축의 정보다.
 */
export function hopAirScale(hop: CharacterHop, progress: number): HopScale {
  const stretch = hopStretchScale(hop, progress);
  const perspective = hopPerspectiveScale(hop, characterHopLiftPx(hop, progress));
  return { x: stretch.x * perspective.x, y: stretch.y * perspective.y };
}

/**
 * 리프트를 원점 Y(정규화) 로 환산한다.
 *
 * 렌더 오프셋 = originY × height × scaleY 이므로, 기본(originY=1)의 발밑 앵커를 유지하면서
 * 월드 px 로 lift 만큼 더 올리려면 originY = 1 + lift / (height × scaleY) 다.
 * scaleY 로 나누는 것이 중요하다 — 저작 스케일이 걸린 이벤트 스프라이트에서 lift 가 곱해지면
 * 큰 보스만 더 높이 뜬다.
 */
export function hopOriginY(liftPx: number, spriteHeight: number, scaleY: number): number {
  const denominator = spriteHeight * scaleY;
  if (!Number.isFinite(denominator) || denominator <= 0) return 1;
  return 1 + clampHopLiftPx(liftPx) / denominator;
}

/**
 * 리프트를 받을 수 있는 스프라이트의 최소 계약. mockSprite 도 이 형태를 만족한다.
 * `setScale` 은 optional 이다 — 목 스프라이트에 없으면 스쿼시만 조용히 빠지고 리프트는 남는다.
 */
export type HopSprite = {
  readonly height?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  setOrigin(x: number, y: number): void;
  setScale?(x: number, y: number): void;
};

/**
 * 스케일을 기준 배율에 곱해서 얹는다. 기준을 곱하는 이유: 저작 스케일이 걸린 스프라이트에서
 * 절대값을 쓰면 스쿼시가 끝난 뒤 원래 크기를 잃는다.
 *
 * ⚠️ 리프트보다 **먼저** 불러야 한다 — `applyCharacterLift` 가 그 시점의 `scaleY` 로 원점을
 * 나누므로, 스케일을 나중에 바꾸면 리프트가 세로 배율만큼 어긋난다.
 */
export function applyHopScale(sprite: HopSprite | undefined, base: HopScale, scale: HopScale): void {
  if (!sprite?.setScale) return;
  sprite.setScale(base.x * scale.x, base.y * scale.y);
}

/** 스프라이트의 현재 배율 — 체공 시작 프레임에 기준으로 붙잡아 둘 값. */
export function hopBaseScaleOf(sprite: HopSprite | undefined): HopScale {
  const x = typeof sprite?.scaleX === "number" && sprite.scaleX !== 0 ? sprite.scaleX : 1;
  const y = typeof sprite?.scaleY === "number" && sprite.scaleY !== 0 ? sprite.scaleY : 1;
  return { x, y };
}

export function applyCharacterLift(sprite: HopSprite | undefined, liftPx: number): void {
  if (!sprite) return;
  const height = typeof sprite.height === "number" && sprite.height > 0 ? sprite.height : CHARSET_FRAME_HEIGHT;
  const scaleY = typeof sprite.scaleY === "number" && sprite.scaleY !== 0 ? sprite.scaleY : 1;
  sprite.setOrigin(0.5, hopOriginY(liftPx, height, scaleY));
}

/** 접지 복귀. 중단 경로(액션 전투 선딜/피격, 맵 전이, 이동 취소)에서 반드시 불러야 한다. */
export function clearCharacterLift(sprite: HopSprite | undefined): void {
  if (!sprite) return;
  sprite.setOrigin(0.5, 1);
}
