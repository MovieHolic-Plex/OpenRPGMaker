// 임시 검증용: 턴제 전투 모듈 적대적 리뷰를 위한 실측 하네스.
// 코드 수정 없이 (a) 밸런스/공식 수치를 브라우저 안에서 실제 모듈로 계산하고
// (b) 전투 테스트 창에서 모든 명령을 눌러 스크린샷 증거를 남긴다.
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("evidence/battle-review-2026-07");
fs.mkdirSync(OUT, { recursive: true });

let shotIndex = 0;
async function shot(page: Page, label: string): Promise<string> {
  shotIndex += 1;
  const file = path.join(OUT, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file });
  return file;
}

function writeJson(name: string, data: unknown): string {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return file;
}

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

test("A. 데미지 공식/밸런스 실측 스윕", async ({ page }) => {
  await openEditor(page);
  const result = await page.evaluate(async () => {
    const storeMod = await import("/src/project/store.ts");
    const actorModel = await import("/src/project/actorModel.ts");
    const battlers = await import("/src/battle/battleBattlers.ts");
    const dmg = await import("/src/battle/battleDamage.ts");
    const enemyModel = await import("/src/project/databaseEnemyTroopRecordModel.ts");
    const project: any = (storeMod as any).store.getCurrent();

    // 주인공(파티 1번) L1..L50 스탯
    const partyIds: string[] = project.session.partyActorIds;
    const heroId = partyIds[0];
    const heroRecord = actorModel.normalizeActorRecord(project.database.actors.find((a: any) => a.id === heroId));
    const statsAt = (level: number) => ({
      level,
      maxHp: actorModel.parameterValueAtLevel(heroRecord.parameterCurves.maxHp, level),
      maxMp: actorModel.parameterValueAtLevel(heroRecord.parameterCurves.maxMp, level),
      attack: actorModel.parameterValueAtLevel(heroRecord.parameterCurves.attack, level),
      defense: actorModel.parameterValueAtLevel(heroRecord.parameterCurves.defense, level),
      mind: actorModel.parameterValueAtLevel(heroRecord.parameterCurves.mind, level),
      agility: actorModel.parameterValueAtLevel(heroRecord.parameterCurves.agility, level),
    });
    const heroCurve = [1, 2, 3, 5, 10, 15, 20, 30, 50, 99].map(statsAt);

    // 장비 포함 실제 전투 진입 스탯
    const live = battlers.actorBattlers(project, { levels: Object.fromEntries(partyIds.map((id) => [id, 1])) });
    const liveStats = live.map((b: any) => ({
      id: b.id, name: b.name, level: b.level, maxHp: b.maxHp, maxMp: b.maxMp,
      attack: b.attackPower, defense: b.defense, mind: b.mind, agility: b.agility,
      chargeRate: b.chargeRate, skillIds: b.skillIds,
    }));

    const rngFixed = () => 0.5; // variance 중앙값, crit 판정 재현용
    function damage(power: number, stat: number, targetDef: number, defending = false) {
      const t: any = { hp: 99999, maxHp: 99999, mp: 0, maxMp: 0, defense: targetDef, mind: targetDef, defending, stateIds: [], stateTurns: {} };
      const u: any = { attackPower: stat, mind: stat };
      const r = dmg.applySkillLike(u, t, { power, statistic: "attack", effect: "damage", rng: rngFixed });
      return r.amount;
    }

    const hero1 = liveStats[0];
    // 적 전수 스윕: 주인공 L1 기준
    const enemies = project.database.enemies.map((raw: any) => {
      const e = enemyModel.normalizeEnemyRecord(raw);
      const s = e.stats;
      // 주인공 통상공격: power = attackPower
      const heroHit = damage(hero1.attack, hero1.attack, s.defense);
      // 적 행동: authored actions 의 skillId 로 실제 위력 결정
      const actions = (e.actions ?? []).map((a: any) => {
        const skill = project.database.skills.find((sk: any) => sk.id === a.skillId);
        const power = a.skillId ? (skill?.power ?? 12) : s.attack;
        const statistic = a.skillId ? (skill?.effect?.statistic ?? "attack") : "attack";
        const stat = statistic === "mind" ? s.mind : s.attack;
        return {
          skillId: a.skillId ?? "(평타)",
          skillName: skill?.name,
          power,
          statistic,
          dmgToHero: damage(power, stat, hero1.defense),
          dmgToHeroDefending: damage(power, stat, hero1.defense, true),
        };
      });
      const bestEnemyDmg = actions.length ? Math.max(...actions.map((a: any) => a.dmgToHero)) : 0;
      return {
        id: e.id, name: e.name, level: e.level,
        maxHp: s.maxHp, attack: s.attack, defense: s.defense, mind: s.mind, agility: s.agility,
        exp: e.rewards.exp, gold: e.rewards.gold, drop: e.rewards.dropItemId, dropPct: e.rewards.dropRatePercent,
        heroHit,
        turnsToKillEnemy: heroHit > 0 ? Math.ceil(s.maxHp / heroHit) : Infinity,
        bestEnemyDmg,
        turnsToKillHero: bestEnemyDmg > 0 ? Math.ceil(hero1.maxHp / bestEnemyDmg) : Infinity,
        actions,
        speciesId: raw.speciesId ?? null,
        elementRates: raw.elementRates ?? null,
        criticalHit: raw.criticalHit ?? null,
        actionCount: (e.actions ?? []).length,
      };
    });

    const troops = project.database.troops.map((t: any) => ({
      id: t.id, name: t.name,
      members: (t.members ?? []).map((m: any) => m.enemyId),
      enemyIds: t.enemyIds ?? [],
    }));

    return {
      projectId: project.id ?? null,
      projectName: project.name ?? null,
      battleModel: project.system.battleModel ?? null,
      battleFlow: project.system.battleFlow ?? null,
      heroId,
      heroCurve,
      liveStats,
      enemyCount: enemies.length,
      enemies,
      troops,
      skills: project.database.skills.map((s: any) => ({
        id: s.id, name: s.name, power: s.power, scope: s.scope, mpCost: s.mpCost,
        effect: s.effect, variance: s.variance, hitRate: s.hitRate, successRate: s.successRate,
        elementId: s.elementId, stateEffects: s.stateEffects,
      })),
      elements: project.database.elements ?? null,
      typeChart: project.system.typeChart ?? null,
      actorCritical: project.database.actors.map((a: any) => ({ id: a.id, critical: a.critical })),
      items: project.database.items.filter((i: any) => i.scope !== "none").map((i: any) => ({
        id: i.id, name: i.name, type: i.type, scope: i.scope, skillId: i.skillId,
        activateSkillId: i.activateSkillId, hpRecovery: i.hpRecovery, mpRecovery: i.mpRecovery,
        usableInBattle: i.usableInBattle, occasion: i.occasion,
      })).slice(0, 60),
      startInventory: project.session?.inventory ?? null,
      states: project.database.states,
    };
  });

  const file = writeJson("balance-sweep.json", result);
  // 콘솔 요약
  const e = result.enemies as any[];
  const hero = (result.liveStats as any[])[0];
  const unkillable = e.filter((x) => x.heroHit === 0 || x.heroHit === null);
  const harmless = e.filter((x) => x.bestEnemyDmg === 0);
  const both = e.filter((x) => x.bestEnemyDmg > 0 && x.heroHit > 0);
  const fair = both.filter((x) => x.turnsToKillHero <= 30);
  console.log("=== HERO L1 ===", JSON.stringify(hero));
  console.log(`enemies=${e.length} unkillable(heroHit=0)=${unkillable.length} harmless(dmg=0)=${harmless.length} both>0=${both.length} threatening(killsHeroIn<=30t)=${fair.length}`);
  console.log("threatening list:", fair.map((x) => `${x.id}(atk${x.attack} dmg${x.bestEnemyDmg} t${x.turnsToKillHero})`).join(", ") || "(NONE)");
  console.log("json:", file);
  expect(result.enemyCount).toBeGreaterThan(0);
});

