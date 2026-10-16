// 육성·전투 규칙 시각 QA 4 — 기술 규칙 어휘(고정 피해·연속 타수·반동·풀죽음). 공용 조각은 poke-battle-sys.probe.mjs 를 쓴다.
//   node scripts/qa/runtime/poke-battle-sys-d.probe.mjs [outDir] [scene,…]
import { boot, setParty, startBattle, shot, menuState, choose, fightMove, untilPrompt, finish, report } from "./poke-battle-sys.probe.mjs";

const SPR = "mx_species_spriglet";
const M = (speciesId, level, extra = {}) => ({ speciesId, level, ...extra });

// 규칙을 얹은 새 기술 네 개를 더한다 — 야생 몬스터가 쓰는 원래 기술은 건드리지 않는다(같은 기술 기록을 적도 쓴다).
const RULE_SKILLS = ["mx_qa_flinch", "mx_qa_fixed", "mx_qa_multi", "mx_qa_recoil"];
const patch = (project) => {
  const base = project.database.skills.find((s) => s.id === "mx_skill_normal_1");
  const add = (id, name, rule) => project.database.skills.push({ ...structuredClone(base), id, name, movePriority: 0, ...rule });
  add("mx_qa_flinch", "기선제압", { movePriority: 1, flinchChance: 100 });
  add("mx_qa_fixed", "지구던지기", { fixedDamage: { mode: "level" } });
  add("mx_qa_multi", "연속치기", { multiHit: { min: 2, max: 5 }, power: 20 });
  add("mx_qa_recoil", "무모한돌진", { recoilPercent: 50, power: 90 });
  // 한 방에 끝나지 않게 야생 몬스터 체력을 넉넉히.
  for (const enemy of project.database.enemies) if (enemy.id.startsWith("mx_enemy_mx_map_meadow_wild_0")) { enemy.level = 16; enemy.stats = { ...enemy.stats, maxHp: 120 }; }
};

const hudHp = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="battle-scene"] *')].filter((n) => n.children.length === 0 && /^\d+\/\d+$/.test(n.textContent.trim())).map((n) => n.textContent.trim()));

/** 기술을 쓰고 흐르는 문장을 전부 모은다(문장 창은 몇 초 만에 바뀐다). */
async function castAndRead(page, index, tag, shotRe) {
  const lines = [];
  // 부팅 재시도의 확인키가 「싸운다」를 이미 열어 두었을 수 있다 — 기술 목록이 열려 있으면 바로 고르고, 아니면 싸운다부터.
  await page.waitForTimeout(800);
  let open = (await menuState(page)).menu.filter((id) => id.startsWith("actor-skill-"));
  if (!open.length) { if (!(await choose(page, "actor-command-fight"))) throw new Error("fight menu not reached"); await page.waitForTimeout(400); open = (await menuState(page)).menu.filter((id) => id.startsWith("actor-skill-")); }
  // 기술 칸은 2×2 격자 — 오른쪽 칸(1)은 choose 의 위아래 이동으로 닿지 않는다.
  if (index === 1) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150); await page.keyboard.press("z"); }
  else if (!(await choose(page, open[index] ?? open[0]))) throw new Error("skill not chosen");
  report[tag + "-hpBefore"] = await hudHp(page);
  const until = Date.now() + 60000;
  let shotDone = false;
  while (Date.now() < until) {
    const ui = await menuState(page);
    const t = ui.text;
    if (t && lines[lines.length - 1] !== t) lines.push(t);
    if (!shotDone && shotRe?.test(t)) { await page.waitForTimeout(300); await shot(page, tag); shotDone = true; }
    if (ui.busy === "false" && t.includes("무엇을 할까")) break;
    if (await page.evaluate(() => Boolean(document.querySelector(".battle-result-panel")))) break;
    await page.waitForTimeout(100);
  }
  report[tag] = lines;
  report[tag + "-hpAfter"] = await hudHp(page);
  await page.waitForTimeout(500);
}

const scenes = {
  async fixedDamage(page) {
    await setParty(page, [M(SPR, 17, { skillIds: RULE_SKILLS })]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    await shot(page, "pd0-before");
    await castAndRead(page, 1, "fixed-lines", /지구던지기/);
    await shot(page, "pd1-after");
  },
  async multiHit(page) {
    await setParty(page, [M(SPR, 17, { skillIds: RULE_SKILLS })]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    await castAndRead(page, 2, "multi-lines", /번 맞았다/);
    await shot(page, "pd2-after");
  },
  async recoil(page) {
    await setParty(page, [M(SPR, 17, { skillIds: RULE_SKILLS })]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    await shot(page, "pd3-before");
    await castAndRead(page, 3, "recoil-lines", /반동 피해/);
    await shot(page, "pd3-after");
  },
  async flinch(page) {
    await setParty(page, [M(SPR, 17, { skillIds: RULE_SKILLS })]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    await castAndRead(page, 0, "flinch-lines", /풀이 죽어 움직일 수 없다/);
    await shot(page, "pd4-after");
  },
};

const only = process.argv[3]?.split(",");
for (const name of only ?? Object.keys(scenes)) {
  let booted;
  for (let attempt = 0; attempt < 3 && !booted; attempt++) {
    try { booted = await boot(undefined, patch); } catch (e) { report.errors.push("boot retry: " + String(e?.message ?? e).slice(0, 120)); }
  }
  if (!booted) { report.scenes.push({ name, ok: false, error: "boot failed" }); continue; }
  const row = { name, started: new Date().toISOString() };
  try { await scenes[name](booted.page); row.ok = true; } catch (e) { row.ok = false; row.error = String(e?.message ?? e).slice(0, 400); try { await shot(booted.page, name + "-ERROR"); } catch { /* */ } }
  report.scenes.push(row);
  await booted.context.close();
}
await finish();
console.log(JSON.stringify({ scenes: report.scenes, errors: report.errors.slice(0, 5) }, null, 1));
