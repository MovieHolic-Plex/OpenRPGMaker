import { describe, expect, it, beforeAll } from "vitest";
import { computeSwingDamage } from "@/battle/action/combatMath";
import { normalizeEnemyActionProfile } from "@/project/actionCombat";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { readFileSync, existsSync } from "node:fs";
import { PNG } from "pngjs";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PIXEL_ENEMY_SHEETS, pixelEnemyCell } from "@/assets/pixelEnemySheets";
import { pixelEnemyPortraitPath } from "@/assets/pixelEnemyPortraits";
import { createBlankProject } from "@/project/defaults/blankProject";
import { actorBattlers } from "@/battle/battleBattlers";
import { isolateTimers } from "./mergedTeardown";

describe("actionEnemyAuthoring", () => {
  isolateTimers();
  // 광산 1층(map_mine_1f)이 스폰하는 적 + 원거리 적의 액션 프로필 저작 계약.
  // 정규화를 통과한 레코드가 의도한 공격 kind 와 0 이상의 데미지를 유지하고,
  // 기본 주인공(공격력 45, 보너스 0)의 조준 스윙으로 죽이려면 3~8방이 필요해야 한다.
  // rand = () => 0.5 는 variance 1.0 (분산 없음) 이므로 계산이 결정적이다.

  const NO_VARIANCE = () => 0.5;
  const DEFAULT_PLAYER_ATTACK = 45;
  const SWING_BONUS = 0;
  function findEnemy(id: string) {
    const enemy = defaultBattleRecords().enemies.find((e) => e.id === id);
    expect(enemy, `${id} 레코드가 기본 DB 에 있어야 한다`).toBeTruthy();
    return enemy!;
  }
  function swingsToKill(maxHp: number, defense: number): number {
    let hp = maxHp;
    let swings = 0;
    while (hp > 0 && swings < 1000) {
      hp -= computeSwingDamage({
        attackerAttack: DEFAULT_PLAYER_ATTACK,
        defenderDefense: defense,
        bonus: SWING_BONUS,
        rand: NO_VARIANCE,
      });
      swings += 1;
    }
    return swings;
  }
  describe("광산 적 액션 프로필 저작", () => {
    it("동굴 박쥐 — 빠른 근접 공격 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
      const raw = findEnemy("enemy_cave_bat");
      expect(raw.stats.maxHp).toBeGreaterThan(25); // 리밸런스: 원래 25 는 한방 컷이었다
      const profile = normalizeEnemyActionProfile(raw.actionProfile);
      expect(profile).toBeTruthy();
      expect(profile!.attack!.kind).toBe("melee");
      expect(profile!.attack!.damage).toBeGreaterThan(0);
      // 빠른 근접: 짧은 선딜
      expect(profile!.attack!.windupMs).toBeLessThan(500);
      expect(profile!.contactDamage).toBeGreaterThan(0);
      expect(profile!.aggroRange).toBeGreaterThan(0);
      expect(profile!.moveIntervalMs).toBeGreaterThan(0);
      expect(profile!.knockbackResist).toBeGreaterThanOrEqual(0);

      const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
      expect(swings).toBeGreaterThanOrEqual(3);
      expect(swings).toBeLessThanOrEqual(8);
    });

    it("돌 골렘 — 무거운 근접 공격(긴 선딜/높은 데미지) 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
      const raw = findEnemy("enemy_stone_golem");
      expect(raw.stats.maxHp).toBeGreaterThan(30); // 리밸런스: 원래 30
      const profile = normalizeEnemyActionProfile(raw.actionProfile);
      expect(profile).toBeTruthy();
      expect(profile!.attack!.kind).toBe("melee");
      expect(profile!.attack!.damage).toBeGreaterThan(0);
      // 무거운 근접: 긴 선딜(텔레그래프) + 박쥐보다 높은 데미지
      expect(profile!.attack!.windupMs).toBeGreaterThanOrEqual(900);
      expect(profile!.attack!.damage).toBeGreaterThan(14);
      expect(profile!.contactDamage).toBeGreaterThan(0);
      expect(profile!.knockbackResist).toBeGreaterThan(0); // 무거워서 밀리지 않는다

      const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
      expect(swings).toBeGreaterThanOrEqual(3);
      expect(swings).toBeLessThanOrEqual(8);
    });

    it("광산 해골 궁수 — 투사체 공격 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
      const raw = findEnemy("enemy_mine_skel_archer");
      const profile = normalizeEnemyActionProfile(raw.actionProfile);
      expect(profile).toBeTruthy();
      expect(profile!.attack!.kind).toBe("projectile");
      expect(profile!.attack!.damage).toBeGreaterThan(0);
      expect(profile!.attack!.range).toBeGreaterThan(1); // 근접 부채꼴보다 먼 사거리
      expect(profile!.contactDamage).toBeGreaterThan(0);
      expect(profile!.aggroRange).toBeGreaterThan(0);
      expect(profile!.moveIntervalMs).toBeGreaterThan(0);

      const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
      expect(swings).toBeGreaterThanOrEqual(3);
      expect(swings).toBeLessThanOrEqual(8);
    });

    it("적 타격 데미지가 기본 주인공(maxHp 514)에게 의미 있어야 한다 — 안 피하면 60초 안에 죽는다", () => {
      // 순수 산수 검증: 각 적의 (공격 사이클 데미지)가 유의미한 비중이어야 한다.
      const bat = normalizeEnemyActionProfile(findEnemy("enemy_cave_bat").actionProfile)!;
      const golem = normalizeEnemyActionProfile(findEnemy("enemy_stone_golem").actionProfile)!;
      const archer = normalizeEnemyActionProfile(findEnemy("enemy_mine_skel_archer").actionProfile)!;
      // 박쥐 사이클: windup+recover+cooldown 동안 damage 한 방.
      const batDps = (bat.attack!.damage + bat.contactDamage!) / ((bat.attack!.windupMs + bat.attack!.recoverMs + bat.attack!.cooldownMs!) / 1000);
      // 골렘은 텔레그래프가 길지만 한 방이 무겁다.
      const golemDps = (golem.attack!.damage + golem.contactDamage!) / ((golem.attack!.windupMs + golem.attack!.recoverMs + golem.attack!.cooldownMs!) / 1000);
      // 궁수는 원거리에서 사격.
      const archerDps = (archer.attack!.damage + archer.contactDamage!) / ((archer.attack!.windupMs + archer.attack!.recoverMs + archer.attack!.cooldownMs!) / 1000);
      // 어떤 적이든 계속 붙어 있으면 60초 안에 514 를 깎을 수 있어야 한다 → 평균 DPS >= 9.
      expect(batDps).toBeGreaterThanOrEqual(9);
      expect(golemDps).toBeGreaterThanOrEqual(9);
      expect(archerDps).toBeGreaterThanOrEqual(9);
    });
  });
});

