/**
 * 체공 그림자 — 떠 있는 캐릭터의 발밑에 지면 타원을 깔아 높이를 읽게 한다.
 *
 * 설계 결정 세 가지:
 * 1. **체공 중에만 보인다.** 항상 켜진 그림자는 모든 캐릭터의 실루엣을 바꿔서 기존 픽셀
 *    스냅샷과 저작 의도를 전부 흔든다. 점프·낙하 중에만 나타나면 "떴다" 라는 정보만 준다.
 * 2. **텍스처를 런타임에 그린다.** PNG 를 넣으면 `gen-effect-sheets` 카탈로그 + DB 레코드 +
 *    에셋 검사까지 3중 관문을 통과해야 한다. 타원 하나는 캔버스로 그리는 게 싸다.
 * 3. **depth 는 빈 밴드(0..100,000) 를 쓴다.** below 캐릭터(100,000+)보다 낮고 타일 레이어보다
 *    높다. 안에서 접지 y 로 다시 정렬해 아래쪽 그림자가 위쪽 그림자를 덮는다.
 *    ⚠️ 루트 디스플레이 리스트에 붙인다 — `tileLayer` 는 Container 라 자식 depth 가
 *    컨테이너 내부에서만 유효하다.
 */

import { TILE_SIZE } from "@/assets/bundled";

export const CHARACTER_SHADOW_TEXTURE_KEY = "__rpg_zzu_character_shadow";
const SHADOW_TEXTURE_WIDTH = 32;
const SHADOW_TEXTURE_HEIGHT = 16;
/** below 밴드(100,000) 아래의 빈 구간. 여기서 접지 y 로 재정렬한다. */
export const CHARACTER_SHADOW_DEPTH_BASE = 50_000;

/** 접지 시(리프트 0) 그림자 지름 대 타일 비율. */
const SHADOW_BASE_SCALE = 0.75;
/**
 * 기준 높이를 안 주면 그림자가 최소 크기까지 줄어드는 높이. 제자리 홉(12px)의 기본값이다.
 *
 * ⚠️ 이 값을 그대로 **낙하**에 쓰면 정보가 죽는다(실측): 기본 낙하 128px 에서 리프트가 32px
 * 안으로 들어오는 건 마지막 13% 구간(620ms 중 83ms)뿐이라, 나머지 87% 동안 그림자가 최소
 * 크기·최소 알파에 붙어 있어 "다가온다" 를 전혀 못 준다. 그래서 호출부가 그 체공의 **시작
 * 높이**를 기준으로 넘겨 전 구간에서 자라게 한다.
 */
const SHADOW_FADE_LIFT_PX = TILE_SIZE * 2;
const SHADOW_MIN_SCALE = 0.35;
const SHADOW_MAX_ALPHA = 0.4;
const SHADOW_MIN_ALPHA = 0.12;

export type ShadowImage = {
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
  setPosition(x: number, y: number): void;
  setScale(x: number, y?: number): void;
  setAlpha(alpha: number): void;
  setVisible(visible: boolean): void;
  destroy(): void;
};

/** 그림자 풀만 들고 있는 최소 계약. 정리(숨김/파괴) 는 텍스처·팩토리가 필요 없다. */
export type ShadowPoolHolder = {
  characterShadows?: Map<string, ShadowImage>;
};

export type ShadowSceneContext = ShadowPoolHolder & {
  readonly textures: {
    exists(key: string): boolean;
    /** **완성된** 캔버스를 넘긴다 — 아래 installCharacterShadowTexture 의 주석 참고. */
    addCanvas(key: string, source: HTMLCanvasElement): unknown;
  };
  readonly add: { image(x: number, y: number, key: string): ShadowImage };
};

/**
 * 부드러운 검정 타원 하나를 텍스처로 등록한다.
 *
 * ⚠️ `textures.createCanvas()` 로 빈 텍스처를 만들고 나중에 그린 뒤 `refresh()` 하는 방식은
 * **이 런타임에서 화면에 아무것도 나오지 않는다**(2026-08-29 실측: 오브젝트는 depth·alpha·
 * visible 이 모두 정상이고 카메라 안에 있는데 픽셀이 없었다. 같은 자리에 기존 텍스처 키로
 * 이미지를 만들면 정상 렌더 — 즉 빈 캔버스로 만든 GL 텍스처가 갱신되지 않는다).
 * 그래서 **떼어낸 캔버스에 먼저 다 그리고**, 완성된 캔버스를 `addCanvas` 로 넘긴다.
 */
