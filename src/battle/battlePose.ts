import type { BattleActionResultSnapshot, BattleBattlerSnapshot } from "@/battle/types";

/** Side-view presentation poses driven by the latest resolve beat. */
export type BattleBattlerPose = "idle" | "attack" | "hit" | "defend" | "dead" | "victory";

/**
 * 생성 전투 캐릭터셋(144×384 = 48px 셀 3열×8행) 안에서 각 포즈가 쓰는 셀 좌표.
 *
 * 이 표가 정본이다 — 런타임(`battleFieldDom.ts` 의 `applyBattlerPose`), 계약 테스트
 * (`test/heroBattleSheetContract.test.ts`), 생성기(`scripts/asset-gen/battlerPrompt.mjs` 의
 * `POSES`)가 같은 좌표를 봐야 한다. 셋이 어긋나면 그림은 있는데 런타임이 다른 칸을
 * 샘플링하는 조용한 회귀가 된다.
 *
 * 2026-08-29 까지 defend 는 idle 칸을, dead 는 hit 칸을 돌려 썼다(행 0 3칸만 존재). 행 1 에
 * 전용 그림을 넣어 5포즈가 5칸을 쓴다. 행 1 열 2 는 victory 칸이다 — 기존 시트는 비어 있어서
 * 표시 계층(battleFieldDom)이 칸을 실측해 비었으면 idle 칸으로 떨어진다(`victoryCellEmpty`).
 */
export const POSE_FRAME: Record<Exclude<BattleBattlerPose, "victory">, { readonly col: number; readonly row: number }> = {
  idle: { col: 0, row: 0 },
  attack: { col: 1, row: 0 },
  hit: { col: 2, row: 0 },
  defend: { col: 0, row: 1 },
  dead: { col: 1, row: 1 },
};

/** 승리 포즈 칸. POSE_FRAME 과 따로 둔다 — 시트 계약 테스트가 POSE_FRAME 의 모든 칸에 그림을 요구하고,
 *  승리 칸은 비어 있어도 되는(폴백) 칸이다. */
export const VICTORY_POSE_FRAME = { col: 2, row: 1 } as const;

/**
 * Resolve which pose a battler should show after the latest action result.
 * Pure helper so unit tests and DOM can share one source of truth.
 */
export function resolveBattlerPose(input: {
  readonly battler: Pick<BattleBattlerSnapshot, "id" | "recordId" | "defeated" | "defending">;
  readonly lastActionResult?: BattleActionResultSnapshot;
  readonly showActionPose?: boolean;
  /** 승리로 끝난 전투의 살아 있는 아군. 호출자가 아군에만 넘긴다. */
  readonly victory?: boolean;
}): BattleBattlerPose {
  if (input.battler.defeated) return "dead";
  if (input.victory) return "victory";
  const result = input.lastActionResult;
  const showAction = input.showActionPose !== false;
  // SC10 (M5): healing actions (amount < 0) are not attacks — the caster should
  // not show "attack" and the target should not show "hit".
  const isHeal = result && result.amount < 0;
  if (showAction && result && !isHeal) {
    if (result.userRecordId === input.battler.recordId || result.userRecordId === input.battler.id) {
      return "attack";
    }
    if (result.targetId === input.battler.id && result.hit) {
      return "hit";
    }
  }
  if (input.battler.defending) return "defend";
  return "idle";
}

/** True when the last action should flash hit-feel juice (popup/shake/SFX). */
export function hitFeelFromActionResult(
  result: BattleActionResultSnapshot | undefined
): { readonly targetId: string; readonly amount: number; readonly critical: boolean; readonly healing: boolean } | undefined {
  if (!result?.hit || !result.targetId) return undefined;
  if (result.amount === 0) return undefined;
  return {
    targetId: result.targetId,
    amount: Math.abs(result.amount),
    critical: Boolean(result.critical),
    healing: result.amount < 0,
  };
}

