/**
 * 전투 결과 팡파레 설정 — 레벨 업 배너·능력치 판·「새 기술 습득!」 카드·「새 연계기!」 카드의 켜기/끄기와 연출 세기(2026-10-24).
 *
 * `system.battleFanfare` 로 저장한다. 기본값(전부 켜기 · burst · 소리 켜기)은 저장하지 않는다 — 옛 JSON 바이트 그대로.
 * 자료집 「시스템 → 전투 화면」과 조수 `set_project_settings`(battle.fanfare) 가 같은 정규화를 쓴다.
 */
export type BattleFanfareStyle = "burst" | "classic" | "minimal";

export const BATTLE_FANFARE_STYLES: readonly BattleFanfareStyle[] = ["burst", "classic", "minimal"];

export const BATTLE_FANFARE_STYLE_LABELS: Readonly<Record<BattleFanfareStyle, string>> = {
  burst: "화려하게(빛줄기·파티클)",
  classic: "고전(창만 크게)",
  minimal: "간단히(창만)",
};

export interface BattleFanfareSettings {
  /** 레벨 업 배너·능력치 판. 생략 = 켜기. */
  readonly levelUp?: boolean;
  /** 「새 기술 습득!」 카드(레벨 업으로 배운 기술마다 한 장). 생략 = 켜기. */
  readonly skillLearned?: boolean;
  /** 「새 연계기!」 카드(배운 기술로 연계기 조건이 채워졌을 때). 생략 = 켜기. */
  readonly comboUnlocked?: boolean;
  /** 생략 = burst. */
  readonly style?: BattleFanfareStyle;
  /** 팡파레 효과음. 생략 = 켜기. */
  readonly sound?: boolean;
}

export interface ResolvedBattleFanfare {
  readonly levelUp: boolean;
  readonly skillLearned: boolean;
  readonly comboUnlocked: boolean;
  readonly style: BattleFanfareStyle;
  readonly sound: boolean;
}

export function isBattleFanfareStyle(value: unknown): value is BattleFanfareStyle {
  return typeof value === "string" && (BATTLE_FANFARE_STYLES as readonly string[]).includes(value);
}

/** 기본값과 다른 칸만 남긴다. 남는 칸이 없으면 undefined(저장하지 않는다). */
export function normalizeBattleFanfare(value: unknown): BattleFanfareSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const out: { -readonly [K in keyof BattleFanfareSettings]: BattleFanfareSettings[K] } = {};
  if (raw.levelUp === false) out.levelUp = false;
  if (raw.skillLearned === false) out.skillLearned = false;
  if (raw.comboUnlocked === false) out.comboUnlocked = false;
  if (isBattleFanfareStyle(raw.style) && raw.style !== "burst") out.style = raw.style;
  if (raw.sound === false) out.sound = false;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function resolveBattleFanfare(value: BattleFanfareSettings | undefined): ResolvedBattleFanfare {
  return {
    levelUp: value?.levelUp !== false,
    skillLearned: value?.skillLearned !== false,
    comboUnlocked: value?.comboUnlocked !== false,
    style: isBattleFanfareStyle(value?.style) ? value!.style! : "burst",
    sound: value?.sound !== false,
  };
}
