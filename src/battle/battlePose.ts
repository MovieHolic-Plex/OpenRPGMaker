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
