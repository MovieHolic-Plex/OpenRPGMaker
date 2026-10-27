/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import type { BattleSnapshot } from "@/battle/types";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { battleResultPanel, resultDirectorState } from "@/player/battleDirectorDom";

// 기본 용어의 화폐는 「G」다. 승리 칸만 「골드」로 고정되면 상점·메뉴와 다른 돈을 받은 것처럼 읽힌다.

function victorySnapshot(): BattleSnapshot {
  return {
    result: "victory",
    actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1 }],
    rewards: { exp: 12, gold: 48, items: [] },
    eventState: { gold: 10, inventory: {} },
    participatingActorIds: [DEFAULT_ACTOR_ID],
  } as unknown as BattleSnapshot;
}

describe("battle victory currency term", () => {
  const project = store.getCurrent();
  const previousTerms = project.meta.terms;
  const previousBattleUi = project.system.battleUiStyle;
  const previousMenu = project.system.menuUiStyle;

  afterEach(() => {
    project.meta.terms = previousTerms;
    project.system.battleUiStyle = previousBattleUi;
    project.system.menuUiStyle = previousMenu;
  });

  it("uses the project currency on the reward row, purse line, and summary", () => {
    project.meta.terms = { ...previousTerms, gold: "크레딧", item: "도구" };
    project.system.battleUiStyle = "retro2003";
    project.system.menuUiStyle = "pixel";
    const snapshot = victorySnapshot();
    const panel = battleResultPanel(snapshot);
    expect(panel).toBeTruthy();
    const labels = [...panel!.querySelectorAll(".battle-result-reward-label")].map((node) => node.textContent);
    expect(labels).toContain("크레딧");
    expect(labels).not.toContain("골드");
    expect(panel!.querySelector(".battle-result-reward-owned")?.textContent).toBe("소지금 10 크레딧 → 58 크레딧");
    expect(panel!.querySelector(".battle-result-summary-gold")?.textContent).toBe("+48 크레딧");
    const summary = resultDirectorState(snapshot, { step: "acting", lines: [] }).lines[1];
    expect(summary).toBe("경험치 12 / 48 크레딧 / 도구 0");
  });

  it("falls back to G when the currency term is blank", () => {
    project.meta.terms = { ...previousTerms, gold: "   " };
    project.system.battleUiStyle = "classic";
    project.system.menuUiStyle = "classic";
    const panel = battleResultPanel(victorySnapshot());
    const labels = [...panel!.querySelectorAll(".battle-result-reward-label")].map((node) => node.textContent);
    expect(labels).toContain("G");
    expect(labels).not.toContain("골드");
  });
});
