// 임시 진단용(적대적 "게임 재미" 감사): 턴제 전투의 연출/효과음/스킬 체감을 실측한다.
// 코드를 고치지 않고 (a) 한 번의 공격 시퀀스를 프레임 단위로 촬영해 필름스트립을 만들고
// (b) 그 동안 발생한 오디오 이벤트(샘플 재생 + WebAudio 합성 보이스)를 시각별로 기록하고
// (c) 데미지/크리티컬/상태이상 수치를 브라우저 안의 실제 모듈로 스윕한다.
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  seedReferenceBattleProject,
  startReferenceBattle,
  waitForActorCommand,
  confirmBattleTarget,
} from "./battleReferenceProject";

const OUT = path.resolve("evidence/battle-feel-audit-2026-08-29");
fs.mkdirSync(OUT, { recursive: true });

test.setTimeout(300_000);

function writeJson(name: string, data: unknown): void {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2), "utf8");
}

/** 오디오 계측 + 씬 속성 타임라인 프로브. 페이지 로드 전에 심는다. */
async function installProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __feelAudio: { t: number; kind: string; detail: string }[];
      __feelT0: number;
    };
    // 초보 모드에서는 일부 도구막대/버튼이 DOM 에 없다 — 프로브는 전문가 모드로 본다.
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    w.__feelAudio = [];
    w.__feelT0 = performance.now();
    const NativeAudio = window.Audio;
    // 샘플 재생(new Audio(url).play()) 계측 — battleJuice / 애니메이션 타이밍 사운드.
    // @ts-expect-error 진단용 덮어쓰기
    window.Audio = function PatchedAudio(src?: string) {
      const audio = new NativeAudio(src);
      const originalPlay = audio.play.bind(audio);
      audio.play = () => {
        w.__feelAudio.push({
          t: Math.round(performance.now() - w.__feelT0),
          kind: "sample",
          detail: (audio.src || src || "").split("/").pop() ?? "",
        });
        return originalPlay();
      };
      return audio;
    } as unknown as typeof window.Audio;
    // 합성음(battleSfx.ts) 계측 — 오실레이터/노이즈 보이스 생성 시각.
    if (typeof AudioContext !== "undefined") {
      const osc = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function patched() {
        w.__feelAudio.push({ t: Math.round(performance.now() - w.__feelT0), kind: "synth-osc", detail: "oscillator" });
        return osc.call(this);
      };
      const buf = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function patched() {
        w.__feelAudio.push({ t: Math.round(performance.now() - w.__feelT0), kind: "synth-noise", detail: "bufferSource" });
        return buf.call(this);
      };
    }
  });
}

type SceneState = {
  t: number;
  phase: string;
  step: string;
  hitFeel: string;
  busy: string;
  classes: string;
  message: string;
  popups: string[];
  animation: string | null;
  animFrame: string | null;
  userMotion: string | null;
  targetMotion: string | null;
};

async function readSceneState(page: Page): Promise<SceneState> {
  return page.evaluate(() => {
    const w = window as unknown as { __feelT0: number };
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const anim = scene?.querySelector<HTMLElement>("[data-testid='battle-animation']") ?? null;
    const lunge = scene?.querySelector<HTMLElement>(".battle-motion-lunge, [class*='lunge']") ?? null;
    const knock = scene?.querySelector<HTMLElement>("[class*='knockback']") ?? null;
    return {
      t: Math.round(performance.now() - w.__feelT0),
      phase: scene?.dataset.battlePhase ?? "",
      step: scene?.dataset.battleDirectorStep ?? "",
      hitFeel: scene?.dataset.battleHitFeel ?? "",
      busy: scene?.dataset.battleSequenceBusy ?? "",
      classes: scene?.className ?? "",
      message: scene?.querySelector("[data-testid='battle-message']")?.textContent?.trim() ?? "",
      popups: Array.from(scene?.querySelectorAll("[data-testid^='battle-damage']") ?? []).map(
        (node) => node.textContent?.trim() ?? "",
      ),
      animation: anim?.dataset.animationName ?? anim?.dataset.animationId ?? null,
      animFrame: anim?.dataset.currentFrame ?? null,
      userMotion: lunge?.className ?? null,
      targetMotion: knock?.className ?? null,
    };
  });
}

