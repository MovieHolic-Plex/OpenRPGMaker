import { describe, it, expect } from "vitest";
import {
  tickResources,
  resolveCombat,
  applyCapture,
  isNationEliminated,
  isUnificationAchieved,
  applyAction,
  actionOffice,
} from "@/engine";
import type { ActionKind, FactionId, Territory } from "@/types";

function territory(over: Partial<Territory> = {}): Territory {
  return {
    id: "t1",
    nation_id: "chosun" as FactionId,
    name: "한양",
    population: 1000,
    grain: 500,
    troops: 200,
    combat_power: 50,
    q: 0,
    r: 0,
    ...over,
  };
}

describe("tickResources", () => {
  it("인구 대비 곡물 생산이 소비를 초과해 순증가한다", () => {
    // 생산 = pop*0.05, 소비 = pop*0.03 → 순 +0.02*pop
    const before = territory({ population: 1000, grain: 0 });
    const after = tickResources(before);
    expect(after.grain).toBe(20); // 50 - 30
    // 곡물 갱신 후 ≥ 0 이면 인구 증가
    expect(after.population).toBe(1010);
  });

  it("곡물이 풍부하면 인구와 곡물 모두 증가한다", () => {
    const before = territory({ population: 1000, grain: 1000 });
    const after = tickResources(before);
    expect(after.grain).toBe(1020); // 1000 + 50 - 30
    expect(after.population).toBe(1010);
  });
});

describe("resolveCombat", () => {
  it("공격력이 우세하면 공격 승 + 고을 점령", () => {
    // 공격력 200*0.70=140 vs 수비력 100*0.40=40 → 공격 압도 (승률 0.78)
    const defender = territory({ troops: 100, combat_power: 40 });
    const result = resolveCombat(200, 70, defender);
    expect(result.winner).toBe("attacker");
    expect(result.attacker_losses).toBe(70); // 승자 35% = 200*0.35
    expect(result.defender_losses).toBe(60); // 패자 60% = 100*0.60
    // 공격 승 = 점령
    expect(result.territory_captured).toBe(true);
  });

  it("수비력이 우세하면 수비 승, 점령 안 됨", () => {
    const defender = territory({ troops: 300, combat_power: 80 });
    const result = resolveCombat(100, 50, defender);
    expect(result.winner).toBe("defender");
    expect(result.territory_captured).toBe(false);
  });

  it("양쪽 전부 무력이면 현상 유지", () => {
    const defender = territory({ troops: 0, combat_power: 0 });
    const result = resolveCombat(0, 0, defender);
    expect(result.winner).toBe("defender");
    expect(result.attacker_losses).toBe(0);
    expect(result.defender_losses).toBe(0);
  });
});

describe("applyCapture", () => {
  it("고을 소유권이 이전되고 잔여 병력/전투력이 감소한다", () => {
    const t = territory({ nation_id: "wae", troops: 100, combat_power: 80 });
    const { territory: captured, previousOwner } = applyCapture(t, "chosun");
    expect(captured.nation_id).toBe("chosun");
    expect(previousOwner).toBe("wae");
    expect(captured.troops).toBe(20); // 20%
    expect(captured.combat_power).toBe(40); // 50% (최소 10)
  });
});

describe("isNationEliminated", () => {
  it("고을이 1개라도 남아있으면 멸만 아님", () => {
    const territories = [territory({ nation_id: "chosun" })];
    expect(isNationEliminated("chosun", territories)).toBe(false);
  });

  it("모든 고을을 잃으면 멸만", () => {
    const territories = [
      territory({ id: "t1", nation_id: "wae" }),
      territory({ id: "t2", nation_id: "wae" }),
    ];
    expect(isNationEliminated("chosun", territories)).toBe(true);
  });
});

describe("isUnificationAchieved", () => {
  it("과반(>50%) 점유 시 해당 세력 반환", () => {
    const territories = [
      territory({ id: "t1", nation_id: "chosun" }),
      territory({ id: "t2", nation_id: "chosun" }),
      territory({ id: "t3", nation_id: "chosun" }),
      territory({ id: "t4", nation_id: "wae" }),
      territory({ id: "t5", nation_id: "wae" }),
    ];
    expect(isUnificationAchieved(territories)).toBe("chosun");
  });

  it("과반 미달이면 null", () => {
    const territories = [
      territory({ id: "t1", nation_id: "chosun" }),
      territory({ id: "t2", nation_id: "wae" }),
    ];
    expect(isUnificationAchieved(territories)).toBe(null);
  });

  it("고을이 없으면 null", () => {
    expect(isUnificationAchieved([])).toBe(null);
  });
});

// ── 행동 카드 (STEP 2) ──────────────────────────────────

describe("actionOffice", () => {
  it("내정 행동은 interior, 군사 행동은 military", () => {
    const interior: ActionKind[] = ["tax_raise", "grain_levy", "infrastructure", "relief"];
    const military: ActionKind[] = ["conscript", "train", "attack", "defend"];
    for (const a of interior) expect(actionOffice(a)).toBe("interior");
    for (const a of military) expect(actionOffice(a)).toBe("military");
  });
});

describe("applyAction — 내정", () => {
  it("tax_raise: 곡물 증가, 인구 감소", () => {
    const t = territory({ population: 1000, grain: 500 });
    const r = applyAction("tax_raise", t);
    expect(r.territoryPatch.grain).toBe(600); // +100
    expect(r.territoryPatch.population).toBe(970); // -30
    expect(r.fame_delta).toBeGreaterThan(0);
  });

  it("grain_levy: 곡물 대폭 증가, 인구 크게 감소", () => {
    const t = territory({ population: 1000, grain: 500 });
    const r = applyAction("grain_levy", t);
    expect(r.territoryPatch.grain).toBe(700); // +200
    expect(r.territoryPatch.population).toBe(940); // -60
  });

  it("relief: 곡물 소비, 인구 회복", () => {
    const t = territory({ population: 1000, grain: 500 });
    const r = applyAction("relief", t);
    expect(r.territoryPatch.grain).toBe(400); // -100
    expect(r.territoryPatch.population).toBe(1040); // +40
  });
});

describe("applyAction — 군사", () => {
  it("conscript: 병력 증가, 인구·곡물 감소", () => {
    const t = territory({ population: 1000, grain: 500, troops: 100 });
    const r = applyAction("conscript", t);
    expect(r.territoryPatch.troops).toBe(200); // +100
    expect(r.territoryPatch.population).toBe(900); // -100
    expect(r.territoryPatch.grain).toBe(300); // -200
  });

  it("train: 전투력 증가, 병력 약간 손실", () => {
    const t = territory({ troops: 200, combat_power: 50 });
    const r = applyAction("train", t);
    expect(r.territoryPatch.combat_power).toBe(55); // +5
    expect(r.territoryPatch.troops).toBe(196); // -4
  });

  it("defend: 전투력만 약간 증가, 병력 보존", () => {
    const t = territory({ troops: 200, combat_power: 50 });
    const r = applyAction("defend", t);
    expect(r.territoryPatch.combat_power).toBe(53); // +3
    expect(r.territoryPatch.troops).toBeUndefined(); // 변화 없음
  });

  it("combat_power는 100을 넘지 않는다", () => {
    const t = territory({ troops: 200, combat_power: 98 });
    const r = applyAction("train", t);
    expect(r.territoryPatch.combat_power).toBe(100);
  });
});
