// poke-depth PR2 — 맹독(TOX, 차례마다 커지는 독)·혼란(CNF, 절반 자해)이 출하 플레이어의 포켓몬 전투 화면에서 보이는지 찍는다.
//   MODE=toxic|confuse [LEGACY=1] unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/poke-depth-status.capture.mjs <campaign.json> <outDir>"
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이).
// 디버그 쓰기: 파티에 몬스터 한 마리를 직접 넣고 기술 칸을 정한다(스타터 고르기 흐름은 이 시나리오의 대상이 아니다). report.debugWrites 에 남는다.
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: poke-depth-status.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/poke-depth-status");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
// 시험용 사본: 야생 한 마리를 오래 버티게(HP 큼, 공격 약함) 하고 타입을 노말로 고정한다(독 타입이면 맹독이 막힌다).
const MODE = process.env.MODE === "confuse" ? "confuse" : "toxic";
const troop = project.database.troops.find((t) => t.id === "mx_troop_mx_map_meadow_wild_0");
const foe = project.database.enemies.find((e) => e.id === troop.members[0].enemyId);
foe.stats = { ...foe.stats, maxHp: 400, attack: MODE === "confuse" ? 10 : 30, defense: 40, mind: 40, agility: MODE === "confuse" ? 255 : 20 };
project.database.monsterSpecies.find((r) => r.id === foe.speciesId).types = ["normal"];
const LEGACY = process.env.LEGACY === "1";
if (LEGACY) {
  // 「전」: 같은 기술이 보통 독(고정 1/16)이다. 같은 플레이어 코드, 데이터만 옛 방식.
  for (const skill of project.database.skills) if (skill.id === "mx_skill_poison_6") skill.stateEffects = [{ stateId: "state_poison", chance: 100, operation: "add" }];
}
if (MODE === "confuse") {
  // 야생이 혼란을 100% 거는 기술을 쓴다(진단용 데이터 수정).
  const skill = project.database.skills.find((s) => s.id === "mx_skill_psychic_4");
  skill.stateEffects = [{ stateId: "state_confusion", chance: 100, operation: "add" }]; skill.power = 0; skill.effect = { kind: "support" }; skill.hitRate = 100;
  foe.skillIds = ["mx_skill_psychic_4"];
  foe.actions = [{ skillId: "mx_skill_psychic_4", priority: 6, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
}
const out = resolve(outArg ?? "qa-runs/pd/stages");
await mkdir(out, { recursive: true });
const report = { steps: [], errors: [], debugWrites: ["party monster injected (coalbit Lv30) with moves", "wild foe HP 400, type forced normal", `MODE=${MODE} LEGACY=${LEGACY}`] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:poke-depth-status", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, ok, detail) => { report.steps.push({ id, ok, detail }); console.log(ok ? "✓" : "✗", id, detail); };
const waitCmd = () => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout: 60000 }).then(() => true, () => false);
const icons = () => page.evaluate(() => [...document.querySelectorAll(".battle-status-icon")].filter((n) => n.getClientRects().length > 0).map((n) => `${n.dataset.testid.replace("battle-status-", "")}`));
const hpText = () => page.evaluate(() => [...document.querySelectorAll("[data-testid^='battle-enemy-hp'], [data-testid*='hp-text']")].map((n) => n.textContent?.trim()).filter(Boolean));
const lines = () => page.evaluate(() => [...document.querySelectorAll(".battle-message-line")].filter((n) => n.getClientRects().length > 0).map((n) => (n.textContent ?? "").trim()).filter(Boolean));
async function useSkill(skillId) {
  await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
  const btn = page.locator(`[data-testid="actor-skill-${skillId}"]`);
  await btn.waitFor({ timeout: 10000 });
  await btn.focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
  if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
}
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 180000 });
  for (let i = 0; i < 60; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  const moves = ["mx_skill_poison_6", "mx_skill_normal_1", "mx_skill_normal_2", "mx_skill_normal_3"];
  await page.evaluate((moves) => {
    const s = window.__oprnHooksScene.session;
    const id = "qa_mon_1";
    s.monsterInstances = { ...(s.monsterInstances ?? {}), [id]: { instanceId: id, speciesId: "mx_species_coalbit", level: 30, exp: 0, skillIds: moves, skillPp: Object.fromEntries(moves.map((m) => [m, 30])), friendship: 70, caughtAt: { mapId: s.currentMapId, x: 1, y: 1 } } };
    s.monsterParty = [id];
  }, moves);
  await page.evaluate(() => { void window.__oprnHooksScene.playBattle({ kind: "battleProcessing", troopId: "mx_troop_mx_map_meadow_wild_0", canEscape: true, canLose: true }); });
  await page.getByTestId("battle-scene").waitFor({ timeout: 60000 });
  step("battle-open", await waitCmd(), "command prompt reached");
  await page.screenshot({ path: join(out, "01-start.png") });
  const seenLines = [];
  const rounds = []; let selfShot = false;
  const sample = async (ms) => { const mine = []; for (let t = 0; t < ms; t += 150) { const now = await lines(); mine.push(...now); if (!selfShot && now.some((x) => /자신을 공격/.test(x))) { selfShot = true; await page.screenshot({ path: join(out, "07-self-hit.png") }); } await page.waitForTimeout(150); } seenLines.push(...mine); rounds.push([...new Set(mine)]); };

  if (MODE === "toxic") {
    await useSkill("mx_skill_poison_6");
    await sample(2500); await waitCmd();
    await page.screenshot({ path: join(out, "02-poisoned-turn1.png") });
    step("icon-after-poison", (await icons()).some((x) => /(toxic|poison)$/.test(x)), JSON.stringify(await icons()));
    for (let i = 2; i <= 4; i++) {
      await useSkill("mx_skill_normal_1"); await sample(2500); await waitCmd();
      await page.screenshot({ path: join(out, `0${i + 1}-poisoned-turn${i}.png`) });
    }
  } else {
    await useSkill("mx_skill_normal_1"); // 야생이 먼저 초음파
    await sample(3000); await waitCmd();
    await page.screenshot({ path: join(out, "02-confused.png") });
    step("icon-confused", (await icons()).some((x) => /confuse$/.test(x)), JSON.stringify(await icons()));
    for (let i = 2; i <= 14 && !(selfShot && i > 5); i++) {
      await useSkill("mx_skill_normal_1"); await sample(3000); await waitCmd();
      if (i <= 5) await page.screenshot({ path: join(out, `0${i + 1}-confused-turn${i}.png`) });
    }
  }
  report.lines = [...new Set(seenLines)];
  report.rounds = rounds;
  report.icons = await icons();
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await page.screenshot({ path: join(out, "error.png") }).catch(() => {});
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}
console.log(report.errors.length ? "ERRORS:\n" + report.errors.join("\n") : "no page errors");
