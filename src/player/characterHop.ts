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
 * 낙하 — 등가속(중력). height*(1-p²) 는 p=0 에서 height, p=1 에서 0 이고
 * 도함수가 -2·height·p 라 시작 속도 0 에서 선형으로 빨라진다.
 */
export function fallLiftPx(progress: number, heightPx: number): number {
  const p = clampProgress(progress);
  return clampHopLiftPx(heightPx) * (1 - p * p);
}

export function characterHopLiftPx(hop: CharacterHop, progress: number): number {
  return hop.kind === "fall" ? fallLiftPx(progress, hop.liftPx) : jumpArcLiftPx(progress, hop.liftPx);
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

/** 리프트를 받을 수 있는 스프라이트의 최소 계약. mockSprite 도 이 형태를 만족한다. */
export type HopSprite = {
  readonly height?: number;
  readonly scaleY?: number;
  setOrigin(x: number, y: number): void;
};

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
