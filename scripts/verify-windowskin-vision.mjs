import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("output/evidence/windowskin-fix");
fs.mkdirSync(outDir, { recursive: true });

const project = JSON.parse(fs.readFileSync("test/fixtures/projects/battle-v3.json", "utf8"));
project.system.systemResourceId = "easyrpg-system-system";
project.system.battleSystemResourceId = "easyrpg-system2-system2-c";
for (const troop of project.database.troops || []) {
  troop.previewBackgroundResourceId = "easyrpg-backdrop-night-sky1";
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20_000);

await page.addInitScript((seed) => {
  window.__OPRN_E2E_PROJECT__ = seed;
  window.localStorage.clear();
}, project);

await page.goto("http://127.0.0.1:9173/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector('[data-testid="toolbar-database"]', { timeout: 30_000 });
await page.waitForTimeout(800);

// --- Title + field menu (system graphic) ---
await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
await page.waitForSelector('[data-testid="title-screen"]', { timeout: 15_000 });
await page.screenshot({ path: path.join(outDir, "01-title.png") });
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, "02-field.png") });

for (const key of ["Shift", "Escape", "x"]) {
  await page.keyboard.press(key);
  await page.waitForTimeout(250);
  if ((await page.locator('[data-testid="main-menu"]').count()) > 0) break;
}
await page.screenshot({ path: path.join(outDir, "03-menu.png") });
const menu = await page.evaluate(() => {
  const m = document.querySelector('[data-testid="main-menu"]');
  if (!m) return null;
  return {
    dataSystem: m.getAttribute("data-system-resource"),
    skin: m.style.getPropertyValue("--runtime-window-skin"),
  };
});
console.log("menu", menu);

// Close test play
await page.getByTestId("test-play-window-close").click().catch(async () => {
  await page.keyboard.press("Escape");
});
await page.waitForTimeout(500);

// --- Troop battle test (battle DOM skins + backdrop) ---
const toolbarDb = page.locator('[data-testid="toolbar-database"]');
await toolbarDb.first().click();
await page.waitForSelector('[data-testid="db-tab-troops"]', { timeout: 15_000 });
await page.getByTestId("db-tab-troops").click();
await page.waitForTimeout(500);
// Select first troop row if needed, then battle test
const battleTest = page.getByTestId("db-troop-battle-test");
if ((await battleTest.count()) === 0) {
  const row = page.locator('[data-testid^="db-record-troops-"], [data-testid^="db-list-item"]').first();
  if ((await row.count()) > 0) await row.click();
  await page.waitForTimeout(300);
}
await page.getByTestId("db-troop-battle-test").click();
await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, "04-battle.png") });

const battle = await page.evaluate(() => {
  const s = document.querySelector('[data-testid="battle-scene"]');
  const bd = document.querySelector('[data-testid="battle-backdrop"]');
  const read = (el) =>
    el
      ? {
          dataSystem: el.getAttribute("data-system-resource"),
          skin: el.style.getPropertyValue("--runtime-window-skin"),
          borderImage: (getComputedStyle(el).borderImageSource || "").slice(0, 180),
        }
      : null;
  return {
    scene: read(s),
    party: read(document.querySelector(".battle-party")),
    cmd: read(document.querySelector(".battle-command-panel")),
    msg: read(document.querySelector(".battle-message-window")),
    sceneVar: s ? getComputedStyle(s).getPropertyValue("--runtime-window-skin") : null,
    backdrop: bd
      ? {
          id: bd.getAttribute("data-backdrop-resource-id"),
          bg: (getComputedStyle(bd).backgroundImage || "").slice(0, 240),
        }
      : null,
  };
});
console.log(JSON.stringify(battle, null, 2));
fs.writeFileSync(path.join(outDir, "battle-skin.json"), JSON.stringify({ menu, battle }, null, 2));

const errors = [];
if (!menu || menu.dataSystem !== "windowskin-rm2003") errors.push(`menu ${JSON.stringify(menu)}`);
if (!battle.scene || battle.scene.dataSystem !== "windowskin-rm2003") errors.push(`battle ${JSON.stringify(battle.scene)}`);
const blob = JSON.stringify({ menu, battle });
if (/System\.png|SystemA\.png|SystemB\.png|SystemC\.png/i.test(blob)) errors.push("EasyRPG System sheet still in styles");
if (/night-sky|Night Sky|dimension-rift/i.test(blob)) errors.push("bad backdrop");
if (battle.backdrop && !/battle-reference-forest|generated-battle-reference-forest/i.test(JSON.stringify(battle.backdrop))) {
  errors.push(`backdrop ${JSON.stringify(battle.backdrop)}`);
}

if (errors.length) {
  console.error("FAIL", errors);
  await browser.close();
  process.exit(1);
}
console.log("PASS");
await browser.close();
