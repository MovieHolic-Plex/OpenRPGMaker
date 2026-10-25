/**
 * 전투 연출 설정(2026-10-25, fs-battle-3) — 적이 달려드는 속도 · 연계기 컷인(얼굴 교차) · 연계기 화려함 · 기술 한 줄 도움말 · 약점 공개.
 *
 * 사용자(폴른 스타 시연): 「늑대가 고블린보다 느리네 — 빠른 것을 기준으로」「연계기 할 때 서로의 얼굴이 교차하는 느낌으로」
 * 「연계기는 좀 더 화려해야」「기술 도움말은 '카엘은 무엇을 할까?' 자리에 1줄로 짧게」.
 *
 * `system.battleStaging` 으로 저장한다. 기본값은 저장하지 않는다 — 옛 JSON 바이트 그대로.
 * 자료집 「시스템 → 전투 화면」과 조수 `set_project_settings`(battle.staging) 가 같은 정규화를 쓴다.
 * 적 하나의 속도는 EnemyRecord.lungeSpeedPercent, 연계기 하나의 색·흔들림·느린 화면은 SkillRecord.comboStaging.
 */
export type BattleEnemyLunge = "fast" | "normal" | "classic";
export type BattleComboCutIn = "faces" | "band" | "off";
export type BattleComboFx = "spectacular" | "simple";
export type BattleSkillHint = "line" | "window";
/** 적 약점·저항을 대상 고르기에서 보이는가 — 약점은 플레이어가 알아 가는 것(src/battle/weaknessDiscovery.ts). */
export type BattleRevealWeakness = "never" | "afterDiscovery" | "always";

export const BATTLE_ENEMY_LUNGES: readonly BattleEnemyLunge[] = ["fast", "normal", "classic"];
export const BATTLE_COMBO_CUT_INS: readonly BattleComboCutIn[] = ["faces", "band", "off"];
export const BATTLE_COMBO_FXS: readonly BattleComboFx[] = ["spectacular", "simple"];
export const BATTLE_SKILL_HINTS: readonly BattleSkillHint[] = ["line", "window"];
export const BATTLE_REVEAL_WEAKNESSES: readonly BattleRevealWeakness[] = ["never", "afterDiscovery", "always"];

export const BATTLE_ENEMY_LUNGE_LABELS: Readonly<Record<BattleEnemyLunge, string>> = {
  fast: "빠르게(사람 적 걸음이 기준, 짐승은 더 빠르게)",
  normal: "보통",
  classic: "느긋하게(예전 도트 괴물 속도)",
};
export const BATTLE_COMBO_CUT_IN_LABELS: Readonly<Record<BattleComboCutIn, string>> = {
  faces: "얼굴 교차(참가자 흉상이 양쪽에서 엇갈림)",
  band: "띠만(이름 띠)",
  off: "없음",
};
export const BATTLE_COMBO_FX_LABELS: Readonly<Record<BattleComboFx, string>> = {
  spectacular: "화려하게(번쩍임·확대·흔들림·느린 화면·피해 숫자 폭발)",
  simple: "간단히(번쩍임만)",
};
export const BATTLE_SKILL_HINT_LABELS: Readonly<Record<BattleSkillHint, string>> = {
  line: "한 줄(질문 줄 자리에 비용·대상·속성·특징)",
  window: "도움말 창(긴 설명)",
};

export const BATTLE_REVEAL_WEAKNESS_LABELS: Readonly<Record<BattleRevealWeakness, string>> = {
  never: "안 보임(맞혀 본 순간의 「약점!」만)",
  afterDiscovery: "알아낸 뒤에만(처음 맞힌 「약점 발견!」 뒤로 대상 고를 때 표시)",
  always: "처음부터(대상 고를 때 늘 표시)",
};

export interface BattleStagingSettings {
  /** 생략 = fast. */
  readonly enemyLunge?: BattleEnemyLunge;
  /** 생략 = faces. */
  readonly comboCutIn?: BattleComboCutIn;
  /** 생략 = spectacular. */
  readonly comboFx?: BattleComboFx;
  /** 생략 = line. */
  readonly skillHint?: BattleSkillHint;
  /** 생략 = afterDiscovery. */
  readonly revealWeakness?: BattleRevealWeakness;
}

