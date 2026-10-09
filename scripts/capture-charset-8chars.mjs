import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9841";
const outDir = path.resolve("output/evidence/resource-manager-modern");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"]
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });

  console.log(`Navigating to http://127.0.0.1:${PORT}/?freshProject=1`);
  await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, {
    waitUntil: "networkidle",
    timeout: 30000
  });

  await page.waitForSelector("[data-testid='toolbar-resource-manager']", { timeout: 15000 });
  await page.getByTestId("toolbar-resource-manager").click();

  await page.waitForSelector("[data-testid='resource-modal']", { timeout: 10000 });
  await page.waitForTimeout(1000); // 렌더링 안정화

  const modal = page.locator(".resource-modal-window");

  // 1. 캐릭터셋 카테고리 클릭
  const categories = page.getByTestId("resource-category-list");
  const categoryButtons = categories.locator("button");
  const charsetBtn = categoryButtons.filter({ hasText: "캐릭터셋" }).filter({ hasNotText: "전투 캐릭터셋" });
  await charsetBtn.click();
  await page.waitForTimeout(1000); // 8명 캔버스 프레임 애니메이션 렌더링 대기

  const charsetShotPath = path.join(outDir, "modern-studio-charset-8chars.png");
  await modal.screenshot({ path: charsetShotPath });
  console.log(`Saved charset 8chars screenshot: ${charsetShotPath}`);

} catch (err) {
  console.error("Error capturing screenshots:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
