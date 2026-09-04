import { describe, expect, it } from "vitest";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import {
  defaultEquipmentRecords,
} from "@/project/defaults/defaultDatabaseEquipmentRecords";
import {
  defaultPartyRecords,
  defaultStarterActorIds,
} from "@/project/defaults/defaultDatabasePartyRecords";
import { parameterValueAtLevel } from "@/project/actorModel";

// 106종 권장 레벨 기준 TTK/TTD 밴드 회귀 — 전투 공식 변경 시 가장 먼저 깨진다.
function heroAt(level: number): { atk: number; def: number; hp: number } {
  const party = defaultPartyRecords();
  const equipById = new Map(defaultEquipmentRecords().map((e) => [e.id, e]));
  const starters = party.actors.filter((a) => defaultStarterActorIds().includes(a.id));
  const classById = new Map(party.classes.map((c) => [c.id, c]));
  let atk = 0, def = 0, hp = 0;
  for (const actor of starters) {
    const klass = classById.get(actor.classId)!;
    let eAtk = 0, eDef = 0;
    for (const id of Object.values(actor.initialEquipment ?? {})) {
      const e = id ? equipById.get(id as string) : undefined;
      if (e) {
        eAtk += e.statBonuses.attack;
        eDef += e.statBonuses.defense;
      }
    }
    atk += parameterValueAtLevel(klass.parameterCurves.attack, level) + eAtk;
    def += parameterValueAtLevel(klass.parameterCurves.defense, level) + eDef;
    hp += parameterValueAtLevel(klass.parameterCurves.maxHp, level);
  }
  const n = Math.max(1, starters.length);
  return { atk: atk / n, def: def / n, hp: hp / n };
}

const basicDamage = (atk: number, def: number): number =>
  Math.max(1, Math.round(atk + Math.floor(atk / 2)) - Math.floor(def / 2));

describe("monster rebalance bands", () => {
  it("106종 전원이 권장 레벨 기준 TTK/TTD 밴드 안에 있다", () => {
    const battle = defaultBattleRecords();
    expect(battle.enemies).toHaveLength(106);
    const violations: string[] = [];
    for (const enemy of battle.enemies) {
      const level = enemy.level ?? 1;
      const hero = heroAt(Math.min(50, Math.max(1, level)));
      const ttk = enemy.stats.maxHp / Math.max(1, basicDamage(hero.atk, enemy.stats.defense));
      const ttd = hero.hp / Math.max(1, basicDamage(enemy.stats.attack, hero.def));
      const boss = enemy.rewards.exp >= 200;
      const ttkOk = boss ? ttk >= 6 && ttk <= 12 : ttk >= 2 && ttk <= 7;
      const ttdOk = boss ? ttd >= 2.5 && ttd <= 6 : ttd >= 3;
      if (!ttkOk || !ttdOk) {
        violations.push(`${enemy.id} L${level} TTK ${ttk.toFixed(1)} TTD ${ttd.toFixed(1)}`);
      }
    }
    expect(violations, `밴드 이탈: ${violations.join(", ")}`).toEqual([]);
  });

  it("mind = attack 규약이 106종 전체에 성립한다", () => {
    const odd = defaultBattleRecords()
      .enemies.filter((e) => e.stats.mind !== e.stats.attack)
      .map((e) => e.id);
    expect(odd).toEqual([]);
  });

  it("레벨이 1..99 안에 있고 역전은 수생→보스 경계 1건뿐이다", () => {
    const enemies = defaultBattleRecords().enemies;
    expect(enemies.every((e) => (e.level ?? 1) >= 1 && (e.level ?? 1) <= 99)).toBe(true);
    const sliced = enemies.slice(6);
    const inversions: string[] = [];
    sliced.forEach((enemy, i) => {
      if (i > 0 && (enemy.level ?? 1) < (sliced[i - 1]?.level ?? 1)) {
        inversions.push(`${enemy.id} L${enemy.level ?? 1}`);
      }
    });
    expect(inversions).toEqual(["enemy_dragon_whelp L36"]);
  });

  it("보상은 처치 코스트(HP)에 비례한다 — exp/hp 비율이 밴드 안에 있다", () => {
    const odd = defaultBattleRecords()
      .enemies.map((e) => ({ id: e.id, ratio: e.rewards.exp / Math.max(1, e.stats.maxHp) }))
      .filter((r) => r.ratio < 0.3 || r.ratio > 0.55)
      .map((r) => `${r.id}(${r.ratio.toFixed(2)})`);
    expect(odd).toEqual([]);
  });
});
