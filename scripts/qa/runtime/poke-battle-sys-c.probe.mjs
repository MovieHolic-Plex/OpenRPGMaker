// 육성·전투 규칙 시각 QA 3 — 성격·노력치(옵트인). 공용 조각은 poke-battle-sys.probe.mjs 를 쓴다.
//   RULES=on|off node scripts/qa/runtime/poke-battle-sys-c.probe.mjs [outDir] [scene,…]
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { boot, setParty, startBattle, shot, menuState, fightMove, untilPrompt, finish, report, expJustBelowNext } from "./poke-battle-sys.probe.mjs";

const SPR = "mx_species_spriglet";
const FOUR = ["mx_skill_normal_1", "mx_skill_grass_1", "mx_skill_grass_2", "mx_skill_grass_6"];
const M = (speciesId, level, extra = {}) => ({ speciesId, level, ...extra });
async function press(page, key, wait = 350) { await page.keyboard.press(key); await page.waitForTimeout(wait); }
const speciesList = JSON.parse(await readFile(process.env.POKE_FIXTURE ?? "/tmp/pk-exp/project.json", "utf8")).database.monsterSpecies;
const RULES = process.env.RULES === "off" ? "off" : "on";

// 능력치는 페이지의 monsterBattleStats 로 읽는다. 프로젝트 객체는 fixture 의 종 목록 + 이 장면의 규칙으로 직접 만든다
// (probe 가 import 하는 store 는 게임이 쓰는 store 와 다른 인스턴스라 getCurrent() 가 빈 프로젝트다).
const readParty = (page) => page.evaluate(async ([speciesList, rules]) => {
  const mod = await import("/src/project/monsterCollection.ts");
  const project = { system: rules ? { monsterStatRules: rules } : {}, database: { monsterSpecies: speciesList } };
  return Object.values(window.__oprnHooksScene.session.monsterInstances).map((m) => ({ id: m.instanceId, level: m.level, nature: m.nature, evs: m.evs, stats: mod.monsterBattleStats(project, m) }));
}, [speciesList, RULES === "on" ? { natures: true, evs: true } : undefined]);

const scenes = {
  async levelUpBox(page) {
    const exp = await expJustBelowNext(page, SPR, 15);
    await setParty(page, [M(SPR, 15, { exp, skillIds: FOUR, ...(RULES === "on" ? { nature: "brave" } : {}) })]);
    report.before = await readParty(page);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    for (let t = 0; t < 6; t++) {
      if (!(await fightMove(page, 2))) break;
      if ((await untilPrompt(page, 90000)) === "result") break;
    }
    await page.waitForTimeout(1200);
    report.rows = [];
    for (let k = 0; k < 12; k++) {
      const box = await page.evaluate(() => { const b = [...document.querySelectorAll(".battle-levelup-stats")].find((n) => getComputedStyle(n).display !== "none"); return b ? b.textContent : null; });
      if (box && !report.boxMetrics) {
        report.boxMetrics = await page.evaluate(() => {
          const b = [...document.querySelectorAll(".battle-levelup-stats")].find((n) => getComputedStyle(n).display !== "none"); const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
          const kids = [...b.children].map((c) => { const q = c.getBoundingClientRect(); const k = getComputedStyle(c); return [c.textContent, Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height), k.fontFamily.slice(0, 30), k.fontSize, k.lineHeight]; });
          const chain = []; for (let n = b; n && n !== document.body; n = n.parentElement) { const k = getComputedStyle(n); chain.push([n.className.toString().slice(0, 40), k.transform, k.writingMode, k.letterSpacing, k.fontStretch, k.scale, k.zoom, k.animationName, k.fontSizeAdjust, k.textRendering, k.fontKerning, k.fontVariantEastAsian]); }
          const probe = document.createElement("span"); probe.textContent = "체력"; probe.style.cssText = "position:absolute;left:0;top:0;font:18px/20px Galmuri9;white-space:nowrap"; b.append(probe); const pr = probe.getBoundingClientRect(); probe.remove();
          return { chain, probeWH: [Math.round(pr.width), Math.round(pr.height)], font: cs.font, fam: cs.fontFamily, size: cs.fontSize, lh: cs.lineHeight, box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], grid: cs.gridTemplateRows, zoom: getComputedStyle(b.closest(".battle-scene")).getPropertyValue("--battle-stage-scale"), kids };
        });
      }
      await shot(page, "pd" + String(k + 1).padStart(2, "0"));
      report.rows.push({ k, text: (await menuState(page)).text, box });
      await press(page, "z", 1300);
      if (!(await page.locator('[data-testid="battle-scene"]').count())) break;
    }
    await page.waitForTimeout(2000);
    report.after = await readParty(page);
  },
  // 요약 화면: 「성격」 줄과 능력치. 메뉴 → 몬스터 → 첫 몬스터 Enter.
  async summary(page) {
    await setParty(page, [M(SPR, 15, { skillIds: FOUR, ...(RULES === "on" ? { nature: "brave" } : {}) })]);
    const key = async (name, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(name); await page.waitForTimeout(160); } };
    await page.waitForTimeout(600);
    await key("Escape");
    await page.getByTestId("status-menu-command-monsters").waitFor({ timeout: 20000 });
    for (let i = 0; i < 40; i++) {
      if ((await page.getByTestId("status-menu-command-monsters").getAttribute("class"))?.includes("selected")) break;
      await key("ArrowDown");
    }
    await key("Enter"); await page.waitForTimeout(500);
    await key("Enter"); await page.waitForTimeout(700);
    await page.screenshot({ path: join(outDir, "pe1-summary.png") });
    report.natureRow = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="status-menu-monster-nature-"]')].map((n) => n.textContent));
  },
};
const outDir = process.argv[2] ?? "verify-shots/poke-sys-battle-c";
const patches = {
  summary: (project) => { if (RULES === "on") project.system.monsterStatRules = { natures: true, evs: true }; },
  levelUpBox: (project) => {
    if (RULES === "on") project.system.monsterStatRules = { natures: true, evs: true };
    for (const species of project.database.monsterSpecies) species.evYield = { atk: 3 };
  },
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
