// poke-depth PR1 — 능력치 단계(±6)·단계 알약이 출하 플레이어(player.html + export shim)의 포켓몬 전투 화면에서 보이는지 찍는다.
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/poke-depth-stages.capture.mjs <campaign.json> <outDir>"
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이).
// 디버그 쓰기: 파티에 몬스터 한 마리를 직접 넣고 기술 칸을 정한다(스타터 고르기 흐름은 이 시나리오의 대상이 아니다). report.debugWrites 에 남는다.
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: poke-depth-stages.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/poke-depth-stages");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
// 시험용 사본: 야생 한 마리를 오래 버티게(HP 큼, 공격 약함) 해서 단계 변화를 여러 턴 볼 수 있게 한다.
const troop = project.database.troops.find((t) => t.id === "mx_troop_mx_map_meadow_wild_0");
const foeId = troop.members[0].enemyId;
const foe = project.database.enemies.find((e) => e.id === foeId);
foe.stats = { ...foe.stats, maxHp: 400, attack: 30, defense: 40, mind: 40, agility: 20 };
// LEGACY=1: 단계 시스템이 없던 때의 같은 기술(이진 상승·하락 상태)로 바꿔 「전」 화면을 찍는다. 같은 플레이어 코드, 데이터만 옛 방식.
const LEGACY = process.env.LEGACY === "1";
if (LEGACY) {
  const swap = { mx_skill_fighting_6: "state_attack_up", mx_skill_ground_6: "state_agility_down" };
  for (const skill of project.database.skills) if (swap[skill.id]) { skill.stateEffects = [{ stateId: swap[skill.id], chance: 100, operation: "add" }]; delete skill.statStageEffects; }
}
const out = resolve(outArg ?? "qa-runs/pd/stages");
await mkdir(out, { recursive: true });
const report = { steps: [], errors: [], debugWrites: ["party monster injected (coalbit Lv30) with moves 결의의발·모래장막·할퀴기·몸통", "wild foe HP 400 / attack 30 (survive many turns)"] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:poke-depth-stages", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, ok, detail) => { report.steps.push({ id, ok, detail }); console.log(ok ? "✓" : "✗", id, detail); };
const waitCmd = () => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout: 60000 }).then(() => true, () => false);
const pills = () => page.evaluate(() => [...document.querySelectorAll(".battle-stage-pill")].filter((n) => n.getClientRects().length > 0).map((n) => `${n.dataset.testid.replace("battle-stage-", "")}=${n.textContent}`));
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
  const moves = ["mx_skill_fighting_6", "mx_skill_ground_6", "mx_skill_normal_1", "mx_skill_normal_2"];
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
  step("pills-start", (await pills()).length === 0, JSON.stringify(await pills()));

  await useSkill("mx_skill_fighting_6");
  step("after-swords", await waitCmd(), "turn 1");
  const p1 = await pills(); const l1 = await lines();
  await page.screenshot({ path: join(out, "02-attack-plus2.png") });
  if (!LEGACY) step("pill-attack-plus2", p1.some((x) => /ATK↑2/.test(x)), JSON.stringify(p1));

  await useSkill("mx_skill_ground_6");
  step("after-debuff", await waitCmd(), "turn 2");
  const p2 = await pills();
  await page.screenshot({ path: join(out, "03-foe-speed-minus1.png") });
  if (!LEGACY) step("pill-foe-speed-minus1", p2.some((x) => /SPE↓1/.test(x)), JSON.stringify(p2));

  for (let i = 0; i < 3; i++) { await useSkill("mx_skill_fighting_6"); await waitCmd(); }
  const p3 = await pills();
  await page.screenshot({ path: join(out, "04-attack-plus6-cap.png") });
  if (!LEGACY) step("pill-attack-plus6", p3.some((x) => /ATK↑6/.test(x)), JSON.stringify(p3));
  const l3 = await lines();
  report.lastLines = l3;
  await useSkill("mx_skill_fighting_6");
  // 한계 문장은 지나가는 줄이라 연속 촬영한다.
  const seen = [];
  for (let i = 0; i < 40; i++) { seen.push(...(await lines())); await page.waitForTimeout(150); }
  report.capLines = [...new Set(seen)];
  if (!LEGACY) step("cap-line", report.capLines.some((x) => /더 이상 오르지 않는다/.test(x)), JSON.stringify(report.capLines));
  await waitCmd();
  await page.screenshot({ path: join(out, "05-after-cap.png") });
  report.messagesEarly = l1;
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await page.screenshot({ path: join(out, "error.png") }).catch(() => {});
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}
console.log(report.errors.length ? "ERRORS:\n" + report.errors.join("\n") : "no page errors");
