// 육성·전투 규칙 시각 QA 2 — 도망 불가 안내·경험치 분배. 공용 조각은 poke-battle-sys.probe.mjs(PR #2724)를 쓴다.
//   node scripts/qa/runtime/poke-battle-sys-b.probe.mjs [outDir] [scene,scene…]
import { readFile } from "node:fs/promises";
import { boot, setParty, startBattle, shot, menuState, choose, fightMove, untilPrompt, finish, report } from "./poke-battle-sys.probe.mjs";

const SPR = "mx_species_spriglet", COAL = "mx_species_coalbit";
const FOUR = ["mx_skill_normal_1", "mx_skill_grass_1", "mx_skill_grass_2", "mx_skill_grass_6"];
const M = (speciesId, level, extra = {}) => ({ speciesId, level, ...extra });
async function press(page, key, wait = 350) { await page.keyboard.press(key); await page.waitForTimeout(wait); }
const speciesList = JSON.parse(await readFile(process.env.POKE_FIXTURE ?? "/tmp/pk-exp/project.json", "utf8")).database.monsterSpecies;
/** 레벨 구간 안 경험치(monsterExpInLevelBand)로 읽는다 — 절대값은 레벨 바닥이 섞여 전후 차이를 못 읽는다. */
const readParty = (page) => page.evaluate(async (speciesList) => {
  const mod = await import("/src/project/monsterCollection.ts");
  return Object.values(window.__oprnHooksScene.session.monsterInstances).map((m) => ({ id: m.instanceId, sp: m.speciesId, level: m.level, bandExp: mod.monsterExpInLevelBand(speciesList.find((s) => s.id === m.speciesId), m.level, m.exp), hp: m.currentHp }));
}, speciesList);

const scenes = {
  // 트레이너 전 도망: 「도망간다」 줄에서 확인하면 이유 문장이 뜨고, 커서를 옮기면 원래 문장으로 돌아온다.
  async fleeTrainer(page) {
    await setParty(page, [M(SPR, 12)]);
    await startBattle(page, "mx_troop_mx_map_meadow_trainer_0", { canEscape: false });
    await press(page, "ArrowDown"); await press(page, "ArrowRight");
    await shot(page, "pb1-run-cursor");
    await press(page, "z", 700);
    await shot(page, "pb2-run-denied");
    report.runDeniedText = (await menuState(page)).text;
    await press(page, "ArrowUp", 600);
    await shot(page, "pb3-after-move");
    report.afterMoveText = (await menuState(page)).text;
  },
  // 야생전에서 이벤트가 도망을 막은 경우의 일반 문장.
  async fleeWildBlocked(page) {
    await setParty(page, [M(SPR, 12)]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0", { canEscape: false });
    await press(page, "ArrowDown"); await press(page, "ArrowRight"); await press(page, "z", 700);
    await shot(page, "pb4-wild-run-denied");
    report.wildDeniedText = (await menuState(page)).text;
  },
  // 경험치 분배: 두 마리가 둘 다 살아 참전(교체)하고 끝낸다. patches 로 expSplitAlive 를 켜고/끄고 비교한다.
  async expTwoAlive(page) {
    await setParty(page, [M(SPR, 12, { skillIds: FOUR }), M(COAL, 12)]);
    report.before = await readParty(page);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    // 선두가 한 번 치고 → 두 번째와 교체 → 두 번째가 끝낸다.
    await fightMove(page, 2);
    await untilPrompt(page, 90000);
    if (await choose(page, "actor-command-pkmn")) {
      await page.waitForTimeout(300);
      const ui = await menuState(page);
      const target = ui.menu.find((id) => id.startsWith("actor-switch-"));
      if (target) await choose(page, target);
      await untilPrompt(page, 90000);
    }
    for (let t = 0; t < 8; t++) {
      if ((await untilPrompt(page, 60000)) === "result") break;
      await fightMove(page, 2);
    }
    await page.waitForTimeout(1000);
    report.resultRows = await page.evaluate(() => [...document.querySelectorAll(".battle-result-reward-label")].map((n) => n.textContent.trim()));
    for (let k = 0; k < 8; k++) {
      await shot(page, "pc" + (k + 1) + "-result");
      report["pc" + (k + 1)] = (await menuState(page)).text;
      await press(page, "z", 1300);
      if (!(await page.locator('[data-testid="battle-scene"]').count())) break;
    }
    await page.waitForTimeout(1500);
    report.after = await readParty(page);
  },
};
const patches = {
  expTwoAlive: process.env.SPLIT === "1"
    ? (project) => { project.system.rewardPolicy = { ...(project.system.rewardPolicy ?? {}), expSplitAlive: true }; }
    : undefined,
};

const only = process.argv[3]?.split(",");
for (const name of only ?? Object.keys(scenes)) {
  let booted;
  for (let attempt = 0; attempt < 3 && !booted; attempt++) {
    try { booted = await boot(undefined, patches[name]); } catch (e) { report.errors.push("boot retry: " + String(e?.message ?? e).slice(0, 120)); }
  }
  if (!booted) { report.scenes.push({ name, ok: false, error: "boot failed" }); continue; }
  const row = { name, started: new Date().toISOString() };
  try { await scenes[name](booted.page); row.ok = true; } catch (e) { row.ok = false; row.error = String(e?.message ?? e).slice(0, 400); try { await shot(booted.page, name + "-ERROR"); } catch { /* */ } }
  report.scenes.push(row);
  await booted.context.close();
}
await finish();
console.log(JSON.stringify({ scenes: report.scenes, errors: report.errors.slice(0, 5) }, null, 1));
