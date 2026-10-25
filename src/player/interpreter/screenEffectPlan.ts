import { letterboxPercentFromValue } from "@/project/eventCommands/cinematicStaging";
import { DOOR_DEFAULT_MS, parseDoorValue, type DoorSpec } from "@/project/eventCommands/doorAnimation";
/**
 * 모던 `Screen Effect` 커맨드의 옵션을 **이미 존재하는 화면효과 경로**로 옮기는 매핑.
 *
 * 왜 필요한가: 예전에는 이 커맨드가 `runtime.screenEffects` 배열에 push 만 하고 끝났고,
 * 그 배열을 읽는 렌더러가 저장소에 없었다. 커맨드는 피커에 정상 노출되므로 감독은
 * 넣고 → 실행하고 → 화면은 그대로고 → 경고도 못 받았다(실측 픽셀 변화율 0.00%,
 * 같은 조건의 구식 Tint Screen 은 75.28%). 조용한 실패는 감독의 시간 중 가장 비싼
 * 종류를 먹는다.
 *
 * 새 렌더러를 만들지 않고 기존 두 경로에 얹는다:
 *   - 지속형(tint/fade) → `runtime.screen.tint` + `tintDurationMs` (DOM 오버레이가 rAF 트윈)
 *   - 일회형(flash)     → `flashScreen` StepResult (Phaser 카메라 API)
 *   - 날씨              → `runtime.screen.weather` (Phaser weather 레이어)
 *   - 왜곡(물결·모자이크·기울기) → `runtime.screen.distortion` (카메라 후처리)
 * 대응 경로가 없는 옵션은 조용히 삼키지 않고 `unsupported` 로 돌려 fallback 에 기록한다.
 */

/** 페이드아웃이 도달하는 색 — 불투명 검정. tintModel 의 "r,g,b,a" 형식. */
const FADE_OUT_TINT = "0,0,0,1";
/** 페이드인이 도달하는 색 — 투명. tintModel 이 "none" 을 TRANSPARENT_TINT 로 읽는다. */
const FADE_IN_TINT = "none";

export type ScreenEffectPlan =
  | {
      readonly kind: "tint";
      readonly tint: string;
      readonly tintDurationMs: number;
      /** 화면 숨김 상태를 풀어야 하는가(페이드인). */
      readonly unhide: boolean;
    }
  | { readonly kind: "flash"; readonly color: string; readonly durationMs: number }
  | { readonly kind: "weather"; readonly weather: string }
  | {
      readonly kind: "distortion";
      readonly effect: "wave" | "mosaic" | "rotate" | "clearDistortion";
      readonly value: string;
      readonly durationMs: number;
    }
  /** 위아래 검은 띠. percent = 띠 하나의 두께(화면 높이 %), 0 = 걷기. */
  | { readonly kind: "letterbox"; readonly percent: number; readonly durationMs: number }
  /** 타일 그림 문을 열고 닫는다(playSceneDoors 가 그 칸 타일을 복사한 문짝을 움직인다). */
  | { readonly kind: "door"; readonly door: DoorSpec; readonly open: boolean; readonly durationMs: number }
  /** 정지 화면(만화식 «프리즈 프레임») — 지금 필드 그림을 한 장 찍어 그 위에 세운다. style = none·mono·sepia·warm·cool. on false = 풀기. */
  | { readonly kind: "freeze"; readonly on: boolean; readonly style: FreezeStyle; readonly durationMs: number }
  | { readonly kind: "unsupported"; readonly effect: string };

export const FREEZE_STYLES = ["none", "mono", "sepia", "warm", "cool"] as const;
export type FreezeStyle = (typeof FREEZE_STYLES)[number];
export function normalizeFreezeStyle(value: unknown): FreezeStyle {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (FREEZE_STYLES as readonly string[]).includes(v) ? (v as FreezeStyle) : v === "" ? "warm" : "none";
}

/**
 * `Screen Effect` 필드 3개를 실행 계획으로 바꾼다.
 *
 * @param effect 카탈로그의 select 값 — fadeIn/fadeOut/flash/tint/blur/weather
 * @param value  효과별 보조값(색 hex, 날씨 문자열 등). 비어 있을 수 있다.
 * @param durationMs 전환 시간
 */
export function planScreenEffect(effect: string, value: string, durationMs: number): ScreenEffectPlan {
  const duration = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
  const trimmed = value.trim();

  switch (effect) {
    case "fadeOut":
      return { kind: "tint", tint: FADE_OUT_TINT, tintDurationMs: duration, unhide: false };
    case "fadeIn":
      // 페이드인은 "검게 덮인 상태에서 걷어낸다" 는 뜻이라 숨김도 함께 푼다.
      // 안 풀면 hidden 이 tint 보다 우선이라(playSceneScreenEffects) 영원히 검은 화면이 된다.
      return { kind: "tint", tint: FADE_IN_TINT, tintDurationMs: duration, unhide: true };
    case "tint":
      // 값이 비면 색조를 지우는 뜻으로 읽는다 — 구식 Tint Screen 의 neutral 과 같은 의미.
      return { kind: "tint", tint: trimmed || "neutral", tintDurationMs: duration, unhide: false };
    case "flash":
      return { kind: "flash", color: trimmed || "white", durationMs: duration };
    case "weather":
      return { kind: "weather", weather: trimmed || "none" };
    // 화면 그림 자체를 비트는 지속형 효과 — 카메라 후처리(playSceneScreenDistortion)가 그린다.
    case "wave":
    case "mosaic":
    case "rotate":
    case "clearDistortion":
      return { kind: "distortion", effect, value: trimmed, durationMs: duration };
    case "letterbox":
      return { kind: "letterbox", percent: letterboxPercentFromValue(trimmed), durationMs: duration };
    case "clearLetterbox":
      return { kind: "letterbox", percent: 0, durationMs: duration };
    case "freeze":
      return { kind: "freeze", on: true, style: normalizeFreezeStyle(trimmed), durationMs: duration };
    case "unfreeze":
      return { kind: "freeze", on: false, style: "none", durationMs: duration };
    case "doorOpen":
    case "doorClose": {
      const door = parseDoorValue(trimmed);
      if (!door) return { kind: "unsupported", effect };
      return { kind: "door", door, open: effect === "doorOpen", durationMs: Number.isFinite(durationMs) && durationMs > 0 ? duration : DOOR_DEFAULT_MS };
    }
    default:
      // blur 등 렌더러가 없는 옵션. 삼키지 말고 기록해서 감독이 알 수 있게 한다.
      return { kind: "unsupported", effect };
  }
}