export interface ResolvedBattleStaging {
  readonly enemyLunge: BattleEnemyLunge;
  readonly comboCutIn: BattleComboCutIn;
  readonly comboFx: BattleComboFx;
  readonly skillHint: BattleSkillHint;
  readonly revealWeakness: BattleRevealWeakness;
}

const DEFAULTS: ResolvedBattleStaging = { enemyLunge: "fast", comboCutIn: "faces", comboFx: "spectacular", skillHint: "line", revealWeakness: "afterDiscovery" };

const pick = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;

/** 기본값과 다른 칸만 남긴다. 남는 칸이 없으면 undefined(저장하지 않는다). */
export function normalizeBattleStaging(value: unknown): BattleStagingSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const out: { -readonly [K in keyof BattleStagingSettings]: BattleStagingSettings[K] } = {};
  const lunge = pick(BATTLE_ENEMY_LUNGES, raw.enemyLunge);
  if (lunge && lunge !== DEFAULTS.enemyLunge) out.enemyLunge = lunge;
  const cutIn = pick(BATTLE_COMBO_CUT_INS, raw.comboCutIn);
  if (cutIn && cutIn !== DEFAULTS.comboCutIn) out.comboCutIn = cutIn;
  const fx = pick(BATTLE_COMBO_FXS, raw.comboFx);
  if (fx && fx !== DEFAULTS.comboFx) out.comboFx = fx;
  const hint = pick(BATTLE_SKILL_HINTS, raw.skillHint);
  if (hint && hint !== DEFAULTS.skillHint) out.skillHint = hint;
  const reveal = pick(BATTLE_REVEAL_WEAKNESSES, raw.revealWeakness);
  if (reveal && reveal !== DEFAULTS.revealWeakness) out.revealWeakness = reveal;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function resolveBattleStaging(value: BattleStagingSettings | undefined): ResolvedBattleStaging {
  return {
    enemyLunge: pick(BATTLE_ENEMY_LUNGES, value?.enemyLunge) ?? DEFAULTS.enemyLunge,
    comboCutIn: pick(BATTLE_COMBO_CUT_INS, value?.comboCutIn) ?? DEFAULTS.comboCutIn,
    comboFx: pick(BATTLE_COMBO_FXS, value?.comboFx) ?? DEFAULTS.comboFx,
    skillHint: pick(BATTLE_SKILL_HINTS, value?.skillHint) ?? DEFAULTS.skillHint,
    revealWeakness: pick(BATTLE_REVEAL_WEAKNESSES, value?.revealWeakness) ?? DEFAULTS.revealWeakness,
  };
}

// ── 연계기 하나의 연출(SkillRecord.comboStaging) ─────────────────────────────────────────────
export type ComboShake = "none" | "light" | "heavy";
export const COMBO_SHAKES: readonly ComboShake[] = ["none", "light", "heavy"];

export interface ComboStaging {
  /** 번쩍임·오라·제목 색(#rrggbb). 생략 = 속성 색. */
  readonly tint?: string;
  /** 착탄 흔들림. 생략 = heavy(트리플)·light(듀얼). */
  readonly shake?: ComboShake;
  /** 착탄 순간 느린 화면. 생략 = 켜기. */
  readonly slowMo?: boolean;
  /** 제목 카드 위 작은 글(예: 「듀얼 테크」「트리플 테크」). 생략 = 인원수로. */
  readonly kicker?: string;
  /**
   * 함께 쓰는 동료(시전자 말고 참가자)가 무엇을 하나 — rush: 적 앞까지 달려가 차례로 벤다 · cast: 반 걸음 나와 시전 ·
   * ranged: 반 걸음 나와 쏘기/던지기 · auto(생략): 그 동료가 요구 기술로 정한다(마법 → cast, 원거리 캐릭터 → ranged, 나머지 rush).
   * 마지막 타 뒤에는 참가자 모두가 함께 마무리 자세 + 빛.
   */
  readonly partners?: ComboPartnerAction;
}

