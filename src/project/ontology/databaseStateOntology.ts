import type { StateId } from "@/project/types";

export type StateRateGrade = "A" | "B" | "C" | "D" | "E";

export type StateOntology = {
  readonly removalCondition: string;
  readonly color: string;
  readonly colorHex: string;
  readonly rating: number;
  readonly restriction: string;
  readonly accuracyModifier: number;
  readonly specialFlags: readonly string[];
  readonly rates: Readonly<Record<StateRateGrade, number>>;
  readonly recoverNaturallyFromTurn: number;
  readonly recoverNaturallyChance: number;
  readonly recoverWhenHitChance: number;
  readonly actorStatus: string;
  readonly lockedParameters: readonly string[];
  readonly skillLimit: string;
  readonly hpTurn: string;
  readonly hpMove: string;
  readonly mpTurn: string;
  readonly mpMove: string;
  readonly animationIndex: number;
  readonly summary: string;
};

const DEFAULT_RATES = { A: 90, B: 70, C: 50, D: 30, E: 0 } as const;

const STATE_ONTOLOGY: Readonly<Record<string, StateOntology>> = {
  state_poison: {
    removalCondition: "전투 종료 후 유지",
    color: "초록",
    colorHex: "#7fc665",
    rating: 52,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 3,
    recoverNaturallyChance: 20,
    recoverWhenHitChance: 0,
    actorStatus: "변화 없음",
    lockedParameters: [],
    skillLimit: "마법 계열 1 이상 사용 가능",
    hpTurn: "매 턴 최대 HP의 -6%",
    hpMove: "4걸음마다 HP -1",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 7,
    summary: "지속 피해 상태입니다. 해독 아이템과 회복 이벤트가 이 상태를 참조합니다.",
  },
  state_sleep: {
    removalCondition: "피격 또는 전투 종료",
    color: "보라",
    colorHex: "#b9a2df",
    rating: 52,
    restriction: "행동 불가",
    accuracyModifier: 100,
    specialFlags: ["회피 불가"],
    rates: { A: 95, B: 80, C: 55, D: 35, E: 10 },
    recoverNaturallyFromTurn: 2,
    recoverNaturallyChance: 35,
    recoverWhenHitChance: 50,
    actorStatus: "변화 없음",
    lockedParameters: ["공격", "정신", "방어", "민첩"],
    skillLimit: "공격/정신 계열 모두 사용 불가",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 4,
    summary: "행동을 막는 군중제어 상태입니다. 피격 회복 확률이 높습니다.",
  },
  state_attack_up: {
    removalCondition: "전투 종료",
    color: "빨강",
    colorHex: "#e68b8b",
    rating: 70,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: ["고정 장비 영향 없음"],
    rates: { A: 100, B: 85, C: 65, D: 40, E: 20 },
    recoverNaturallyFromTurn: 4,
    recoverNaturallyChance: 25,
    recoverWhenHitChance: 0,
    actorStatus: "공격 2배",
    lockedParameters: ["공격"],
    skillLimit: "제한 없음",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 2,
    summary: "전투 중 공격 능력을 끌어올리는 강화 상태입니다.",
  },
  state_defense_up: {
    removalCondition: "전투 종료",
    color: "주황",
    colorHex: "#d6a66f",
    rating: 65,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 4,
    recoverNaturallyChance: 25,
    recoverWhenHitChance: 0,
    actorStatus: "방어 2배",
    lockedParameters: ["방어"],
    skillLimit: "제한 없음",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 2,
    summary: "전투 중 방어 능력을 끌어올리는 강화 상태입니다.",
  },
  state_attack_down: {
    removalCondition: "전투 종료",
    color: "청록",
    colorHex: "#74b8b0",
    rating: 40,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 4,
    recoverNaturallyChance: 25,
    recoverWhenHitChance: 0,
    actorStatus: "공격 절반",
    lockedParameters: ["공격"],
    skillLimit: "제한 없음",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 6,
    summary: "대상의 공격력을 절반으로 낮추는 약화 상태입니다.",
  },
  state_agility_up: {
    removalCondition: "전투 종료",
    color: "노랑",
    colorHex: "#e6cf72",
    rating: 65,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 4,
    recoverNaturallyChance: 25,
    recoverWhenHitChance: 0,
    actorStatus: "민첩 2배",
    lockedParameters: ["민첩"],
    skillLimit: "제한 없음",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 2,
    summary: "턴 순서와 게이지 충전 속도를 높이는 강화 상태입니다.",
  },
  state_agility_down: {
    removalCondition: "전투 종료",
    color: "회색",
    colorHex: "#929aa8",
    rating: 40,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 4,
    recoverNaturallyChance: 25,
    recoverWhenHitChance: 0,
    actorStatus: "민첩 절반",
    lockedParameters: ["민첩"],
    skillLimit: "제한 없음",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 6,
    summary: "턴 순서와 게이지 충전 속도를 낮추는 약화 상태입니다.",
  },
  state_paralysis: {
    removalCondition: "턴 경과",
    color: "노랑",
    colorHex: "#e1c84f",
    rating: 58,
    restriction: "행동 불가",
    accuracyModifier: 100,
    specialFlags: ["회피 불가"],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 2,
    recoverNaturallyChance: 35,
    recoverWhenHitChance: 0,
    actorStatus: "변화 없음",
    lockedParameters: ["민첩"],
    skillLimit: "공격/정신 계열 모두 사용 불가",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 5,
    summary: "행동을 막지만 턴 경과로 자연 회복하는 상태입니다.",
  },
  state_deep_poison: {
    removalCondition: "전투 종료 후 유지",
    color: "진보라",
    colorHex: "#76529b",
    rating: 68,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 4,
    recoverNaturallyChance: 10,
    recoverWhenHitChance: 0,
    actorStatus: "변화 없음",
    lockedParameters: [],
    skillLimit: "제한 없음",
    hpTurn: "매 턴 최대 HP의 -12%",
    hpMove: "4걸음마다 HP -2",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 7,
    summary: "독보다 강한 턴당 피해를 주며 전투 뒤에도 유지되는 상태입니다.",
  },
  state_regen: {
    removalCondition: "전투 종료",
    color: "연두",
    colorHex: "#83d48a",
    rating: 68,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 5,
    recoverNaturallyChance: 25,
    recoverWhenHitChance: 0,
    actorStatus: "변화 없음",
    lockedParameters: [],
    skillLimit: "제한 없음",
    hpTurn: "매 턴 최대 HP의 +8%",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 3,
    summary: "턴마다 최대 HP에 비례해 생명력을 회복하는 강화 상태입니다.",
  },
  state_silence: {
    removalCondition: "전투 종료",
    color: "남색",
    colorHex: "#6874ad",
    rating: 55,
    restriction: "스킬 사용 불가",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 3,
    recoverNaturallyChance: 30,
    recoverWhenHitChance: 0,
    actorStatus: "변화 없음",
    lockedParameters: ["정신"],
    skillLimit: "스킬 사용 불가",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 4,
    summary: "기본 공격과 아이템은 허용하고 스킬 사용만 막는 상태입니다.",
  },
  state_defense_down: {
    removalCondition: "전투 종료",
    color: "파랑",
    colorHex: "#8bb6e6",
    rating: 40,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: { A: 90, B: 72, C: 54, D: 36, E: 18 },
    recoverNaturallyFromTurn: 4,
    recoverNaturallyChance: 25,
    recoverWhenHitChance: 0,
    actorStatus: "방어 절반",
    lockedParameters: ["방어"],
    skillLimit: "제한 없음",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 6,
    summary: "대상의 방어를 낮추는 약화 상태입니다.",
  },
};

