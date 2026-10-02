// 임시 검증용: 턴제 전투 메커니즘 실측(턴순서/치명타/방어/도주/버프/속성/상태이상/보상).
// 브라우저 안에서 실제 전투 모듈을 import 해 결정적 rng 로 수치를 뽑는다. src/ 는 건드리지 않는다.
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("evidence/battle-review-2026-07");
fs.mkdirSync(OUT, { recursive: true });

async function openEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(async () => {
    try {
      const mod = await import("/src/project/store.ts");
      return Boolean((mod as any).store?.getCurrent()?.database?.enemies?.length);
    } catch {
      return false;
    }
  }, undefined, { timeout: 60_000 });
}

test.setTimeout(300_000);

test("C. 메커니즘 실측", async ({ page }) => {
  await openEditor(page);
  const out = await page.evaluate(async () => {
    const storeMod = await import("/src/project/store.ts");
    const rtMod = await import("/src/battle/runtime.ts");
    const dmgMod = await import("/src/battle/battleDamage.ts");
    const battlersMod = await import("/src/battle/battleBattlers.ts");
    const rngMod = await import("/src/util/rng.ts");
    const project: any = (storeMod as any).store.getCurrent();
    const report: any = {};
    const hero = battlersMod.actorBattlers(project, {})[0];

    // C1. 충전 속도 / 턴 순서
    const troop = project.database.troops.find((t: any) => t.id === "troop_bat_swarm");
    const enemies = battlersMod.enemyBattlers(project, troop);
    report.chargeRates = {
      hero: { agility: hero.agility, chargeRate: hero.chargeRate, msToReady: 100 / hero.chargeRate },
      enemy: { agility: enemies[0].agility, chargeRate: enemies[0].chargeRate, msToReady: 100 / enemies[0].chargeRate },
      ratio: (100 / enemies[0].chargeRate) / (100 / hero.chargeRate),
    };
    report.chargeFloorProbe = [1, 2, 4, 6, 8, 8.6, 9, 10, 20, 45].map((agi) => {
      const rate = Math.max(0.02, agi * (0.1 / 43));
      return { agility: agi, chargeRate: rate, flooredByMin: rate === 0.02 };
    });

    // 실제 런타임 tick — 아군은 방어만(전투가 안 끝나게), 행동 순서 관찰
    {
      const rng = rngMod.mulberry32(1234);
      const rt = rtMod.createBattleRuntime({
        project, troopId: "troop_bat_swarm", canEscape: false, canLose: true,
        party: { levels: {}, experience: {} },
        sessionState: { switches: {}, variables: {}, inventory: {} },
        rng,
      } as any);
      let prompts = 0;
      for (let i = 0; i < 6000; i += 1) {
        const s = rt.snapshot();
        if (s.result) break;
        if (s.phase === "actorCommand") { prompts += 1; rt.performActorCommand({ kind: "defend" } as any); continue; }
        rt.tick(16);
      }
      const logs = rt.snapshot().actionLog as any[];
      const enemyIds = new Set(project.database.enemies.map((e: any) => e.id));
      const seq = logs.map((l) => (enemyIds.has(l.userRecordId) ? "E" : "A")).join("");
      report.actionSequence = {
        actorPrompts: prompts,
        loggedActions: logs.length,
        first80: seq.slice(0, 80),
        actorCount: (seq.match(/A/g) ?? []).length,
        enemyCount: (seq.match(/E/g) ?? []).length,
        finalResult: rt.snapshot().result ?? null,
        turn: rt.snapshot().turn,
      };
    }

    // C2. 치명타 빈도 + 통상공격 데미지 분산
    {
      const rng = rngMod.mulberry32(99);
      const critRate = 100 / (project.database.actors.find((a: any) => a.id === hero.recordId)?.critical?.chanceDenominator ?? 0);
      const amounts: number[] = [];
      let crits = 0;
      for (let i = 0; i < 2000; i += 1) {
        const t: any = { hp: 1e9, maxHp: 1e9, mp: 0, maxMp: 0, defense: 5, mind: 5, defending: false, stateIds: [], stateTurns: {} };
        const r = dmgMod.applySkillLike({ attackPower: hero.attackPower, mind: hero.mind } as any, t, {
          power: hero.attackPower, statistic: "attack", effect: "damage", criticalRate: critRate, hitRate: 100, rng,
        } as any);
        amounts.push(r.amount); if (r.critical) crits += 1;
      }
      report.normalAttack = {
        declaredCritRatePct: critRate,
        observedCritPct: (crits / 2000) * 100,
        distinctDamageValues: [...new Set(amounts)].sort((a, b) => a - b),
      };
    }

    // C3. 방어의 실효
    {
      const skill = project.database.skills.find((s: any) => s.id === "skill_attack");
      report.defendValue = ["enemy_slime", "enemy_cave_bat", "enemy_ghost_pale", "enemy_demon_lord"].map((id) => {
        const e = project.database.enemies.find((x: any) => x.id === id);
        const mk = (defending: boolean) => {
          const t: any = { hp: 1e9, maxHp: 1e9, mp: 0, maxMp: 0, defense: hero.defense, mind: hero.mind, defending, stateIds: [], stateTurns: {} };
          return dmgMod.applySkillLike({ attackPower: e.stats.attack, mind: e.stats.mind } as any, t, {
            power: skill.power, statistic: "attack", effect: "damage", hitRate: 100, rng: () => 0.5,
          } as any).amount;
        };
        return { enemyId: id, enemyAttack: e.stats.attack, skillPowerUsed: skill.power, open: mk(false), defending: mk(true) };
      });
    }

    // C4. 도주 확률(런타임 공식 그대로)
    report.escape = {
      heroAgility: hero.agility,
      enemyAgility: 10,
      chance: Math.min(0.95, 0.5 + ((hero.agility - 10) / 10) * 0.25),
    };

    // C5. 집중(공격 상승 x2) 의 실제 증가분
    {
      const mk = (mult: number) => {
        const t: any = { hp: 1e9, maxHp: 1e9, mp: 0, maxMp: 0, defense: 5, mind: 5, defending: false, stateIds: [], stateTurns: {} };
        return dmgMod.applySkillLike({ attackPower: hero.attackPower, mind: hero.mind } as any, t, {
          power: hero.attackPower, statistic: "attack", effect: "damage", hitRate: 100, attackerStatMultiplier: mult, rng: () => 0.5,
        } as any).amount;
      };
      report.attackUp = { base: mk(1), withX2: mk(2), ifTrulyDoubled: mk(1) * 2, actualGainPct: Math.round(((mk(2) / mk(1)) - 1) * 1000) / 10 };
    }

    // C6. 속성/타입 상성
    {
      const tc = await import("/src/battle/typeChart.ts");
      report.elements = {
        typeChartTypes: project.system.typeChart?.types ?? null,
        elementIdsInDb: (project.database.elements ?? []).map((e: any) => e.id),
        overlapBetweenElementsAndTypeChart: (project.database.elements ?? [])
          .map((e: any) => e.id)
          .filter((id: string) => (project.system.typeChart?.types ?? []).includes(id)),
        heroTypes: tc.battlerTypes(project, hero as any),
        sample: ["enemy_slime", "enemy_cave_bat", "enemy_ghost_pale"].map((id) => {
          const raw = project.database.enemies.find((e: any) => e.id === id);
          return {
            id,
            speciesId: raw.speciesId ?? null,
            types: tc.monsterTypesForRecord(project, id),
            fireGrade: raw.elementRates?.fire ?? null,
            fireTypeChartMultiplier: tc.typeChartMultiplierFor(project, "fire", "actor_hero", id),
          };
        }),
        monsterCollectionEnabled: project.system.monsterCollection === true,
      };
    }

    // C7. 실전 시뮬레이션 (트룹별 200회)
    {
      const sim = await import("/src/battle/simulate.ts");
      report.simulations = project.database.troops.map((t: any) => {
        const r = sim.simulateBattle({ project, troopId: t.id, heroLevel: 1, n: 200, seed: 7 } as any);
        return {
          troopId: t.id, name: t.name, winRate: r.winRate, avgTurns: r.avgTurns,
          avgHpRemaining: r.avgHpRemaining, heroMaxHp: hero.maxHp, rewards: r.firstRewards,
        };
      });
    }

    // C8. 상태이상 부여 경로 존재 여부
    {
      const skillOf = (id: string) => project.database.skills.find((s: any) => s.id === id);
      report.states = {
        stateRecordIds: project.database.states.map((s: any) => s.id),
        enemiesThatCanInflictStates: project.database.enemies.filter((e: any) =>
          (e.actions ?? []).some((a: any) => ((skillOf(a.skillId)?.stateEffects) ?? []).length > 0)).length,
        totalEnemies: project.database.enemies.length,
        heroL1SkillsWithStateEffects: hero.skillIds.filter((id: string) => ((skillOf(id)?.stateEffects) ?? []).length > 0),
        enemiesWithStateRates: project.database.enemies.filter((e: any) => e.stateRates && Object.keys(e.stateRates).length > 0).length,
      };
    }

    // C9. 스킨
    {
      const skins: any = await import("/src/battle/skins/registry.ts");
      const list = skins.battleSkins ?? skins.BATTLE_SKINS ?? skins.battleSkinList ?? null;
      report.skins = Array.isArray(list)
        ? list.map((s: any) => ({ id: s.id, name: s.name, layout: s.layout }))
        : { exportedKeys: Object.keys(skins) };
      report.activeSkinId = project.system.battleSkinId ?? null;
      report.battleFlow = project.system.battleFlow ?? null;
    }

    // C10. 레벨업 체감
    {
      const am = await import("/src/project/actorModel.ts");
      const rec = am.normalizeActorRecord(project.database.actors.find((a: any) => a.id === hero.recordId));
      report.levelUp = {
        expCurve: rec.expCurve,
        expForL2: am.totalExpForLevel(rec.expCurve, 2),
        expForL5: am.totalExpForLevel(rec.expCurve, 5),
        statDeltaL1toL2: {
          maxHp: am.parameterValueAtLevel(rec.parameterCurves.maxHp, 2) - am.parameterValueAtLevel(rec.parameterCurves.maxHp, 1),
          attack: am.parameterValueAtLevel(rec.parameterCurves.attack, 2) - am.parameterValueAtLevel(rec.parameterCurves.attack, 1),
          defense: am.parameterValueAtLevel(rec.parameterCurves.defense, 2) - am.parameterValueAtLevel(rec.parameterCurves.defense, 1),
          agility: am.parameterValueAtLevel(rec.parameterCurves.agility, 2) - am.parameterValueAtLevel(rec.parameterCurves.agility, 1),
        },
        battlesToL2_slimeTroop: Math.ceil(am.totalExpForLevel(rec.expCurve, 2) / 5),
        battlesToL2_batTroop: Math.ceil(am.totalExpForLevel(rec.expCurve, 2) / 27),
      };
    }
    return report;
  });
  fs.writeFileSync(path.join(OUT, "mechanics.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
  expect(out).toBeTruthy();
});
