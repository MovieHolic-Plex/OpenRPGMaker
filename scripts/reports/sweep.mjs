// 표면 회귀 촬영 하네스. 에디터 · DB 모달 주요 탭을 한 번에 돌며 찍는다.
// 사용: OPRN_PORT=9891 node .playwright-mcp/sweep.mjs <label>
import { launch, newPage, waitForApp, shot, BASE, OUT } from "./lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const label = process.argv[2] || "x";
const browser = await launch();
const page = await newPage(browser, { width: 1440, height: 900 });
const report = { label, shots: [] };

const click = async (testid, waitMs = 1400) => {
  const el = page.locator(`[data-testid="${testid}"]`).first();
  if ((await el.count()) === 0) return false;
  await el.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(waitMs);
  return true;
};
const capture = async (name) => { await shot(page, `sweep-${name}-${label}`); report.shots.push(name); };

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await waitForApp(page);
await page.waitForTimeout(2200);
await capture("editor");

await click("toolbar-database", 3000);
await capture("db-actors");

for (const [testid, name] of [
  ["db-tab-overview", "db-overview"],
  ["db-tab-group-monster", "db-monster"],
  ["db-tab-group-battle", "db-battle"],
  ["db-tab-group-world", "db-world"],
  ["db-tab-spatial-places", "db-places"],
  ["db-tab-spatial-tiles", "db-tiles"],
  ["db-tab-group-system", "db-system"],
]) {
  if (await click(testid, 2000)) await capture(name);
}
// 개요 탭으로 돌아와 카드 근접 촬영
if (await click("db-tab-overview", 2000)) {
  const grid = page.locator(".db-overview-pulse-grid").first();
  if (await grid.count()) await grid.screenshot({ path: `${OUT}/pulse-cards-${label}.png` }).catch(() => {});
  const stats = page.locator(".db-overview-stats").first();
  if (await stats.count()) await stats.screenshot({ path: `${OUT}/stat-chips-${label}.png` }).catch(() => {});
}
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/sweep.${label}.json`, JSON.stringify(report, null, 2));
console.log(`찍은 화면 ${report.shots.length}장:`, report.shots.join(", "));
await browser.close();
