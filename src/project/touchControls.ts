// project/touchControls.ts
// 휴대폰·태블릿 조작(터치 UI)의 저작 설정(system.touchControls)과 기본값(2026-10-24 모바일 조작감).
//
// 터치 UI 는 기기 판정(isTouchDevice)을 통과한 화면에서만 켜진다 — 데스크톱 플레이는 이 값을 읽지 않는다.
// 생략한 칸은 기본값이다(모두 켬 + 조이스틱 auto). 기본과 같은 값은 저장하지 않는다(옛 JSON 바이트 유지).
// 플레이어 기기 설정(playerPreferences)이 있으면 그쪽이 이긴다: 기기 설정 > 저작 값 > 기본값.

/**
 * - `auto`: 조이스틱 판 위·바로 곁을 누르면 판 중심 기준으로 곧장 방향이 나가고, 판에서 먼 곳을 누르면 그 자리가 중심이 된다(떠다님).
 * - `fixed`: 판은 움직이지 않는다. 조작 영역 어디를 눌러도 판 중심 기준 방향.
 * - `floating`: 누른 자리가 늘 중심이다(엄지를 내려놓고 밀어야 방향이 나간다).
 */
export type TouchStickMode = "auto" | "fixed" | "floating";

export const TOUCH_STICK_MODES: readonly TouchStickMode[] = ["auto", "fixed", "floating"];

export interface TouchControlSettings {
  /** 맵을 탭하면 그 칸까지 길을 찾아 걷고, 사람·물건을 탭하면 곁으로 가서 말을 건다. 생략 = 켬. */
  readonly tapToMove?: boolean;
  /** 조이스틱 방식. 생략 = auto. */
  readonly stick?: TouchStickMode;
  /** 단추·방향이 바뀔 때 짧은 진동(지원 기기만 — 안드로이드 크롬 등. iOS 사파리는 진동 API 가 없다). 생략 = 켬. */
  readonly haptics?: boolean;
  /** 달리기 단추를 패드에 둔다(누를 때마다 걷기/달리기). 생략 = 켬. */
  readonly runButton?: boolean;
}

export interface ResolvedTouchControls {
  readonly tapToMove: boolean;
  readonly stick: TouchStickMode;
  readonly haptics: boolean;
  readonly runButton: boolean;
}

export const DEFAULT_TOUCH_CONTROLS: ResolvedTouchControls = { tapToMove: true, stick: "auto", haptics: true, runButton: true };

export function isTouchStickMode(value: unknown): value is TouchStickMode {
  return value === "auto" || value === "fixed" || value === "floating";
}

/** 저장용: 모르는 칸·기본과 같은 칸을 지운다. 남는 것이 없으면 undefined(필드 자체를 지운다). */
export function normalizeTouchControls(value: unknown): TouchControlSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const out: { tapToMove?: boolean; stick?: TouchStickMode; haptics?: boolean; runButton?: boolean } = {};
  if (input.tapToMove === false) out.tapToMove = false;
  if (isTouchStickMode(input.stick) && input.stick !== DEFAULT_TOUCH_CONTROLS.stick) out.stick = input.stick;
  if (input.haptics === false) out.haptics = false;
  if (input.runButton === false) out.runButton = false;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 기기 설정(플레이어가 옵션에서 고른 값) > 저작 값 > 기본값. */
export function resolveTouchControls(
  authored: TouchControlSettings | undefined,
  device: Partial<ResolvedTouchControls> = {},
): ResolvedTouchControls {
  return {
    tapToMove: device.tapToMove ?? authored?.tapToMove ?? DEFAULT_TOUCH_CONTROLS.tapToMove,
    stick: device.stick ?? (isTouchStickMode(authored?.stick) ? authored.stick : DEFAULT_TOUCH_CONTROLS.stick),
    haptics: device.haptics ?? authored?.haptics ?? DEFAULT_TOUCH_CONTROLS.haptics,
    runButton: authored?.runButton ?? DEFAULT_TOUCH_CONTROLS.runButton,
  };
}
