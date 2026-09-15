// 전투 아이템 목록의 보유 수량 가시성 계측 프로브 (2026-09-16).
// 긴 이름이 행을 넘칠 때 수량("xN")이 이름과 같은 strong 에 들어 있어 통째로 생략되는지 잰다.
//
//   node scripts/qa/runtime/battle-item-name-count.probe.mjs
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-item-name-count");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(new URL("../../../test/fixtures/projects/item-runtime-qa-v3.json", import.meta.url), "utf8"));
for (const item of project.database.items) item.name = "최상급특제대용량회복의" + item.name;

const MEASURE = `(() => {
  const rows = [...document.querySelectorAll('button[data-testid^="actor-item-"]')];
  return rows.map((row) => {
    const strong = row.querySelector(".battle-command-text strong");
    const smalls = [...row.querySelectorAll(".battle-command-text small")];
    const count = smalls.find((s) => /^x[0-9]+$/.test((s.textContent || "").trim()));
    const cr = count ? count.getBoundingClientRect() : null;
    return {
      testid: row.dataset.testid,
      name: strong ? strong.textContent : null,
      nameClientWidth: strong ? Math.round(strong.clientWidth) : null,
      nameScrollWidth: strong ? Math.round(strong.scrollWidth) : null,
      nameTruncated: strong ? strong.scrollWidth > strong.clientWidth + 1 : null,
      smalls: smalls.map((s) => (s.textContent || "").trim()),
      hasCountNode: !!count,
      countVisible: cr ? cr.width > 0 && cr.height > 0 : false,
      countTruncated: count ? count.scrollWidth > count.clientWidth + 1 : null,
    };
  });
})()`;

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const report = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__itemcount/project.json", saveNamespace: "itemcount-qa", qaInstrumentation: true };
  });
  await page.route("**/__itemcount/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(server.url + "/player.html?e2eVitals=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });
  await page.evaluate(() => window.__oprnDebug.teleport("map_moonwell_forest", 14, 3));
  await page.waitForFunction(() => {
    const s = window.__oprnDebug.readState();
    return s.currentMapId === "map_moonwell_forest" && s.x === 14 && s.y === 3;
  }, undefined, { timeout: 15_000 });
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
  for (let i = 0; i < 24; i += 1) {
    if (await page.locator('[data-testid="battle-scene"]').count()) break;
    await page.keyboard.press("z");
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('[data-testid="actor-command-attack"]', { state: "attached", timeout: 30_000 });
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);
  await page.keyboard.press("z");
  await page.waitForTimeout(600);
  report.rows = await page.evaluate(MEASURE);
  await page.screenshot({ path: resolve(out, "item-list.png") });
} finally {
  await browser.close();
  await server.close();
}
report.totalRows = report.rows?.length ?? 0;
report.rowsWithCountNode = (report.rows ?? []).filter((r) => r.hasCountNode).length;
report.rowsWithVisibleCount = (report.rows ?? []).filter((r) => r.hasCountNode && r.countVisible && !r.countTruncated).length;
report.pass = report.totalRows > 0 && report.rowsWithVisibleCount === report.totalRows;
await writeFile(resolve(out, "result.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ totalRows: report.totalRows, rowsWithCountNode: report.rowsWithCountNode, rowsWithVisibleCount: report.rowsWithVisibleCount, pass: report.pass, sample: (report.rows ?? []).slice(0, 3), errors: report.errors.slice(0, 2) }, null, 1));
