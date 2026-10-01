// 자료집 시스템 탭 「전투 화면 꾸미기」 캡처: node verify-shots/battle-look/editor/capture.mjs [port]
import { chromium } from "@playwright/test";
const port = process.argv[2] ?? "9868";
const out = "verify-shots/battle-look/editor";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
try {
  const page = await browser.newPage({ viewport: { width: 1474, height: 950 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`http://127.0.0.1:${port}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(15000);
  await page.screenshot({ path: `${out}/boot.png` });
  await page.getByTestId("toolbar-database").click({ timeout: 240000 });
  await page.getByTestId("db-tab-system").dispatchEvent("click");
  await page.getByTestId("db-system-nav-startup").dispatchEvent("click");
  const gallery = page.getByTestId("db-battle-look-gallery");
  await gallery.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const card = gallery.locator("xpath=ancestor::*[contains(@class,'db-system-settings-group')][1]");
  await card.screenshot({ path: `${out}/look-pixel.png` });
  await page.getByTestId("db-battle-look-preset-gold").click();
  const party = page.getByTestId("db-battle-look-party");
  await party.selectOption("tilt");
  await page.waitForTimeout(600);
  await page.getByTestId("db-battle-look-gallery").scrollIntoViewIfNeeded();
  await page.getByTestId("db-battle-look-gallery").locator("xpath=ancestor::*[contains(@class,'db-system-settings-group')][1]").screenshot({ path: `${out}/look-gold-custom.png` });
  await page.getByTestId("db-battle-look-axes").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator(".db-battle-look-toggles").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.getByTestId("database-modal").screenshot({ path: `${out}/look-axes.png` });
  console.log(await page.evaluate(() => JSON.stringify(window.__oprnEditorStore?.getCurrent?.().system.battleLook ?? null)));
} finally {
  await browser.close();
}
