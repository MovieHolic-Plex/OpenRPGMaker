// poke-depth PR3 — 특성(타입 무효·접촉 상태·한 번 버티기)이 출하 플레이어의 포켓몬 전투 화면에 문장으로 뜨는지 찍는다.
//   MODE=immune|contact|endure [LEGACY=1] unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/poke-depth-items.capture.mjs <campaign.json> <outDir>"
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이).
// 디버그 쓰기: 파티에 몬스터 한 마리를 직접 넣고 기술 칸을 정한다(스타터 고르기 흐름은 이 시나리오의 대상이 아니다). report.debugWrites 에 남는다.
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: poke-depth-items.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/poke-depth-items");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
// 시험용 사본: 야생 한 마리를 오래 버티게(HP 큼) 하고 타입을 노말로 고정한다.
const LEGACY = process.env.LEGACY === "1"; // 「전」: 지닌 도구를 쥐여 주지 않는다(같은 플레이어 코드)
const troop = project.database.troops.find((t) => t.id === "mx_troop_mx_map_meadow_wild_0");
const foe = project.database.enemies.find((e) => e.id === troop.members[0].enemyId);
const foeSpecies = project.database.monsterSpecies.find((r) => r.id === foe.speciesId);
foe.stats = { ...foe.stats, maxHp: 400, attack: 38, defense: 40, mind: 40, agility: 20 };
foeSpecies.types = ["normal"];
const out = resolve(outArg ?? "qa-runs/pd/items");
await mkdir(out, { recursive: true });
const report = { steps: [], errors: [], debugWrites: ["party monster injected (coalbit Lv30) with moves + 3 held items in inventory", "wild foe type forced normal / attack 38", `LEGACY=${LEGACY}`] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:poke-depth-items", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, ok, detail) => { report.steps.push({ id, ok, detail }); console.log(ok ? "✓" : "✗", id, detail); };
const waitCmd = () => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout: 60000 }).then(() => true, () => false);
const icons = () => page.evaluate(() => [...document.querySelectorAll(".battle-status-icon")].filter((n) => n.getClientRects().length > 0).map((n) => `${n.dataset.testid.replace("battle-status-", "")}`));
const hpText = () => page.evaluate(() => [...document.querySelectorAll("[data-testid^='battle-enemy-hp'], [data-testid*='hp-text']")].map((n) => n.textContent?.trim()).filter(Boolean));
const lines = () => page.evaluate(() => [...document.querySelectorAll(".battle-message-line")].filter((n) => n.getClientRects().length > 0).map((n) => (n.textContent ?? "").trim()).filter(Boolean));
async function focusEntry(loc) {
  for (let i = 0; i < 40; i++) {
    const cls = (await loc.getAttribute("class")) ?? ""; const sel = await loc.getAttribute("aria-selected"); const cur = await loc.getAttribute("aria-current");
    if (cls.includes("selected") || cls.includes("active") || sel === "true" || cur === "true") return;
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80);
  }
}
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
    s.monsterInstances = { ...(s.monsterInstances ?? {}), [id]: { instanceId: id, speciesId: "mx_species_coalbit", level: 12, exp: 0, skillIds: moves, skillPp: Object.fromEntries(moves.map((m) => [m, 30])), friendship: 70, caughtAt: { mapId: s.currentMapId, x: 1, y: 1 } } };
    s.monsterParty = [id];
    s.inventory = { ...(s.inventory ?? {}), mx_held_oran: 1, mx_held_sash: 1 };
  }, moves);
  const heldNow = () => page.evaluate(() => window.__oprnHooksScene.session.monsterInstances.qa_mon_1.heldItemId ?? null);
  const invNow = () => page.evaluate(() => ({ oran: window.__oprnHooksScene.session.inventory.mx_held_oran ?? 0, sash: window.__oprnHooksScene.session.inventory.mx_held_sash ?? 0 }));
  if (!LEGACY) {
    // 메뉴 「가방」에서 회복 열매를 파티 몬스터에게 쥐여 준다.
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (!(await present("dialogue-box")) && !(await present("cinematic-sequence"))) { await page.waitForTimeout(600); if (!(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); }
    await page.keyboard.press("Escape");
    await page.waitForSelector("[data-testid^='status-menu-command-']", { timeout: 20000 }).catch(async () => { await page.screenshot({ path: join(out, "menu-fail.png") }); report.dom = await page.evaluate(() => [...document.querySelectorAll("[data-testid]")].slice(0, 60).map((n) => n.dataset.testid)); throw new Error("menu did not open"); });
    await page.screenshot({ path: join(out, "01-menu-open.png") });
    const rail = page.locator("[data-testid='status-menu-command-items'], [data-testid='status-menu-rail-items']");
    step("menu-rail-items", (await rail.count()) > 0, `rail buttons=${await rail.count()}`);
    if (await rail.count()) {
      for (let i = 0; i < 20; i++) { if ((await rail.first().getAttribute("class"))?.includes("selected")) break; await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80); }
      await page.keyboard.press("Enter"); await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(out, "02-bag.png") });
    const item = page.locator("[data-testid='status-menu-item-mx_held_oran']");
    step("bag-has-held-item", (await item.count()) > 0, `entry=${await item.count()}`);
    if (await item.count()) {
      await focusEntry(item.first()); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
      await page.screenshot({ path: join(out, "03-item-action.png") });
      const use = page.locator("[data-testid='status-menu-item-use-mx_held_oran']");
      if (await use.count()) { await focusEntry(use.first()); await page.keyboard.press("Enter"); await page.waitForTimeout(500); }
      await page.screenshot({ path: join(out, "03b-pick-monster.png") });
      const target = page.locator("[data-testid='status-menu-monster-qa_mon_1']");
      step("pick-target-listed", (await target.count()) > 0, `targets=${await target.count()}`);
      if (await target.count()) { await focusEntry(target.first()); await page.keyboard.press("Enter"); await page.waitForTimeout(600); }
    }
    step("given", (await heldNow()) === "mx_held_oran", `held=${await heldNow()} inv=${JSON.stringify(await invNow())}`);
    await page.screenshot({ path: join(out, "04-after-give.png") });
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    for (let i = 0; i < 4; i++) { if (!(await present("status-menu-command-items")) && !(await present("status-menu-command-monsters"))) break; await page.keyboard.press("Escape"); await page.waitForTimeout(250); }
  }
  await page.evaluate(() => { void window.__oprnHooksScene.playBattle({ kind: "battleProcessing", troopId: "mx_troop_mx_map_meadow_wild_0", canEscape: true, canLose: true }); });
  await page.getByTestId("battle-scene").waitFor({ timeout: 60000 });
  step("battle-open", await waitCmd(), "command prompt reached");
  const heldPill = () => page.evaluate(() => [...document.querySelectorAll(".battle-held-pill")].filter((n) => n.getClientRects().length > 0).map((n) => n.title));
  step("held-pill-shown", (await heldPill()).length === (LEGACY ? 0 : 1), JSON.stringify(await heldPill()));
  await page.screenshot({ path: join(out, "05-battle-start.png") });
  const seenLines = []; let shot = false;
  const sample = async (ms) => { for (let t = 0; t < ms; t += 150) { const now = await lines(); seenLines.push(...now); if (!shot && now.some((x) => /열매/.test(x))) { shot = true; await page.screenshot({ path: join(out, "07-berry-line.png") }); } await page.waitForTimeout(150); } };
  for (let i = 1; i <= 5; i++) {
    if (!(await waitCmd())) break;
    await useSkill("mx_skill_normal_1"); await sample(3200); await waitCmd();
    await page.screenshot({ path: join(out, `06-round${i}.png`) });
    const pills = await heldPill();
    if (!LEGACY && pills.length === 0 && shot) break;
  }
  const berryLines = [...new Set(seenLines.filter((x) => /열매/.test(x)))];
  step("berry-line", berryLines.length > 0 === !LEGACY, JSON.stringify(berryLines));
  step("pill-gone-after-berry", LEGACY || (await heldPill()).length === 0, JSON.stringify(await heldPill()));
  report.lines = [...new Set(seenLines)];
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
