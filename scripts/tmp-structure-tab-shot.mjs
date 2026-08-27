// TEMP (보고서 as-is 근거 캡처용, 사용 후 삭제)
import { chromium } from "playwright";

const out = "output/structure-report/asis-structure-tab.png";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 160)); });
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  for (const key of ["oprn:coachmarks-basic-v1", "oprn:standard-welcome-seen", "oprn:editor-welcome-dismissed", "oprn:db-dock-mode", "oprn:database.activeTab"]) localStorage.removeItem(key);
});
await page.goto("http://localhost:9999/?freshProject=1", { waitUntil: "domcontentloaded" });
try {
  await page.getByTestId("toolbar-database").waitFor({ timeout: 90_000 });
} catch (error) {
  await page.screenshot({ path: "output/structure-report/asis-boot-failure.png" });
  throw error;
}
await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor();
await page.getByTestId("db-tab-structure-kits").click({ force: true });
await page.waitForSelector('[data-testid="structure-kit-heading"]');
await page.screenshot({ path: out });
const text = await page.getByTestId("db-detail-form").innerText();
console.log("TAB TEXT >>>", text.replace(/\n+/g, " | ").slice(0, 400));
await browser.close();
