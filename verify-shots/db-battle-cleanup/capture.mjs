// 자료집 전투 정리 전후 캡처: node verify-shots/db-battle-cleanup/capture.mjs <before|after> [port]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const phase = process.argv[2] ?? "after";
const port = process.argv[3] ?? "9815";
const out = new URL(`./${phase}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const SHOTS = [
  { name: "system-battle", tab: "db-tab-system", click: "db-system-nav-startup", focus: '[data-testid="db-field-system-battle-flow"]' },
  { name: "system-resources", tab: "db-tab-system", click: "db-system-nav-resources" },
  { name: "battle-screen", tab: "db-tab-battle-screen" },
  { name: "battle-screen-lower", tab: "db-tab-battle-screen", focus: '[data-testid="db-battle-look-gallery"], [data-testid="db-field-battle-screen-active-slots"]' },
  { name: "enemy-graphic", tab: "db-tab-enemies", click: "db-enemy-section-appearance-tab" },
  { name: "species-graphic", tab: "db-tab-monster-species", focus: '[data-testid="db-monster-species-graphic-pair"]' },
  { name: "retro-choreo", tab: "db-tab-retro-choreographies" },
  { name: "animations", tab: "db-tab-animations" },
  { name: "animations-sub", tab: "db-tab-retro-choreographies", click: "db-subview-animations" },
];
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await page.goto(`http://127.0.0.1:${port}/?freshProject=1`);
await page.getByTestId("toolbar-database").click({ timeout: 60000 });
await page.getByTestId("database-modal").waitFor();
for (const shot of SHOTS) {
  const button = page.getByTestId(shot.tab);
  if (!(await button.count())) { console.log(`${shot.name}: 탭 없음 (${shot.tab})`); continue; }
  // 빈 탭은 접힌 그룹 안에 숨어 있다 — 사람 클릭 대신 DOM click 으로 연다.
  await button.first().evaluate((node) => node.click());
  await page.waitForTimeout(900);
  if (shot.click) {
    const target = page.getByTestId(shot.click).first();
    if (await target.count()) await target.evaluate((node) => node.click());
    else console.log(`${shot.name}: 누를 대상 없음 (${shot.click})`);
    await page.waitForTimeout(700);
  }
  if (shot.focus) {
    const target = page.locator(shot.focus).first();
    if (await target.count()) await target.scrollIntoViewIfNeeded().catch(() => {});
    else console.log(`${shot.name}: 초점 대상 없음`);
    await page.waitForTimeout(300);
  }
  await page.getByTestId("database-modal").screenshot({ path: `${out}${shot.name}.png` });
  console.log(`${shot.name}: ok`);
}
await browser.close();
