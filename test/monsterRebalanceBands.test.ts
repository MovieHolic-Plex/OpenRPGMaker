import { describe, expect, it } from "vitest";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { createBlankProject } from "@/project/defaults/blankProject";
import { actorBattlers } from "@/battle/battleBattlers";

// 106종 권장 레벨 기준 TTK/TTD 밴드 회귀 — 전투 공식 변경 시 가장 먼저 깨진다.
// 영웅 스탯은 런타임 배틀러(액터 곡선 + 초기 장비)에서 읽는다. 클래스 곡선만 보면
// L1 HP 40 / 공격 22로 실제(HP 514 / 공격 53)와 달라 밴드가 무의미해진다.
const project = createBlankProject();
function heroAt(level: number): { atk: number; def: number; hp: number; agi: number } {
  const hero = actorBattlers(project, { levels: { actor_hero: level }, partyActorIds: ["actor_hero"] })[0]!;
  return { atk: hero.attackPower, def: hero.defense, hp: hero.maxHp, agi: hero.agility };
}

// 적이 기본 부대에서 몇 마리 묶음으로 나오는지 — 무리 적은 개체 HP를 나눠 가진다.
const groupSize = new Map<string, number>();
for (const troop of project.database.troops) {
  for (const id of troop.enemyIds) groupSize.set(id, Math.max(groupSize.get(id) ?? 0, troop.enemyIds.length));
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
      const group = groupSize.get(enemy.id) ?? 1;
      // 부대 전체를 평타로 지우는 데 드는 타수, 부대 전체가 영웅을 쓰러뜨리는 데 드는 타수.
      const ttk = (enemy.stats.maxHp * group) / Math.max(1, basicDamage(hero.atk, enemy.stats.defense));
      const ttd = hero.hp / Math.max(1, basicDamage(enemy.stats.attack, hero.def) * group);
      const boss = enemy.rewards.exp >= 200;
      const ttkOk = boss ? ttk >= 6 && ttk <= 12 : ttk >= 3 && ttk <= 8; // 상한 8: 무리 속 탱커(돌 골렘)
      const ttdOk = boss ? ttd >= 4 && ttd <= 8 : ttd >= 3 && ttd <= 14;
      if (!ttkOk || !ttdOk) {
        violations.push(`${enemy.id} L${level} TTK ${ttk.toFixed(1)} TTD ${ttd.toFixed(1)}`);
      }
    }
    expect(violations, `밴드 이탈: ${violations.join(", ")}`).toEqual([]);
  });

  it("적 민첩은 같은 레벨 영웅의 70~80%라 게이지 턴을 실제로 받는다", () => {
    const odd = defaultBattleRecords()
      .enemies.map((e) => ({ id: e.id, ratio: e.stats.agility / heroAt(Math.max(1, e.level ?? 1)).agi }))
      .filter((r) => r.ratio < 0.7 || r.ratio > 0.8)
      .map((r) => `${r.id}(${r.ratio.toFixed(2)})`);
    expect(odd).toEqual([]);
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
