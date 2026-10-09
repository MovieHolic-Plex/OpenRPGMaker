/**
 * 겹치기(블렌드) 방식 — 이벤트 그림·그림 표시가 아래 화면과 섞이는 법.
 *
 * 왜 필요한가: SNES 의 반투명 색 연산(빛기둥·유령·마법 빛 번짐·그림자 드리우기)은 «더하기·곱하기»
 * 섞기다. 불투명도만으로는 빛이 밝아지지 않고(더하기), 어둠이 물들지 않는다(곱하기).
 *
 * - add(더하기): 밝은 곳이 더 밝아진다 — 불꽃·빛기둥·유령·마법진.
 * - screen(스크린): 더하기보다 부드럽게 밝힌다 — 안개 빛·반딧불.
 * - multiply(곱하기): 아래를 물들이며 어둡게 — 그림자·스테인드글라스 빛·핏빛.
 *
 * 생략 = normal. 저장은 normal 이 아닐 때만 한다(옛 JSON 바이트 유지).
 */
export const BLEND_MODE_NAMES = ["normal", "add", "screen", "multiply"] as const;
export type BlendModeName = (typeof BLEND_MODE_NAMES)[number];

export const BLEND_MODE_LABELS: Record<BlendModeName, string> = {
  normal: "보통",
  add: "더하기 (빛·불꽃·유령)",
  screen: "스크린 (부드러운 빛)",
  multiply: "곱하기 (그림자·물들임)",
};

export function isBlendModeName(value: unknown): value is BlendModeName {
  return typeof value === "string" && (BLEND_MODE_NAMES as readonly string[]).includes(value);
}

/** 저장용. normal·모르는 값은 생략(undefined). */
export function normalizeBlendMode(value: unknown): Exclude<BlendModeName, "normal"> | undefined {
  return isBlendModeName(value) && value !== "normal" ? value : undefined;
}

/** Phaser `BlendModes` 값(NORMAL 0 · ADD 1 · MULTIPLY 2 · SCREEN 3). WebGL·캔버스 둘 다 지원하는 넷만 쓴다. */
export function phaserBlendMode(name: BlendModeName | undefined): number {
  switch (name) {
    case "add":
      return 1;
    case "multiply":
      return 2;
    case "screen":
      return 3;
    default:
      return 0;
  }
}

/** CSS `mix-blend-mode`. 더하기는 `plus-lighter`(크로미움·사파리·파이어폭스 지원). */
export function cssMixBlendMode(name: BlendModeName | undefined): string {
  switch (name) {
    case "add":
      return "plus-lighter";
    case "multiply":
      return "multiply";
    case "screen":
      return "screen";
    default:
      return "normal";
  }
}