async function openTroop(page: Page, troopId: string): Promise<void> {
  await page.evaluate(async (tid) => {
    const mod = await import("/src/editor/panels/testPlayModal.ts");
    await (mod as any).openTroopBattleTestModal(tid);
  }, troopId);
  await page.waitForSelector("[data-testid='battle-scene']", { timeout: 20_000 });
  await page.waitForTimeout(1200);
}

async function closeTroop(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mod = await import("/src/editor/panels/testPlayModal.ts");
    (mod as any).closeTestPlayModal();
  });
  await page.waitForTimeout(400);
}

async function partyText(page: Page): Promise<string> {
  return (await page.locator("[data-testid='battle-party']").innerText().catch(() => "")) || "";
}

async function commandList(page: Page): Promise<string[]> {
  return page.locator("[data-testid='battle-command-grid'] .battle-command").evaluateAll((els) =>
    els.map((el) => `${(el as HTMLElement).dataset.testid}|${(el as HTMLElement).innerText.replace(/\n/g, " ")}|previewOnly=${(el as HTMLElement).dataset.previewOnly ?? "no"}`)
  );
}

test("B. 실제 전투 플레이 — 명령 전수 조작", async ({ page }) => {
  const log: any = { steps: [] };
  await openEditor(page);

  for (const troopId of ["troop_slime", "troop_bat_swarm"]) {
    await openTroop(page, troopId);
    const s0 = await shot(page, `play-${troopId}-open`);
    const cmds = await commandList(page);
    const party0 = await partyText(page);
    log.steps.push({ troopId, phase: "open", commands: cmds, party: party0, shot: s0 });
    console.log(`[${troopId}] commands:`, JSON.stringify(cmds));
    console.log(`[${troopId}] party:`, party0.replace(/\n/g, " / "));

    // 클릭 횟수 측정: 공격 → 대상선택
    const clicks: string[] = [];
    await page.locator("[data-testid='actor-command-attack']").click();
    clicks.push("actor-command-attack");
    await page.waitForTimeout(400);
    const targetBtns = await page.locator("[data-testid^='battle-target-']").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid));
    const s1 = await shot(page, `play-${troopId}-target-select`);
    log.steps.push({ troopId, phase: "targetSelect", targets: targetBtns, shot: s1 });
    console.log(`[${troopId}] targets:`, JSON.stringify(targetBtns));

    const firstTarget = targetBtns.find((t) => t && t !== "battle-target-cancel");
    if (firstTarget) {
      await page.locator(`[data-testid='${firstTarget}']`).click();
      clicks.push(firstTarget);
    }
    await page.waitForTimeout(1800);
    const s2 = await shot(page, `play-${troopId}-after-attack`);
    const sceneText = await page.locator("[data-testid='battle-scene']").innerText();
    log.steps.push({ troopId, phase: "afterAttack", clicksToOneAttack: clicks.length, scene: sceneText, party: await partyText(page), shot: s2 });
    console.log(`[${troopId}] clicks for 1 attack = ${clicks.length}; scene after attack:\n${sceneText}`);

    // 남은 명령 확인(스킬/아이템/방어/도주) — 살아있으면
    const stillFighting = await page.locator("[data-testid='battle-command-grid']").count();
    if (stillFighting > 0) {
      for (const id of ["actor-command-skill", "actor-command-item", "actor-command-defend", "actor-command-escape"]) {
        const n = await page.locator(`[data-testid='${id}']`).count();
        if (n === 0) { console.log(`[${troopId}] ${id}: ABSENT`); continue; }
        const info = await page.locator(`[data-testid='${id}']`).evaluate((el) => ({
          text: (el as HTMLElement).innerText.replace(/\n/g, " "),
          previewOnly: (el as HTMLElement).dataset.previewOnly ?? "no",
          disabled: (el as HTMLButtonElement).disabled,
        }));
        console.log(`[${troopId}] ${id}:`, JSON.stringify(info));
        log.steps.push({ troopId, phase: "commandProbe", id, info });
      }
      // 스킬 서브메뉴 열어보기
      if (await page.locator("[data-testid='actor-command-skill']").count()) {
        await page.locator("[data-testid='actor-command-skill']").click();
        await page.waitForTimeout(400);
        const sk = await page.locator("[data-testid^='actor-skill-']").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.testid}|${(e as HTMLElement).innerText.replace(/\n/g, " ")}`));
        const s3 = await shot(page, `play-${troopId}-skill-menu`);
        console.log(`[${troopId}] skill menu:`, JSON.stringify(sk));
        log.steps.push({ troopId, phase: "skillMenu", skills: sk, shot: s3 });
        if (await page.locator("[data-testid='actor-command-back']").count()) await page.locator("[data-testid='actor-command-back']").click();
        await page.waitForTimeout(300);
      }
      // 아이템 서브메뉴
      if (await page.locator("[data-testid='actor-command-item']").count()) {
        await page.locator("[data-testid='actor-command-item']").click();
        await page.waitForTimeout(400);
        const it = await page.locator("[data-testid^='actor-item-']").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.testid}|${(e as HTMLElement).innerText.replace(/\n/g, " ")}`));
        const s4 = await shot(page, `play-${troopId}-item-menu`);
        console.log(`[${troopId}] item menu:`, JSON.stringify(it));
        log.steps.push({ troopId, phase: "itemMenu", items: it, shot: s4 });
      }
    } else {
      console.log(`[${troopId}] battle already over after 1 attack (command grid gone)`);
      log.steps.push({ troopId, phase: "over-after-1-attack" });
      const s5 = await shot(page, `play-${troopId}-result`);
      const resultText = await page.locator("[data-testid='battle-scene']").innerText().catch(() => "(no scene)");
      console.log(`[${troopId}] result panel:\n${resultText}`);
      log.steps.push({ troopId, phase: "result", text: resultText, shot: s5 });
    }
    await closeTroop(page);
  }
  console.log("json:", writeJson("play-log.json", log));
});
