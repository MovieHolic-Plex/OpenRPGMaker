/**
 * 상태 지속 오라(battleAura) — 상태가 걸려 있는 동안 전투 화면의 몸 위에 남는 표시.
 * 입자(Z·별·하트·불꽃·말풍선)는 모든 스킨에, 몸 색(필터)은 도트 측면(retro) 스킨에만 그린다.
 * 그림 시트 없이 CSS(필터·겹침 span)만으로 그린다. 프리셋 id 는 CSS `[data-battle-aura~="…"]` 와 1:1.
 * 상태 레코드의 `battleAura` 가 "none" 이면 끈다. 값이 없으면 기본 상태 id 표(`DEFAULT_AURA_BY_STATE_ID`)로 보충한다.
 */
export const BATTLE_AURA_IDS = [
  "freeze-grey",
  "berserk-pulse",
  "shield-shimmer",
  "wet-drip",
  "poison-bubble",
  "dark-fog",
  "petrify-still",
  "regen-sparkle",
  "sleep-zzz",
  "paralyze-spark",
  "silence-mute",
  "confuse-stars",
  "charm-heart",
  "burn-ember",
] as const;

export type BattleAuraId = (typeof BATTLE_AURA_IDS)[number];
export type BattleAuraSetting = BattleAuraId | "none";

export const BATTLE_AURA_LABELS: Readonly<Record<BattleAuraId, string>> = {
  "freeze-grey": "굳음 (회색 경직)",
  "berserk-pulse": "격노 (붉은 맥동)",
  "shield-shimmer": "방어막 (푸른 일렁임)",
  "wet-drip": "젖음 (물방울)",
  "poison-bubble": "독 (초록 거품)",
  "dark-fog": "암흑 (검은 안개)",
  "petrify-still": "석화 (돌빛 정지)",
  "regen-sparkle": "재생 (초록 반짝임)",
  "sleep-zzz": "수면 (Z 가 떠오름)",
  "paralyze-spark": "마비 (노란 전기 불꽃)",
  "silence-mute": "침묵 (말풍선 …)",
  "confuse-stars": "혼란 (머리 위 별이 돎)",
  "charm-heart": "매혹 (하트가 떠오름)",
  "burn-ember": "화상 (불티)",
};

const DEFAULT_AURA_BY_STATE_ID: Readonly<Record<string, BattleAuraId>> = {
  state_poison: "poison-bubble",
  state_deep_poison: "poison-bubble",
  state_stop: "freeze-grey",
  state_berserk: "berserk-pulse",
  state_protect: "shield-shimmer",
  state_shell: "shield-shimmer",
  state_wet: "wet-drip",
  state_blind: "dark-fog",
  state_petrify: "petrify-still",
  state_regen: "regen-sparkle",
  state_sleep: "sleep-zzz",
  state_paralysis: "paralyze-spark",
  state_silence: "silence-mute",
  state_confuse: "confuse-stars",
  state_confusion: "confuse-stars",
  state_charm: "charm-heart",
  state_burn: "burn-ember",
};

/** 몬스터 게임의 주 상태(gen1MajorStatus)는 id 가 제각각이라 의미로 고른다. */
const DEFAULT_AURA_BY_MAJOR_STATUS: Readonly<Record<string, BattleAuraId>> = {
  poison: "poison-bubble",
  burn: "burn-ember",
  sleep: "sleep-zzz",
  freeze: "freeze-grey",
  paralysis: "paralyze-spark",
};

export function isBattleAuraId(value: unknown): value is BattleAuraId {
  return typeof value === "string" && (BATTLE_AURA_IDS as readonly string[]).includes(value);
}

/** 저장 필드 정규화: 알려진 id 와 "none" 만 통과. */
export function normalizeBattleAura(value: unknown): BattleAuraSetting | undefined {
  if (value === "none") return "none";
  return isBattleAuraId(value) ? value : undefined;
}

/** 상태 하나가 그리는 오라. 없으면 null. */
export function resolveStateAura(
  stateId: string,
  record?: { readonly battleAura?: string; readonly gen1MajorStatus?: string },
): BattleAuraId | null {
  const own = normalizeBattleAura(record?.battleAura);
  if (own === "none") return null;
  if (own) return own;
  return DEFAULT_AURA_BY_STATE_ID[stateId] ?? (record?.gen1MajorStatus ? DEFAULT_AURA_BY_MAJOR_STATUS[record.gen1MajorStatus] : undefined) ?? null;
}

/** 배틀러에 걸린 상태들의 오라(중복 제거, 최대 3개, 걸린 순서). */
export function resolveBattlerAuras(
  stateIds: readonly string[],
  records: readonly { readonly id: string; readonly battleAura?: string; readonly gen1MajorStatus?: string }[],
): BattleAuraId[] {
  const out: BattleAuraId[] = [];
  for (const id of stateIds) {
    const aura = resolveStateAura(id, records.find((record) => record.id === id));
    if (aura && !out.includes(aura)) out.push(aura);
    if (out.length >= 3) break;
  }
  return out;
}