test("A. 공격 시퀀스 필름스트립 + 오디오 레이어 실측", async ({ page }) => {
  await installProbe(page);
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);
  await waitForActorCommand(page);

  const scene = page.getByTestId("battle-scene");
  await scene.screenshot({ path: path.join(OUT, "10-command-menu.png") });

  // 대상 선택 화면
  await page.getByTestId("actor-command-attack").click();
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  await scene.screenshot({ path: path.join(OUT, "11-target-select.png") });

  // 오디오 로그를 시퀀스 직전에 리셋한다.
  await page.evaluate(() => {
    const w = window as unknown as { __feilAudio?: unknown; __feelAudio: unknown[]; __feelT0: number };
    w.__feelAudio.length = 0;
    w.__feelT0 = performance.now();
  });

  await confirmBattleTarget(page);

  // 시퀀스 동안 고속 촬영 — 각 컷에 씬 상태를 붙인다.
  const strip: SceneState[] = [];
  for (let i = 0; i < 26; i += 1) {
    const state = await readSceneState(page);
    strip.push(state);
    await scene.screenshot({ path: path.join(OUT, `seq-${String(i).padStart(2, "0")}.png`) });
    if (i > 4 && state.busy === "false") break;
  }
  await expect(scene).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 });
  const audio = await page.evaluate(() => (window as unknown as { __feelAudio: unknown[] }).__feelAudio);
  writeJson("sequence-filmstrip.json", strip);
  writeJson("sequence-audio.json", audio);

  // 두 번째 공격에서 크리티컬/일반 팝업 값을 모으기 위해 몇 턴 더 돌린다.
  const damageLog: string[][] = [];
  for (let turn = 0; turn < 5; turn += 1) {
    await waitForActorCommand(page);
    await page.getByTestId("actor-command-attack").click();
    if ((await scene.getAttribute("data-battle-phase")) === "targetSelect") await confirmBattleTarget(page);
    await expect(scene).toHaveAttribute("data-battle-director-step", /acting|impact|result/, { timeout: 10_000 });
    const seen = new Set<string>();
    for (let i = 0; i < 14; i += 1) {
      const state = await readSceneState(page);
      for (const popup of state.popups) if (popup) seen.add(popup);
      if (state.busy === "false" && i > 3) break;
    }
    damageLog.push([...seen]);
    if (await page.getByTestId("battle-result-panel").count()) break;
  }
  writeJson("damage-popups.json", damageLog);
  await scene.screenshot({ path: path.join(OUT, "20-after-turns.png") });
});

