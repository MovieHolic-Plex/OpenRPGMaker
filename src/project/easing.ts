/**
 * 연출 이징 — 그림 이동·카메라 팬이 같은 이름과 같은 곡선을 쓴다.
 *
 * 왜 필요한가: 연출 트윈이 전부 선형이라 그림이 «미끄러지듯» 멈추지 않고 벽에 부딪히듯 선다.
 * SNES 시네마틱(크로노 트리거 오프닝의 카메라, FF6 의 그림 슬라이드)은 가감속으로 무게를 준다.
 *
 * 생략 = linear 다 — 저장된 옛 명령의 움직임이 바뀌지 않는다. 곡선 정본은 {@link applyEasing} 이고,
 * Phaser 카메라 팬은 같은 곡선의 Phaser 이름({@link phaserEaseName})을 쓴다.
 */
export const EASING_NAMES = ["linear", "easeIn", "easeOut", "easeInOut"] as const;
export type EasingName = (typeof EASING_NAMES)[number];

export const EASING_LABELS: Record<EasingName, string> = {
  linear: "일정하게",
  easeIn: "천천히 출발",
  easeOut: "천천히 멈춤",
  easeInOut: "천천히 출발·멈춤",
};

export function isEasingName(value: unknown): value is EasingName {
  return typeof value === "string" && (EASING_NAMES as readonly string[]).includes(value);
}

/** 저장용 정리. linear 와 모르는 값은 생략(= 키 제거) — 옛 JSON 바이트를 유지한다. */
export function normalizeEasing(value: unknown): EasingName | undefined {
  return isEasingName(value) && value !== "linear" ? value : undefined;
}

/** 진행도 t(0~1) → 이징된 진행도. 범위 밖 t 는 끝값으로 클램프한다. */
export function applyEasing(name: EasingName | undefined, t: number): number {
  const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 1));
  switch (name) {
    case "easeIn":
      return x * x;
    case "easeOut":
      return 1 - (1 - x) * (1 - x);
    case "easeInOut":
      return -(Math.cos(Math.PI * x) - 1) / 2;
    default:
      return x;
  }
}

/** Phaser 트윈/카메라 이름. 곡선은 {@link applyEasing} 과 같다(Quad·Sine). */
export function phaserEaseName(name: EasingName | undefined): string {
  switch (name) {
    case "easeIn":
      return "Quad.easeIn";
    case "easeOut":
      return "Quad.easeOut";
    case "easeInOut":
      return "Sine.easeInOut";
    default:
      return "Linear";
  }
}