/** scripts/asset-gen/charset-battler/cb_lib.py 의 POSES 와 짝인 24칸. 좌표를 함께 유지한다. */
export const EXTENDED_POSE_FRAME = {
  idle: { col: 0, row: 0 },
  attack: { col: 1, row: 0 },
  hit: { col: 2, row: 0 },
  defend: { col: 0, row: 1 },
  dead: { col: 1, row: 1 },
  victory: { col: 2, row: 1 },
  walk_a: { col: 0, row: 2 },
  walk_b: { col: 1, row: 2 },
  walk_c: { col: 2, row: 2 },
  attack_windup: { col: 0, row: 3 },
  attack_strike: { col: 1, row: 3 },
  attack_follow: { col: 2, row: 3 },
  cast_charge: { col: 0, row: 4 },
  cast_raise: { col: 1, row: 4 },
  cast_release: { col: 2, row: 4 },
  item: { col: 0, row: 5 },
  weak: { col: 1, row: 5 },
  evade: { col: 2, row: 5 },
  guard_hit: { col: 0, row: 6 },
  skill: { col: 1, row: 6 },
  victory_b: { col: 2, row: 6 },
  dying: { col: 0, row: 7 },
  revive: { col: 1, row: 7 },
  front: { col: 2, row: 7 },
} as const;

export type ExtendedBattlerPose = keyof typeof EXTENDED_POSE_FRAME;

/**
 * 마법 시전 칸(2026-09-28 2차). 마법 종류마다 캐릭터가 **다르게 움직인다** — 종류 7개 × 3단계(준비·영창·방출).
 * 시트는 전투 시트와 따로 둔다: 144×336 = 48px 셀 3열 × 7행, 행 = 종류, 열 = 단계.
 * 짝: scripts/asset-gen/charset-battler/cb_lib.py 의 CAST_TYPES(순서가 곧 행 번호). 둘이 어긋나면 엉뚱한 마법 칸을 그린다.
 */
export const CAST_TYPES = ["fire", "ice", "thunder", "heal", "dark", "arcane", "support"] as const;
export type CastType = typeof CAST_TYPES[number];
export const CAST_SHEET_ROWS = CAST_TYPES.length;

export function castFrame(type: CastType, step: 1 | 2 | 3): { readonly col: number; readonly row: number } {
  return { col: step - 1, row: CAST_TYPES.indexOf(type) };
}

const CAST_BY_ELEMENT: Readonly<Record<string, CastType>> = {
  fire: "fire", ice: "ice", water: "ice", thunder: "thunder", wind: "thunder",
  holy: "heal", dark: "dark", absorb: "dark", earth: "arcane",
};
const CAST_BY_WORD: readonly [RegExp, CastType][] = [
  [/화염|불꽃|불|파이어|fire|flame/i, "fire"],
  [/얼음|냉기|눈보라|빙|ice|frost|blizzard/i, "ice"],
  [/번개|전격|뇌|썬더|thunder|bolt|spark/i, "thunder"],
  [/치유|회복|힐|빛|성스|heal|cure|holy/i, "heal"],
  [/독|어둠|저주|흡수|poison|dark|curse|drain/i, "dark"],
  [/수면|약화|강화|집중|안개|보호|sleep|weaken|focus|mist|guard/i, "support"],
];

/** 기술 → 시전 종류. 속성 → 효과 종류 → 이름 낱말 → 공격 마법 기본(비전) 순서. */
export function castTypeForSkill(skill: {
  readonly elementId?: string;
  readonly name?: string;
  readonly effect?: { readonly kind?: string };
}): CastType {
  const byElement = skill.elementId ? CAST_BY_ELEMENT[skill.elementId] : undefined;
  if (byElement) return byElement;
  for (const [pattern, type] of CAST_BY_WORD) if (pattern.test(skill.name ?? "")) return type;
  if (skill.effect?.kind === "healing") return "heal";
  if (skill.effect?.kind === "support") return "support";
  return "arcane";
}
