// Phase 2 출하 플레이어 검증: 비전서를 파티 몬스터에게 쓰고 → 상태 메뉴의 몬스터 기술에서 덩굴 가르기를 쓰고 → 막힌 길이 열려 지나간다.
//   node scripts/qa/audit-poke/hm-runtime-probe.mjs <project.json> <outDir>
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg);
await mkdir(out, { recursive: true });
const report = { steps: [], errors: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking", "--disable-features=LocalNetworkAccessChecks,NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await context.newPage();
page.on("crash", () => console.log("PAGE CRASH"));
page.on("close", () => console.log("PAGE CLOSE"));
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
await page.addInitScript(() => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:hm", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const state = () => page.evaluate(() => { const s = window.__oprnDebug.readState(); return { map: s.currentMapId, x: s.x, y: s.y, inv: s.inventory, mon: Object.values(s.monsterInstances ?? {}).map((m) => ({ id: m.instanceId, skills: m.skillIds, pending: m.pendingSkillIds })), sw: Object.keys(s.switches ?? {}).filter((k) => /open/.test(k)).map((k) => k + "=" + s.switches[k]) }; });
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, data) => { report.steps.push({ id, ...data }); console.log(id, JSON.stringify(data)); };
const shot = (n) => page.screenshot({ path: join(out, `${n}.png`) });
const click = async (id) => { const ok = await page.evaluate((t) => { const n = document.querySelector(`[data-testid="${t}"]`); if (!n) return false; n.click(); return true; }, id); if (!ok) throw new Error("no testid " + id); await page.waitForTimeout(500); };
const press = async (dir, ms) => { await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(ms); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(450); };
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) {
    if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break;
    await page.keyboard.press("Enter"); await page.waitForTimeout(250);
  }
  step("start", await state());
  const ids = (re) => page.evaluate((src) => [...document.querySelectorAll("[data-testid]")].map((n) => n.getAttribute("data-testid")).filter((t) => new RegExp(src).test(t)), re.source);
  const advance = async () => { for (let i = 0; i < 40; i++) { if (!(await present("dialogue-box")) && !(await present("runtime-choices"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(220); } };
  // 1) 박사에게서 첫 동료(새싹토)를 받는다 — 실제 이벤트 경로.
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_lab", 7, 6));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__oprnInput.face("up"));
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  for (let i = 0; i < 30 && !(await present("runtime-choices")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  await click("runtime-choice-0");
  await advance();
  step("starter", await state());
  // 2) 비전서를 얻는다(상자 대신 디버그 지급 — 상자 경로는 qa:game check 자동 플레이가 이미 통과).
  await page.evaluate(() => window.__oprnDebug.giveItem("item_hm_cut", 1));
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_meadow", 15, 17));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__oprnInput.face("up"));
  await shot("1-before-blocked");
  await press("up", 220);
  step("blocked-walk-up", await state());
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
  await click("status-menu-command-items");
  step("items-menu", { ids: await ids(/status-menu-item-/) });
  await shot("2-items");
  await click("status-menu-item-item_hm_cut");
  step("item-detail", { ids: await ids(/status-menu-monster-|status-menu-item-use/) });
  await click("status-menu-item-use-item_hm_cut");
  step("teach-targets", { ids: await ids(/status-menu-monster-|status-menu-item-use/) });
  await shot("3-teach-target");
  await click((await ids(/^status-menu-monster-\w/))[0]);
  step("after-teach", await state());
  await shot("4-after-teach");
  // 3) 몬스터 목록 → 기술 → 덩굴 가르기를 필드에서 쓴다.
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  if (!(await present("status-menu-command-monsters"))) { await page.keyboard.press("Escape"); await page.waitForTimeout(600); }
  if (!(await present("status-menu-command-monsters"))) { await page.keyboard.press("Escape"); await page.waitForTimeout(600); }
  step("menu2", { ids: await ids(/status-menu-command-monsters|main-menu/) });
  await click("status-menu-command-monsters");
  const mon = (await ids(/^status-menu-monster-\w/)).find((t) => !/toggle|art|known|skill/.test(t));
  step("monsters", { ids: await ids(/status-menu-monster-/), mon });
  await click(mon);
  const skillId = (await ids(/status-menu-monster-known-skill-.*skill_field_cut/))[0];
  step("known-skills", { ids: await ids(/status-menu-monster-known-skill-/) });
  await shot("5-monster-skills");
  await click(skillId);
  await page.waitForTimeout(1200);
  for (let i = 0; i < 30 && (await present("dialogue-box")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  step("after-field-skill", await state());
  await shot("6-opened");
  await press("up", 260);
  await press("up", 260);
  step("walked-through", await state());
  await shot("7-through");
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
} catch (e) {
  report.errors.push(String(e?.stack ?? e));
  await shot("failure").catch(() => {});
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await server.close?.();
}
console.log("errors", JSON.stringify(report.errors));
