/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import type { BattleSnapshot } from "@/battle/types";
import { collectBattleRewards } from "@/battle/battleRewards";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { battleResultPanel, rewardValue } from "@/player/battleDirectorDom";

// 사장 1.37 VQA D2(2026-11-05): 결과 패널에 「경험치+-28」·「G+-7」처럼 부호가 겹쳐 찍혔다.
// 세션 적립은 음수를 0 으로 깎으므로, 패널도 같은 규칙을 써야 한다(받지 않는 손실을 보여 주면 안 된다).

function snapshotWithRewards(exp: number, gold: number): BattleSnapshot {
  return {
    result: "victory",
    actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1 }],
    rewards: { exp, gold, items: [] },
    eventState: { gold: 10, inventory: {} },
    participatingActorIds: [DEFAULT_ACTOR_ID],
  } as unknown as BattleSnapshot;
}

describe("battle result reward signs", () => {
  const project = store.getCurrent();
  const previousTerms = project.meta.terms;
  const previousBattleUi = project.system.battleUiStyle;
  const previousMenu = project.system.menuUiStyle;

  afterEach(() => {
    project.meta.terms = previousTerms;
    project.system.battleUiStyle = previousBattleUi;
    project.system.menuUiStyle = previousMenu;
  });

  it("clamps reward values the way the session does", () => {
    expect(rewardValue(28)).toBe("+28");
    expect(rewardValue(0)).toBe("+0");
    expect(rewardValue(-28)).toBe("+0");
  });

  it("drops a negative reward row instead of printing a doubled sign", () => {
    project.meta.terms = { ...previousTerms, gold: "G", item: "아이템" };
    project.system.battleUiStyle = "retro2003";
    project.system.menuUiStyle = "pixel";
    const panel = battleResultPanel(snapshotWithRewards(-28, -7))!;
    expect(panel.textContent ?? "").not.toContain("+-");
    const values = [...panel.querySelectorAll(".battle-result-reward-value")].map((node) => node.textContent);
    expect(values).not.toContain("-28");
    expect(values).not.toContain("-7");
    expect(values.filter((text) => (text ?? "").includes("-"))).toHaveLength(0);
  });

  it("still prints a plain plus for positive rewards", () => {
    project.system.battleUiStyle = "retro2003";
    project.system.menuUiStyle = "pixel";
    const panel = battleResultPanel(snapshotWithRewards(12, 48))!;
    const values = [...panel.querySelectorAll(".battle-result-reward-value")].map((node) => node.textContent);
    expect(values).toContain("+12");
    expect(values).toContain("+48");
    expect(panel.textContent ?? "").not.toContain("+-");
  });

  it("collects no negative total even when an enemy reward is negative", () => {
    const snapshot = collectBattleRewards(
      project,
      [{ id: "e1", recordId: "enemy_negative_probe", level: 1, hp: 0, hidden: false } as never],
      () => 0.5,
    );
    expect(snapshot.exp).toBeGreaterThanOrEqual(0);
    expect(snapshot.gold).toBeGreaterThanOrEqual(0);
  });
});
