/**
 * 화면 왜곡(물결·모자이크·기울기) — 이벤트 명령 「화면 효과」 의 지속형 옵션.
 *
 * 왜 필요한가: SNES 연출의 상당수가 화면 그림 자체를 비튼다 — 수중·아지랑이·꿈의 물결(HDMA 줄 단위
 * 가로 흔들림), 장면 전환의 모자이크, 시간 왜곡의 화면 기울기. 색조·플래시·색 필터는 화면 **위에**
 * 덮는 층이라 이걸 못 낸다. 그래서 Phaser 카메라 후처리(픽셀화 FX·물결 셰이더·카메라 회전)로 그린다.
 *
 * 값은 셋 다 «세기» 다. 0 이 꺼짐이고, 셋은 서로 독립이라 겹쳐 걸 수 있다. 상태는 세션
 * (`m2Runtime.screen.distortion`)에 남아 세이브·맵 이동 뒤에도 유지된다 — 끄려면 명시적으로 끈다.
 */
export type ScreenDistortion = {
  /** 물결 진폭(게임 px). 줄마다 가로로 흔들린다. */
  readonly wave: number;
  /** 모자이크 블록 크기(게임 px). 1 이하면 꺼짐. */
  readonly mosaic: number;
  /** 화면 기울기(도). 음수 = 반시계. */
  readonly rotate: number;
};

export type ScreenDistortionKey = keyof ScreenDistortion;

export const NEUTRAL_SCREEN_DISTORTION: ScreenDistortion = { wave: 0, mosaic: 0, rotate: 0 };

export const SCREEN_DISTORTION_LIMITS = {
  wave: { min: 0, max: 16 },
  mosaic: { min: 0, max: 32 },
  rotate: { min: -180, max: 180 },
} as const;

/** 값을 비워 두었을 때 쓰는 세기 — 「물결」 만 고르고 숫자를 안 넣어도 바로 보이게. */
export const SCREEN_DISTORTION_DEFAULTS: ScreenDistortion = { wave: 4, mosaic: 8, rotate: 8 };

function clamp(value: unknown, key: ScreenDistortionKey): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return 0;
  const { min, max } = SCREEN_DISTORTION_LIMITS[key];
  return Math.max(min, Math.min(max, numeric));
}

export function normalizeScreenDistortion(value: Partial<Record<ScreenDistortionKey, unknown>> | undefined): ScreenDistortion {
  return { wave: clamp(value?.wave, "wave"), mosaic: clamp(value?.mosaic, "mosaic"), rotate: clamp(value?.rotate, "rotate") };
}

export function isNeutralScreenDistortion(value: ScreenDistortion | undefined): boolean {
  return !value || (value.wave === 0 && value.mosaic <= 1 && value.rotate === 0);
}

export function screenDistortionsEqual(a: ScreenDistortion, b: ScreenDistortion): boolean {
  return a.wave === b.wave && a.mosaic === b.mosaic && a.rotate === b.rotate;
}

/**
 * 「화면 효과」 옵션 하나를 적용한 다음 상태. `effect` 가 wave·mosaic·rotate 면 그 축만 바꾸고,
 * clearDistortion 이면 전부 끈다. 값 문자열이 비면 기본 세기, 숫자면 그 세기(0 = 그 축만 끄기).
 */
export function nextScreenDistortion(
  current: ScreenDistortion | undefined,
  effect: "wave" | "mosaic" | "rotate" | "clearDistortion",
  value: string,
): ScreenDistortion {
  if (effect === "clearDistortion") return NEUTRAL_SCREEN_DISTORTION;
  const base = normalizeScreenDistortion(current);
  const amount = value.trim() === "" ? SCREEN_DISTORTION_DEFAULTS[effect] : clamp(value, effect);
  return { ...base, [effect]: amount };
}

/** 전환 보간. 끝점 사이를 천천히 출발·멈춤 곡선으로 잇는다 — 물결이 «툭» 켜지지 않고 차오른다. */
export function interpolateScreenDistortion(from: ScreenDistortion, to: ScreenDistortion, t: number): ScreenDistortion {
  const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 1));
  const eased = -(Math.cos(Math.PI * x) - 1) / 2;
  const lerp = (a: number, b: number): number => a + (b - a) * eased;
  return { wave: lerp(from.wave, to.wave), mosaic: lerp(from.mosaic, to.mosaic), rotate: lerp(from.rotate, to.rotate) };
}