export function stateOntologyFor(id: StateId, name: string): StateOntology {
  return STATE_ONTOLOGY[id] ?? {
    removalCondition: "전투 종료",
    color: "기본",
    colorHex: "#c7b7e8",
    rating: 50,
    restriction: "없음",
    accuracyModifier: 100,
    specialFlags: [],
    rates: DEFAULT_RATES,
    recoverNaturallyFromTurn: 3,
    recoverNaturallyChance: 20,
    recoverWhenHitChance: 0,
    actorStatus: "변화 없음",
    lockedParameters: [],
    skillLimit: "제한 없음",
    hpTurn: "변화 없음",
    hpMove: "변화 없음",
    mpTurn: "변화 없음",
    mpMove: "변화 없음",
    animationIndex: 1,
    summary: `${name || "새 상태"} 상태의 기본 온톨로지 템플릿입니다.`,
  };
}

// 편집 가능한 StateRecord 필드 타입 — 폼에서 사용자가 재정의할 수 있는 항목.
export type EditableStateFields = {
  removalCondition?: string;
  restriction?: string;
  priority?: number;
  accuracyModifier?: number;
  animationIndex?: number;
  recoverNaturallyFromTurn?: number;
  recoverNaturallyChance?: number;
  recoverWhenHitChance?: number;
  hpReleaseTurn?: number;
  hpReleaseStep?: number;
  mpReleaseTurn?: number;
  mpReleaseStep?: number;
  specialFlags?: readonly string[];
  lockedParameters?: readonly string[];
};

// 뷰에서 사용자 재정의(record)를 우선하고, 없으면 ontology 기본값으로 병합.
// record의 필드는 ontology와 다른 스키마(hpReleaseTurn 등)를 가지므로 매핑이 필요하다.
export function resolvedStateValues(
  id: StateId,
  name: string,
  record: Partial<EditableStateFields>
): StateOntology {
  const base = stateOntologyFor(id, name);
  return {
    ...base,
    removalCondition: record.removalCondition ?? base.removalCondition,
    restriction: record.restriction ?? base.restriction,
    rating: record.priority ?? base.rating,
    accuracyModifier: record.accuracyModifier ?? base.accuracyModifier,
    animationIndex: record.animationIndex ?? base.animationIndex,
    recoverNaturallyFromTurn: record.recoverNaturallyFromTurn ?? base.recoverNaturallyFromTurn,
    recoverNaturallyChance: record.recoverNaturallyChance ?? base.recoverNaturallyChance,
    recoverWhenHitChance: record.recoverWhenHitChance ?? base.recoverWhenHitChance,
    specialFlags: record.specialFlags ?? base.specialFlags,
    lockedParameters: record.lockedParameters ?? base.lockedParameters,
    hpTurn: record.hpReleaseTurn !== undefined ? `${record.hpReleaseTurn}` : base.hpTurn,
    hpMove: record.hpReleaseStep !== undefined ? `${record.hpReleaseStep}` : base.hpMove,
    mpTurn: record.mpReleaseTurn !== undefined ? `${record.mpReleaseTurn}` : base.mpTurn,
    mpMove: record.mpReleaseStep !== undefined ? `${record.mpReleaseStep}` : base.mpMove,
  };
}
