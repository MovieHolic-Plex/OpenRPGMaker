/** @vitest-environment happy-dom */
// 상태 배지 토큰 매핑 — "이미 걸린 상태가 화면에서 구별되는가" 를 지킨다.
//
// 두 가지 거짓 통과를 막는다.
//   1) `state_attack_down` 은 "down" 을 품고 있어서 death 분기에 먼저 걸렸다 → 공격 하락이
//      전투불능과 같은 붉은 KO 배지로 그려졌다.
//   2) 능력 증감·재생은 폴백(`burst`, 회색 ●)으로 떨어져서 공격 상승/방어 상승/재생이
//      화면에서 전부 같은 점이었다 → 스크린샷으로 아이템 효과를 증명할 수 없었다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { battleField } from "@/player/battleFieldDom";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

const STATUS_CSS = "src/styles/runtime/battle/03-vxace-status-nodes.css";

function tokenFor(stateId: string): string | undefined {
  const project = deserialize(JSON.stringify(battleFixture));
  store.replace(project);
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    rng: () => 0.5,
  });
  const snapshot = runtime.snapshot();
  const enemies = snapshot.enemies.map((enemy, index) => (index === 0 ? { ...enemy, stateIds: [stateId] } : enemy));
  const node = battleField({ ...snapshot, enemies });
  return node.querySelector<HTMLElement>(".battle-enemy .battle-status-icon")?.dataset.statusIcon;
}

describe("전투 상태 배지 토큰", () => {
  it("능력 하락을 전투불능(KO) 배지로 그리지 않는다", () => {
    expect(tokenFor("state_attack_down")).toBe("atk-down");
    expect(tokenFor("state_defense_down")).toBe("def-down");
    expect(tokenFor("state_agility_down")).toBe("agi-down");
  });

  it("능력 상승과 재생을 서로 다른 토큰으로 가른다", () => {
    const tokens = ["state_attack_up", "state_defense_up", "state_agility_up", "state_regen"].map((id) => tokenFor(id));
    expect(tokens).toEqual(["atk-up", "def-up", "agi-up", "regen"]);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("기존 상태이상 토큰은 그대로 유지한다", () => {
    expect(tokenFor("state_poison")).toBe("poison");
    expect(tokenFor("state_deep_poison")).toBe("poison");
    expect(tokenFor("state_sleep")).toBe("sleep");
    expect(tokenFor("state_paralysis")).toBe("paralysis");
    expect(tokenFor("state_silence")).toBe("silence");
    expect(tokenFor("state_death")).toBe("death");
  });

  it("토큰마다 글리프 CSS 규칙이 있다(빈 배지 금지)", () => {
    const css = readFileSync(STATUS_CSS, "utf8");
    const tokens = [
      "atk-up",
      "atk-down",
      "def-up",
      "def-down",
      "agi-up",
      "agi-down",
      "mag-up",
      "mag-down",
      "regen",
      "poison",
      "sleep",
      "paralysis",
      "silence",
      "death",
      "burst",
    ];
    for (const token of tokens) {
      expect(css, `${token} 배지에 ::before 글리프 규칙이 없다`).toContain(`.battle-status-icon-${token}::before`);
    }
  });
});
