/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import type { BattleSnapshot } from "@/battle/types";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { battleResultPanel, resultHeadLootText } from "@/player/battleDirectorDom";

// 승리 머리 창 전리품이 전부 이어져 191px 칸에서 「늑대 가죽 ×1 · 늑대 …」 로 잘렸다(폴른 스타 QA B6, 2026-11-08).

describe("battle result head loot", () => {
  it("names the first drop and counts the other kinds", () => {
    expect(resultHeadLootText([])).toBe("");
    expect(resultHeadLootText([{ name: "늑대 가죽", count: 1 }])).toBe("늑대 가죽 ×1");
    expect(resultHeadLootText([
      { name: "늑대 송곳니", count: 2 }, { name: "늑대 가죽", count: 2 }, { name: "회복약", count: 1 },
    ])).toBe("늑대 송곳니 ×2 외 2종");
  });

  const project = store.getCurrent();
  const previousBattleUi = project.system.battleUiStyle;
  const previousMenu = project.system.menuUiStyle;
  afterEach(() => {
    project.system.battleUiStyle = previousBattleUi;
    project.system.menuUiStyle = previousMenu;
  });

  it("keeps every drop on its own row in the loot window while the head stays short", () => {
    project.system.battleUiStyle = "retro2003";
    project.system.menuUiStyle = "pixel";
    const [first, second] = project.database.items;
    const panel = battleResultPanel({
      result: "victory",
      actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1, skillIds: [] }],
      rewards: { exp: 12, gold: 48, items: [first!.id, first!.id, second!.id] },
      eventState: { gold: 10, inventory: {} },
      participatingActorIds: [DEFAULT_ACTOR_ID],
    } as unknown as BattleSnapshot);
    expect(panel!.querySelector(".battle-result-summary-loot")?.textContent).toBe(`${first!.name} ×2 외 1종`);
    const cards = panel!.querySelector(".battle-result-cards")?.textContent ?? "";
    expect(cards).toContain(first!.name);
    expect(cards).toContain(second!.name);
  });
});