export type ComboPartnerAction = "auto" | "rush" | "cast" | "ranged";
export const COMBO_PARTNER_ACTIONS: readonly ComboPartnerAction[] = ["auto", "rush", "cast", "ranged"];

export function normalizeComboStaging(value: unknown): ComboStaging | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const out: { -readonly [K in keyof ComboStaging]: ComboStaging[K] } = {};
  if (typeof raw.tint === "string" && /^#[0-9a-f]{6}$/i.test(raw.tint.trim())) out.tint = raw.tint.trim().toLowerCase();
  const shake = pick(COMBO_SHAKES, raw.shake);
  if (shake) out.shake = shake;
  if (raw.slowMo === false) out.slowMo = false;
  if (typeof raw.kicker === "string" && raw.kicker.trim()) out.kicker = raw.kicker.trim().slice(0, 24);
  const partners = pick(COMBO_PARTNER_ACTIONS, raw.partners);
  if (partners && partners !== "auto") out.partners = partners;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 적 하나의 달려들기 배율(EnemyRecord.lungeSpeedPercent) — 클수록 빠르다(이동 시간을 이 값으로 나눈다). */
export function enemyLungeOwnFactor(enemyPercent: number | undefined): number {
  return typeof enemyPercent === "number" && Number.isFinite(enemyPercent) ? Math.max(25, Math.min(300, enemyPercent)) / 100 : 1;
}

/**
 * 도트 괴물의 이동 속도(px/ms)와 멈춤(ms) — 모드·몸짓별. fast 는 사람 적 걸음(approachMsFor dash ≈ 1.2px/ms + 170ms)을
 * 바닥으로 삼아 짐승(dash)은 그보다 빠르고, 쿵쿵 걷는 거구(stomp)만 사람 적과 비슷하다. classic = 예전 값 그대로.
 */
export function pixelEnemyLungeProfile(lunge: BattleEnemyLunge, motion: string | undefined): { readonly holdMs: number; readonly pxPerMs: number; readonly minMs: number; readonly maxMs: number } {
  const hovering = motion === "swoop" || motion === "float";
  if (lunge === "classic") {
    return { holdMs: 260, pxPerMs: motion === "dash" ? 0.65 : motion === "stomp" ? 0.34 : hovering ? 0.42 : 0.3, minMs: motion === "stomp" ? 440 : 300, maxMs: 900 };
  }
  const fast = lunge === "fast";
  const pxPerMs = (motion === "dash" ? 1.7 : motion === "stomp" ? 1.1 : hovering ? 1.4 : 1.25) * (fast ? 1 : 0.7);
  return { holdMs: (motion === "stomp" ? 170 : 90) * (fast ? 1 : 1.6), pxPerMs, minMs: fast ? 140 : 200, maxMs: fast ? 420 : 560 };
}

/** 연계기 색 — 속성 색(번쩍임·오라·제목). 모르는 속성은 별빛 금색. 컷인·자료집 색 칸이 같이 쓴다. */
export const COMBO_ELEMENT_TINT: Readonly<Record<string, string>> = {
  fire: "#ff7a3d", ice: "#7fe3ff", thunder: "#ffe14d", water: "#4fa8ff", wind: "#7dffb0", earth: "#c8955a",
  holy: "#fff2a8", dark: "#b47bff", poison: "#9be05a", sword: "#dfe7f2", spear: "#c2d2e8", bow: "#a6f08a", hit: "#ffb066",
};
export const COMBO_FALLBACK_TINT = "#ffd76a";

export function comboTint(skill: { readonly elementId?: string; readonly comboStaging?: ComboStaging } | undefined): string {
  return skill?.comboStaging?.tint ?? (skill?.elementId ? COMBO_ELEMENT_TINT[skill.elementId] : undefined) ?? COMBO_FALLBACK_TINT;
}
