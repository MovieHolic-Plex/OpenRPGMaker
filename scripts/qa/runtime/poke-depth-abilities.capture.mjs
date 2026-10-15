// poke-depth PR3 — 특성(타입 무효·접촉 상태·한 번 버티기)이 출하 플레이어의 포켓몬 전투 화면에 문장으로 뜨는지 찍는다.
//   MODE=immune|contact|endure [LEGACY=1] unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/poke-depth-abilities.capture.mjs <campaign.json> <outDir>"
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이).
// 디버그 쓰기: 파티에 몬스터 한 마리를 직접 넣고 기술 칸을 정한다(스타터 고르기 흐름은 이 시나리오의 대상이 아니다). report.debugWrites 에 남는다.
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: poke-depth-abilities.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/poke-depth-abilities");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
// 시험용 사본: 야생 한 마리를 오래 버티게(HP 큼) 하고 타입을 노말로 고정한다.
const MODE = ["contact", "endure"].includes(process.env.MODE ?? "") ? process.env.MODE : "immune";
const LEGACY = process.env.LEGACY === "1"; // 「전」: 특성 필드를 뺀다(같은 플레이어 코드, 데이터만 옛 방식)
const troop = project.database.troops.find((t) => t.id === "mx_troop_mx_map_meadow_wild_0");
const foe = project.database.enemies.find((e) => e.id === troop.members[0].enemyId);
const foeSpecies = project.database.monsterSpecies.find((r) => r.id === foe.speciesId);
const mySpecies = project.database.monsterSpecies.find((r) => r.id === "mx_species_coalbit");
foe.stats = { ...foe.stats, maxHp: MODE === "endure" ? 3 : 400, attack: 30, defense: 40, mind: 40, agility: 20 };
foeSpecies.types = ["normal"];
for (const sp of project.database.monsterSpecies) delete sp.ability;
if (!LEGACY) {
  if (MODE === "immune") foeSpecies.ability = { name: "방음벽", kind: "immuneType", type: "normal" };
  if (MODE === "endure") foeSpecies.ability = { name: "근성", kind: "endure" };
  if (MODE === "contact") mySpecies.ability = { name: "정전기막", kind: "contactStatus", status: "paralysis", percent: 100 };
}
const out = resolve(outArg ?? "qa-runs/pd/stages");
await mkdir(out, { recursive: true });
const report = { steps: [], errors: [], debugWrites: ["party monster injected (coalbit Lv30) with moves", "wild foe type forced normal; abilities set per MODE", `MODE=${MODE} LEGACY=${LEGACY}`] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:poke-depth-abilities", qaInstrumentation: true };
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
  const sample = async (ms) => { const mine = []; for (let t = 0; t < ms; t += 150) { const now = await lines(); mine.push(...now); if (!selfShot && now.some((x) => /특성/.test(x))) { selfShot = true; await page.screenshot({ path: join(out, "07-ability-line.png") }); } await page.waitForTimeout(150); } seenLines.push(...mine); rounds.push([...new Set(mine)]); };

  const rounds2 = MODE === "contact" ? 3 : 2;
  for (let i = 1; i <= rounds2; i++) {
    await useSkill("mx_skill_normal_1"); await sample(3200); await waitCmd();
    await page.screenshot({ path: join(out, `0${i + 1}-round${i}.png`) });
  }
  step("ability-line", seenLines.some((x) => /특성/.test(x)) === !LEGACY, JSON.stringify([...new Set(seenLines.filter((x) => /특성|버텼|통하지/.test(x)))]));
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
