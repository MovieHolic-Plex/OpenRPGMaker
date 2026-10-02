/**
 * 전투 방식 — 도트 측면(RM2003식) / 몬스터 대치(포켓몬식) 둘뿐이다(2026-10-02).
 * 방식 하나가 화면(system.battleUiStyle)과 규칙(system.battleModel)을 같이 정한다.
 * 창 색만 다르던 옛 측면 스킨(rm2003·ff·goldensun·chrono·octopath·bravely)은 저장된 그대로 그려지지만 도트 측면으로 센다.
 */
import { resolveSkinId } from "@/battle/skins/registry";
import type { Project } from "@/project/types";

export type BattleMethod = "side" | "monster";

export const BATTLE_METHOD_LABELS: Readonly<Record<BattleMethod, string>> = {
  side: "도트 측면 (RM2003식)",
  monster: "몬스터 대치 (포켓몬식)",
};

/** 저장된 스킨에서 전투 방식을 읽는다 — pokemon 만 몬스터 대치. */
export function battleMethodOf(project: Pick<Project, "system">): BattleMethod {
  return resolveSkinId(project.system.battleUiStyle) === "pokemon" ? "monster" : "side";
}

/** 방식 하나로 화면과 규칙을 같이 맞춘다. 기본값(retro2003·rm2k3)은 저장하지 않는다(normalizeSystemRecords 와 같은 계약). */
export function applyBattleMethod(draft: Pick<Project, "system">, method: BattleMethod): void {
  if (method === "monster") {
    draft.system.battleUiStyle = "pokemon";
    draft.system.battleModel = "gen1";
  } else {
    delete draft.system.battleUiStyle;
    delete draft.system.battleModel;
  }
}