describe("generatedEnemyBattlers", () => {
  isolateTimers();
  /** 알파 0 화소의 RGB 를 0 으로 맞춘 사본 — 투명 칸에 남은 RGB 찌꺼기를 비교에서 뺀다. */
  function visibleBytes(rgba: Buffer): Buffer {
    const out = Buffer.from(rgba);
    for (let i = 0; i < out.length; i += 4) if (out[i + 3] === 0) out.fill(0, i, i + 3);
    return out;
  }
  describe("native enemy battler files", () => {
    it("resolves every registered generated enemy to an existing public image", () => {
      const ids = builtinGeneratedResourceIds().filter((id) => id.startsWith("generated-enemy-"));
      expect(ids.length).toBeGreaterThanOrEqual(140);
      for (const id of ids) {
        const url = resolveAssetResourceUrl(id);
        expect(url, id).not.toBeNull();
        expect(existsSync(`public${url}`), `${id} -> ${url}`).toBe(true);
        expect(url).not.toContain("/starter/monster-");
        expect(url).not.toContain("/generated/monsters/");
      }
    });

    it("uses one exact idle cell for whole-image consumers rather than exposing a pose grid", () => {
      for (const sheet of PIXEL_ENEMY_SHEETS) {
        const cell = pixelEnemyCell(sheet);
        const source = PNG.sync.read(readFileSync(`public/${sheet.path}`));
        const portraitPath = pixelEnemyPortraitPath(sheet);
        const portrait = PNG.sync.read(readFileSync(`public/${portraitPath}`));
        expect(resolveAssetResourceUrl(sheet.resourceId)).toBe(`/${portraitPath}`);
        expect([source.width, source.height]).toEqual([cell * 3, cell * 3]);
        expect([portrait.width, portrait.height]).toEqual([cell, cell]);
        // 완전 투명 칸의 RGB 는 그림이 아니다 — 다시 그린 시트(#2931 등)와 초상은 투명 칸 RGB 가 다르게 저장됐다. 보이는 화소만 같아야 한다.
        for (let y = 0; y < cell; y++) {
          expect(visibleBytes(portrait.data.subarray(y * cell * 4, (y + 1) * cell * 4)).equals(
            visibleBytes(source.data.subarray(y * source.width * 4, (y * source.width + cell) * 4)),
          ), sheet.resourceId).toBe(true);
        }
      }
    });

    it("retains named saved-project aliases without recreating the numeric filler pool", () => {
      expect(resolveAssetResourceUrl("generated-enemy-zombie-01-enemy_extra_016")).toBe(resolveAssetResourceUrl("generated-enemy-zombie-01"));
      expect(resolveAssetResourceUrl("generated-enemy-skeleton-01-enemy_extra_038")).toBe(resolveAssetResourceUrl("generated-enemy-skeleton-01"));
      expect(resolveAssetResourceUrl("enemy_extra_016")).toBeNull();
      expect(defaultBattleRecords().enemies.filter((enemy) => /^enemy_extra_\d+$/.test(enemy.id))).toEqual([]);
    });

    it("gives every common default enemy a registered resource", () => {
      const registered = new Set(builtinGeneratedResourceIds());
      const missing = defaultBattleRecords().enemies
        .filter((enemy) => enemy.monsterResourceId && !registered.has(enemy.monsterResourceId))
        .map((enemy) => `${enemy.id} -> ${enemy.monsterResourceId}`);
      expect(missing).toEqual([]);
    });

    it("uses the already selected collect-species sprite for sparkit-fire", () => {
      expect(resolveAssetResourceUrl("generated-enemy-sparkit-fire")).toBe("/assets/harnesses/monster-collect-species/sparkit/front.png");
    });
  });
});

describe("monsterRebalanceBands", () => {
  isolateTimers();
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
  beforeAll(() => {
    for (const troop of project.database.troops) {
      for (const id of troop.enemyIds) groupSize.set(id, Math.max(groupSize.get(id) ?? 0, troop.enemyIds.length));
    }
  });
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
});
