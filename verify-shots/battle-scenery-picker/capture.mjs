// 배경 종류 고르기 전후 캡처: node verify-shots/battle-scenery-picker/capture.mjs <before|after> <port>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const phase = process.argv[2] ?? "after";
const port = process.argv[3] ?? "9815";
const out = new URL(`./${phase}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on("pageerror", (error) => console.log("pageerror:", error.message));
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await page.goto(`http://127.0.0.1:${port}/?freshProject=1`);
await page.getByTestId("toolbar-database").click({ timeout: 60000 });
await page.getByTestId("database-modal").waitFor();
const tab = async (testid) => {
  await page.getByTestId(testid).first().evaluate((node) => node.click());
  await page.waitForTimeout(900);
};
const shoot = async (name, focus) => {
  const target = page.locator(focus).first();
  if (await target.count()) await target.scrollIntoViewIfNeeded().catch(() => {});
  else console.log(`${name}: 초점 없음 ${focus}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log(`${name}: ok`);
};
await tab("db-tab-troops");
await shoot("troop-side", '[data-testid="db-troop-config-card"]');
await shoot("troop-side-preview", '[data-testid="db-troop-preview-card"]');
await tab("db-tab-battle-screen");
await tab("db-battle-studio-nav-terrain");
await shoot("terrain-side", '[data-testid="db-terrain-scene-card"]');
// 몬스터 대치로 바꾼 뒤 적 그룹
await tab("db-tab-battle-screen");
await tab("db-battle-method-monster");
await tab("db-tab-troops");
await shoot("troop-monster", '[data-testid="db-troop-config-card"]');
await browser.close();
