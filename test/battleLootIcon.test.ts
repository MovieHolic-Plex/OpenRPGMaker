/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import type { BattleSnapshot } from "@/battle/types";
import { DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { battleResultPanel } from "@/player/battleDirectorDom";

// 몬스터 드롭이 결과 창 글자 한 줄뿐이라 무엇을 얻었는지 놓쳤다(2026-11-08). 도트 결과 창의 전리품 줄은 아이템 아이콘을 단다.
function lootSnapshot(items: string[]): BattleSnapshot {
  return {
    result: "victory",
    actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1, skillIds: [] }],
    rewards: { exp: 12, gold: 0, items },
    eventState: { gold: 0, inventory: {} },
    participatingActorIds: [DEFAULT_ACTOR_ID],
  } as unknown as BattleSnapshot;
}

describe("pixel battle result loot row", () => {
  const project = store.getCurrent();
  const previousBattleUi = project.system.battleUiStyle;
  const previousMenu = project.system.menuUiStyle;

  afterEach(() => {
    project.system.battleUiStyle = previousBattleUi;
    project.system.menuUiStyle = previousMenu;
  });

  it("puts the dropped item's icon on its row with the count", () => {
    project.system.battleUiStyle = "retro2003";
    project.system.menuUiStyle = "pixel";
    const panel = battleResultPanel(lootSnapshot([DEFAULT_ITEM_ID, DEFAULT_ITEM_ID]))!;
    const row = [...panel.querySelectorAll<HTMLElement>(".battle-result-reward-row")].find((node) => node.dataset.rewardKind === "item")!;
    expect(row.querySelector(`[data-testid="battle-result-loot-icon-${DEFAULT_ITEM_ID}"]`)).not.toBeNull();
    expect(row.querySelector(".battle-result-reward-value")?.textContent).toBe("×2");
    expect(row.querySelector(".battle-result-reward-owned")?.textContent).toBe("보유 0 → 2");
  });

  it("adds no loot row or icon when nothing dropped", () => {
    project.system.battleUiStyle = "retro2003";
    project.system.menuUiStyle = "pixel";
    const panel = battleResultPanel(lootSnapshot([]))!;
    expect(panel.querySelector(".battle-result-loot-icon")).toBeNull();
    expect([...panel.querySelectorAll<HTMLElement>(".battle-result-reward-row")].some((node) => node.dataset.rewardKind === "item")).toBe(false);
  });
});