test("B. 수치 스윕 — 데미지/크리티컬/상태/적 AI", async ({ page }) => {
  await installProbe(page);
  await seedReferenceBattleProject(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(async () => {
    try {
      const mod = await import("/src/project/store.ts");
      return Boolean((mod as { store?: { getCurrent(): { database?: { enemies?: unknown[] } } } }).store?.getCurrent()?.database?.enemies?.length);
    } catch {
      return false;
    }
  }, undefined, { timeout: 60_000 });

  const data = await page.evaluate(async () => {
    const dmg = await import("/src/battle/battleDamage.ts");
    const storeMod = await import("/src/project/store.ts");
    const battlers = await import("/src/battle/battleBattlers.ts");
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const project: any = (storeMod as any).store.getCurrent();
    const applySkillLike: any = (dmg as any).applySkillLike;

    function roll(power: number, stat: number, def: number, critRate: number, critMult: number, variance: number, rngValues: number[]) {
      let i = 0;
      const rng = () => rngValues[i++ % rngValues.length];
      const target: any = { hp: 1e9, maxHp: 1e9, mp: 0, maxMp: 0, defense: def, mind: def, defending: false, stateIds: [], stateTurns: {} };
      const user: any = { attackPower: stat, mind: stat };
      return applySkillLike(user, target, {
        power, statistic: "attack", effect: "damage", rng,
        criticalRate: critRate, criticalMultiplier: critMult, variance,
      });
    }

    // 1) 통상공격 분포 — 기본 분산 10%, 크리 4%/×1.5
    const party = battlers.actorBattlers(project, {});
    const hero = party[0];
    const enemy = project.database.enemies[0];
    const enemyDef = enemy?.stats?.defense ?? 8;
    const samples: number[] = [];
    const crits: number[] = [];
    for (let n = 0; n < 4000; n += 1) {
      // rng 호출 순서: 명중 → 분산 → 크리티컬
      const rngValues = [Math.random(), Math.random(), Math.random()];
      const out = roll(hero.attackPower, hero.attackPower, enemyDef, 4, 1.5, 10, rngValues);
      samples.push(out.amount);
      if (out.critical) crits.push(out.amount);
    }
    samples.sort((a, b) => a - b);
    const nonCritMax = Math.max(...samples.filter((_v, idx) => idx < samples.length * 0.9));

    // 2) 크리티컬 겹침 — 일반 최대와 크리 최소가 겹치는가
    const normal: number[] = [];
    const critical: number[] = [];
    for (let n = 0; n < 4000; n += 1) {
      const rngValues = [0.5, Math.random(), 0.99]; // 크리 실패
      normal.push(roll(hero.attackPower, hero.attackPower, enemyDef, 4, 1.5, 10, rngValues).amount);
      const critVals = [0.5, Math.random(), 0.0]; // 크리 성공
      critical.push(roll(hero.attackPower, hero.attackPower, enemyDef, 4, 1.5, 10, critVals).amount);
    }

    // 3) 방어 뺄셈식의 스케일 — 적 방어가 오를 때 데미지
    const defenseCurve = [0, 4, 8, 16, 32, 64, 128].map((def) => ({
      def,
      dmg: roll(hero.attackPower, hero.attackPower, def, 0, 1, 0, [0.5, 0.5, 0.99]).amount,
    }));

    // 3b) 적 → 아군 데미지(참조 전투의 실제 위협도)
    const enemyToHero = (() => {
      const target: any = { hp: hero.maxHp, maxHp: hero.maxHp, mp: 0, maxMp: 0, defense: hero.defense, mind: hero.mind, defending: false, stateIds: [], stateTurns: {} };
      const user: any = { attackPower: enemy?.stats?.attack ?? 12, mind: enemy?.stats?.mind ?? 9 };
      let i = 0;
      const rng = () => [0.5, 0.5, 0.99][i++ % 3];
      const out = applySkillLike(user, target, { power: enemy?.stats?.attack ?? 12, statistic: "attack", effect: "damage", rng });
      return { amount: out.amount, heroDefense: hero.defense, heroHp: hero.maxHp, turnsToKillHero: out.amount > 0 ? Math.ceil(hero.maxHp / out.amount) : Infinity };
    })();

    // 4) TTK — 기본 파티 통상공격으로 참조 적을 잡는 턴 수
    const enemyHp = enemy?.stats?.maxHp ?? 220;
    const median = roll(hero.attackPower, hero.attackPower, enemyDef, 0, 1, 0, [0.5, 0.5, 0.99]).amount;
    const ttk = Math.ceil(enemyHp / Math.max(1, median * party.length));

    // 5) 기본 DB 콘텐츠 다양성
    const skills = project.database.skills ?? [];
    const species = project.database.monsterSpecies ?? [];
    const enemies = project.database.enemies ?? [];
    const anims = project.database.battleAnimations ?? [];
    const states = project.database.states ?? [];
    const content = {
      skillCount: skills.length,
      skillEffectKinds: Object.entries(
        skills.reduce((acc: any, s: any) => { const k = s.effect?.kind ?? "?"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}),
      ),
      skillsWithStateEffects: skills.filter((s: any) => (s.stateEffects ?? []).length > 0).length,
      skillsMultiTarget: skills.filter((s: any) => /all|screen/i.test(String(s.scope))).length,
      animationCount: anims.length,
      animationsWithShake: anims.filter((a: any) => (a.timings ?? []).some((t: any) => t.screenShake)).length,
      animationsWithSound: anims.filter((a: any) => (a.timings ?? []).some((t: any) => t.soundResourceId)).length,
      stateCount: states.length,
      speciesCount: species.length,
      speciesTypes: [...new Set(species.flatMap((s: any) => s.types ?? []))],
      speciesMoveCounts: species.map((s: any) => (s.skillsByLevel ?? []).length),
      enemyCount: enemies.length,
      enemyActionCounts: enemies.map((e: any) => ({ name: e.name, actions: (e.actions ?? []).length, skills: (e.actions ?? []).filter((a: any) => a.skillId).length })),
      enemiesWithConditionalActions: enemies.filter((e: any) => (e.actions ?? []).some((a: any) => a.condition?.kind && a.condition.kind !== "always")).length,
    };

    return {
      heroStats: { attack: hero.attackPower, defense: hero.defense, maxHp: hero.maxHp, level: hero.level, party: party.length },
      enemy: { name: enemy?.name, hp: enemyHp, def: enemyDef, atk: enemy?.stats?.attack },
      attackDistribution: {
        min: samples[0], p50: samples[Math.floor(samples.length / 2)], max: samples[samples.length - 1],
        critShare: crits.length / 4000, nonCritMax,
      },
      critOverlap: {
        normalMin: Math.min(...normal), normalMax: Math.max(...normal),
        critMin: Math.min(...critical), critMax: Math.max(...critical),
        overlap: Math.min(...critical) <= Math.max(...normal),
      },
      defenseCurve,
      enemyToHero,
      ttk,
      content,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  writeJson("numbers.json", data);
  console.log(JSON.stringify(data, null, 2));
});

test("C. 기본 프로젝트(신규 게임) 콘텐츠 다양성", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(async () => {
    try {
      const mod = await import("/src/project/store.ts");
      return Boolean((mod as { store?: { getCurrent(): { database?: { enemies?: unknown[] } } } }).store?.getCurrent()?.database?.enemies?.length);
    } catch {
      return false;
    }
  }, undefined, { timeout: 60_000 });

  const data = await page.evaluate(async () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const defaults: any = await import("/src/project/defaults/defaultProject.ts");
    const dmg: any = await import("/src/battle/battleDamage.ts");
    const battlers: any = await import("/src/battle/battleBattlers.ts");
    // 신규 프로젝트가 실제로 쓰는 시드는 createBlankProject(store.ts) 다.
    const project: any = defaults.createBlankProject();
    const skills = project.database.skills ?? [];
    const enemies = project.database.enemies ?? [];
    const species = project.database.monsterSpecies ?? [];
    const troops = project.database.troops ?? [];
    const states = project.database.states ?? [];
    const anims = project.database.battleAnimations ?? [];

    const party = battlers.actorBattlers(project, {});
    const hero = party[0];
    const rngMid = () => 0.5;
    function hit(power: number, stat: number, def: number) {
      const target: any = { hp: 1e9, maxHp: 1e9, mp: 0, maxMp: 0, defense: def, mind: def, defending: false, stateIds: [], stateTurns: {} };
      const user: any = { attackPower: stat, mind: stat };
      let i = 0;
      const rng = () => [0.5, 0.5, 0.99][i++ % 3];
      return dmg.applySkillLike(user, target, { power, statistic: "attack", effect: "damage", rng: rng ?? rngMid }).amount;
    }

    const enemyTable = enemies.slice(0, 24).map((e: any) => {
      const heroHit = hit(hero.attackPower, hero.attackPower, e.stats?.defense ?? 0);
      const enemyHit = hit(e.stats?.attack ?? 0, e.stats?.attack ?? 0, hero.defense);
      return {
        name: e.name,
        hp: e.stats?.maxHp, atk: e.stats?.attack, def: e.stats?.defense, agi: e.stats?.agility,
        actions: (e.actions ?? []).length,
        heroHit, turnsToKill: heroHit > 0 ? Math.ceil((e.stats?.maxHp ?? 1) / heroHit) : Infinity,
        enemyHit, turnsToKillHero: enemyHit > 0 ? Math.ceil(hero.maxHp / enemyHit) : Infinity,
      };
    });

    return {
      hero: { name: hero.name, level: hero.level, hp: hero.maxHp, atk: hero.attackPower, def: hero.defense, skills: hero.skillIds },
      partySize: party.length,
      counts: {
        skills: skills.length, enemies: enemies.length, troops: troops.length,
        species: species.length, states: states.length, animations: anims.length,
      },
      skillScopes: Object.entries(skills.reduce((acc: any, s: any) => { acc[s.scope] = (acc[s.scope] ?? 0) + 1; return acc; }, {})),
      skillEffects: Object.entries(skills.reduce((acc: any, s: any) => { const k = s.effect?.kind ?? "?"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})),
      elementsUsed: [...new Set(skills.map((s: any) => s.elementId).filter(Boolean))],
      speciesTypes: Object.entries(species.reduce((acc: any, s: any) => { for (const t of s.types ?? []) acc[t] = (acc[t] ?? 0) + 1; return acc; }, {})),
      speciesMoveCount: Object.entries(species.reduce((acc: any, s: any) => { const n = (s.skillsByLevel ?? []).length; acc[n] = (acc[n] ?? 0) + 1; return acc; }, {})),
      enemiesWithNoActions: enemies.filter((e: any) => (e.actions ?? []).length === 0).length,
      enemiesWithConditional: enemies.filter((e: any) => (e.actions ?? []).some((a: any) => a.condition?.kind && a.condition.kind !== "always")).length,
      enemyTable,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  writeJson("default-content.json", data);
  console.log(JSON.stringify(data, null, 2).slice(0, 4000));
});