export function installCharacterShadowTexture(scene: ShadowSceneContext): void {
  if (scene.textures.exists(CHARACTER_SHADOW_TEXTURE_KEY)) return;
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.width = SHADOW_TEXTURE_WIDTH;
  canvas.height = SHADOW_TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const centerX = SHADOW_TEXTURE_WIDTH / 2;
  const centerY = SHADOW_TEXTURE_HEIGHT / 2;
  ctx.save();
  ctx.translate(centerX, centerY);
  // 원형 그라디언트를 세로로 눌러 타원으로 만든다 — 톱뷰의 지면 그림자 모양.
  ctx.scale(1, SHADOW_TEXTURE_HEIGHT / SHADOW_TEXTURE_WIDTH);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerX);
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.6, "rgba(0, 0, 0, 0.75)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, centerX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  scene.textures.addCanvas(CHARACTER_SHADOW_TEXTURE_KEY, canvas);
}

/**
 * 리프트를 0..1 로 정규화한다. `referenceLiftPx` 는 그 체공의 시작 높이(=최고점) 이고,
 * 하한을 기본 페이드 범위로 둔다 — 짧은 홉에서 기존 곡선과 값이 같게 유지된다.
 */
function shadowLiftRatio(liftPx: number, referenceLiftPx?: number): number {
  const reference = Number.isFinite(referenceLiftPx) ? Math.max(SHADOW_FADE_LIFT_PX, referenceLiftPx as number) : SHADOW_FADE_LIFT_PX;
  return Math.max(0, Math.min(1, liftPx / reference));
}

/** 높이가 커지면 그림자는 작고 옅어진다. 순수 함수라 단위 테스트로 곡선을 잠근다. */
export function shadowScaleForLift(liftPx: number, referenceLiftPx?: number): number {
  const t = shadowLiftRatio(liftPx, referenceLiftPx);
  return SHADOW_BASE_SCALE + (SHADOW_MIN_SCALE - SHADOW_BASE_SCALE) * t;
}

export function shadowAlphaForLift(liftPx: number, referenceLiftPx?: number): number {
  const t = shadowLiftRatio(liftPx, referenceLiftPx);
  return SHADOW_MAX_ALPHA + (SHADOW_MIN_ALPHA - SHADOW_MAX_ALPHA) * t;
}

/**
 * 그림자 하나를 접지점에 맞춘다. `groundX`/`groundY` 는 **스프라이트 좌표 그대로** —
 * 리프트가 원점 채널에 있으므로 스프라이트 x/y 가 이미 접지점이다.
 */
export function syncCharacterShadow(
  scene: ShadowSceneContext,
  key: string,
  groundX: number,
  groundY: number,
  liftPx: number,
  referenceLiftPx?: number
): void {
  if (liftPx <= 0) {
    hideCharacterShadow(scene, key);
    return;
  }
  installCharacterShadowTexture(scene);
  scene.characterShadows ??= new Map();
  let shadow = scene.characterShadows.get(key);
  if (!shadow) {
    shadow = scene.add.image(groundX, groundY, CHARACTER_SHADOW_TEXTURE_KEY);
    shadow.setOrigin(0.5, 0.5);
    scene.characterShadows.set(key, shadow);
  }
  const scale = shadowScaleForLift(liftPx, referenceLiftPx);
  shadow.setPosition(groundX, groundY - SHADOW_TEXTURE_HEIGHT * scale * 0.5);
  shadow.setScale(scale, scale);
  shadow.setAlpha(shadowAlphaForLift(liftPx, referenceLiftPx));
  shadow.setDepth(CHARACTER_SHADOW_DEPTH_BASE + groundY);
  shadow.setVisible(true);
}

export function hideCharacterShadow(scene: ShadowPoolHolder, key: string): void {
  scene.characterShadows?.get(key)?.setVisible(false);
}

export function destroyCharacterShadow(scene: ShadowPoolHolder, key: string): void {
  const shadow = scene.characterShadows?.get(key);
  if (!shadow) return;
  shadow.destroy();
  scene.characterShadows?.delete(key);
}

/** 맵 전이·런타임 리셋. 스프라이트 풀과 함께 반드시 비운다. */
export function destroyAllCharacterShadows(scene: ShadowPoolHolder): void {
  if (!scene.characterShadows) return;
  for (const shadow of scene.characterShadows.values()) shadow.destroy();
  scene.characterShadows.clear();
}
