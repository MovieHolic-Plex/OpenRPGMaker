import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "verify-shots/tileset-section-audit";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://127.0.0.1:9999/?freshProject=1", { waitUntil: "domcontentloaded", timeout: 60000 });
const coachSkip = page.getByTestId("coach-mark-skip");
if (await coachSkip.isVisible().catch(() => false)) await coachSkip.click();
await page.getByTestId("menu-tools").click();
await page.getByTestId("menu-tools-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible" });
await page.getByTestId("db-tab-tilesets").click({ force: true });
await page.getByTestId("db-detail-form").waitFor({ state: "visible" });
await page.waitForTimeout(400);

for (const tab of ["rules", "knowledge", "compose"]) {
  const btn = page.getByTestId(`tileset-section-tab-${tab}`);
  if (await btn.count()) {
    await btn.click({ force: true });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/tab-${tab}.png` });
    console.log("shot tab", tab);
  } else console.log("missing tab btn", tab);
}

// AI 메타 모드 (knowledge 탭 안의 툴박스)
await page.getByTestId("tileset-section-tab-knowledge").click({ force: true });
await page.waitForTimeout(250);
for (const mode of ["ai", "group"]) {
  const b = page.getByTestId(`tileset-edit-mode-${mode}`);
  if (await b.count()) {
    await b.click({ force: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/mode-${mode}.png` });
    console.log("shot mode", mode);
  } else console.log("missing mode", mode);
}

const aiOpen = page.getByTestId("tileset-ai-workspace-open");
if (await aiOpen.count()) {
  await aiOpen.click({ force: true });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/ai-workspace.png` });
  console.log("shot ai workspace");
}

await browser.close();
console.log("done");
