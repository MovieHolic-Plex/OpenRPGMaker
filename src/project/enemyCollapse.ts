/**
 * 적이 쓰러지는 연출(EnemyRecord.collapseEffect). 생략 = "dissolve"(스킨 기본 소멸 — 기존 그대로).
 *
 * - pixelBreak: FF6 식. 몸이 보랏빛으로 물들고 위에서부터 픽셀 덩이로 부서져 사라진다.
 * - bossSink: 보스 식. 몸이 떨며 붉게 깜빡이고, 줄마다 일렁이며 땅속으로 천천히 가라앉는다.
 * - flash: RM2000 식. 하얗게 세 번 깜빡인 뒤 꺼진다.
 * - instant: 즉시 사라진다(소환수 해제·환영).
 *
 * 그림은 런타임이 쓰러지는 순간의 스프라이트를 캔버스에 떠서 그린다(battleEnemyCollapse.ts) — 스킨 CSS 와 무관하다.
 */
export const ENEMY_COLLAPSE_EFFECTS = ["dissolve", "pixelBreak", "bossSink", "flash", "instant"] as const;
export type EnemyCollapseEffect = (typeof ENEMY_COLLAPSE_EFFECTS)[number];

export const ENEMY_COLLAPSE_LABELS: Record<EnemyCollapseEffect, string> = {
  dissolve: "기본 소멸",
  pixelBreak: "픽셀 분해 (FF6)",
  bossSink: "보스 가라앉기",
  flash: "하얀 점멸",
  instant: "즉시 사라짐",
};

/** 연출 길이(ms). 시퀀서의 격파 대사(660ms)보다 긴 것은 결과 화면과 겹쳐도 끝까지 그린다. */
export const ENEMY_COLLAPSE_DURATION_MS: Record<Exclude<EnemyCollapseEffect, "dissolve">, number> = {
  pixelBreak: 900,
  bossSink: 1800,
  flash: 560,
  instant: 0,
};

export function isEnemyCollapseEffect(value: unknown): value is EnemyCollapseEffect {
  return typeof value === "string" && (ENEMY_COLLAPSE_EFFECTS as readonly string[]).includes(value);
}

/** 저장용. 기본(dissolve)·모르는 값은 생략. */
export function normalizeEnemyCollapseEffect(value: unknown): Exclude<EnemyCollapseEffect, "dissolve"> | undefined {
  return isEnemyCollapseEffect(value) && value !== "dissolve" ? value : undefined;
}
