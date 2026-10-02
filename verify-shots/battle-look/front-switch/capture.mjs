// 정면 스킨 위 「전투 화면 꾸미기」: 경고·바꾸기 버튼, 프리셋 고르면 측면 스킨으로. node verify-shots/battle-look/front-switch/capture.mjs [port]
import { chromium } from "@playwright/test";
const port = process.argv[2] ?? "9868";
const out = "verify-shots/battle-look/front-switch";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
try {
  const page = await browser.newPage({ viewport: { width: 1474, height: 950 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`http://127.0.0.1:${port}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(15000);
  await page.evaluate(() => window.__oprnEditorStore.update((d) => { d.system.battleUiStyle = "mv"; }));
  const skin = () => page.evaluate(() => window.__oprnEditorStore.getCurrent().system.battleUiStyle);
  console.log("before", await skin());
  await page.getByTestId("toolbar-database").click({ timeout: 240000 });
  await page.getByTestId("db-tab-system").dispatchEvent("click");
  await page.getByTestId("db-system-nav-startup").dispatchEvent("click");
  const group = () => page.getByTestId("db-battle-look-gallery").locator("xpath=ancestor::*[contains(@class,'db-system-settings-group')][1]");
  await page.getByTestId("db-battle-look-skin-warning").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await group().screenshot({ path: `${out}/1-front-warning.png` });
  await page.getByTestId("db-battle-look-preset-parch").click();
  await page.waitForTimeout(800);
  console.log("after preset", await skin(), JSON.stringify(await page.evaluate(() => window.__oprnEditorStore.getCurrent().system.battleLook)));
  console.log("warning gone", (await page.getByTestId("db-battle-look-skin-warning").count()) === 0);
  await page.getByTestId("db-battle-look-gallery").scrollIntoViewIfNeeded();
  await group().screenshot({ path: `${out}/2-after-preset.png` });
} finally {
  await browser.close();
}
