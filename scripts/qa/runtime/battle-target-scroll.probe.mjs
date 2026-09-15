// 대상 선택 스크롤 계측 프로브 (2026-09-15).
// 6체처럼 스크롤포트를 넘는 적 목록에서 키보드로 대상을 순환할 때, 선택 행이 포트 안으로
// 따라오는지 잰다. 안 따라오면 플레이어는 자기가 고른 적을 볼 수 없다.
//
//   node scripts/qa/runtime/battle-target-scroll.probe.mjs
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-target-scroll");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const project = JSON.parse(await readFile(new URL("../../../test/fixtures/projects/battle-v3.json", import.meta.url), "utf8"));
const troop = project.database.troops.find((t) => t.id === "troop_slime");
const enemy = project.database.enemies.find((e) => e.id === "enemy_slime");
enemy.name = "심연에서기어나온아주긴슬라임";
troop.enemyIds = Array(6).fill("enemy_slime");

const MEASURE = `(() => {
  const menu = document.querySelector(".battle-command-menu.battle-target-menu") ?? document.querySelector(".battle-command-menu");
  const cursor = document.querySelector('button.battle-command[data-testid^="battle-target-"][aria-pressed="true"]')
    ?? document.querySelector('button.battle-command[data-battle-command-cursor="true"]');
  if (!menu || !cursor) return { menu: !!menu, cursor: !!cursor };
  const m = menu.getBoundingClientRect();
  const c = cursor.getBoundingClientRect();
  return {
    menu: { top: Math.round(m.top), bottom: Math.round(m.bottom), clientH: menu.clientHeight, scrollH: menu.scrollHeight, scrollTop: Math.round(menu.scrollTop) },
    cursor: { label: cursor.dataset.testid, top: Math.round(c.top), bottom: Math.round(c.bottom) },
    cursorInside: c.top >= m.top - 1 && c.bottom <= m.bottom + 1,
    rows: [...document.querySelectorAll(".battle-command-menu.battle-target-menu button.battle-command")].length,
  };
})()`;

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const report = { steps: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__tscroll/project.json", saveNamespace: "tscroll-qa", qaInstrumentation: true };
  });
  await page.route("**/__tscroll/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(server.url + "/player.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });
  await page.evaluate(() => { window.__oprnInput.face("right"); window.__oprnInput.action(); });
  for (let i = 0; i < 30; i += 1) {
    if (await page.locator('[data-testid="actor-command-attack"]').count()) break;
    await page.keyboard.press("z");
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('[data-testid="actor-command-attack"]', { timeout: 30_000 });
  await page.keyboard.press("z"); // 공격 → 대상 선택
  await page.waitForSelector('[data-testid="battle-target-prompt"]', { state: "attached", timeout: 15_000 });
  report.steps.push({ step: "open", ...(await page.evaluate(MEASURE)) });
  for (let i = 1; i <= 6; i += 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(220);
    report.steps.push({ step: "right-" + i, ...(await page.evaluate(MEASURE)) });
  }
  await page.screenshot({ path: resolve(out, "target-scroll-end.png") });
} finally {
  await browser.close();
  await server.close();
}
await writeFile(resolve(out, "result.json"), JSON.stringify(report, null, 1));
for (const s of report.steps) {
  console.log([s.step, "rows=" + s.rows, "cursor=" + (s.cursor && s.cursor.label), "inside=" + s.cursorInside, "scrollTop=" + (s.menu && s.menu.scrollTop), "clientH=" + (s.menu && s.menu.clientH), "scrollH=" + (s.menu && s.menu.scrollH)].join("  "));
}
