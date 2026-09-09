import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9841";
const outDir = path.resolve("output/evidence/resource-manager");
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
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await page.waitForSelector("[data-testid='toolbar-resource-manager']", { timeout: 15000 });
  await page.getByTestId("toolbar-resource-manager").click();

  await page.waitForSelector("[data-testid='resource-modal']", { timeout: 10000 });
  await page.waitForTimeout(1000); // 렌더링 안정화

  const modal = page.locator(".resource-modal-window");
  
  // 1. 기본 (전투 배경 - 선택 상태 및 인스펙터 확인)
  const defaultShotPath = path.join(outDir, "resource-manager-backdrop.png");
  await modal.screenshot({ path: defaultShotPath });
  console.log(`Saved modal screenshot: ${defaultShotPath}`);

  // 2. 캐릭터셋 카테고리
  const categories = page.getByTestId("resource-category-list");
  const charsetOption = categories.getByRole("option", { name: /캐릭터셋/ }).filter({ hasText: /^캐릭터셋/ });
  await charsetOption.click();
  await page.waitForTimeout(500);

  // 캐릭터셋 항목 중 하나 클릭 (예: 첫번째 Actor)
  const actorRow = page.getByTestId("resource-entry-list").locator(".rm-profile-row").first();
  await actorRow.click();
  await page.waitForTimeout(500);

  const charsetShotPath = path.join(outDir, "resource-manager-charset.png");
  await modal.screenshot({ path: charsetShotPath });
  console.log(`Saved charset screenshot: ${charsetShotPath}`);

  // 3. 검색어 입력 상태 확인
  const searchInput = page.locator(".rm-search-input");
  await searchInput.fill("Monster");
  await page.waitForTimeout(500);
  const monsterRow = page.getByTestId("resource-entry-list").locator(".rm-profile-row").first();
  if (await monsterRow.isVisible()) {
    await monsterRow.click();
    await page.waitForTimeout(500);
  }
  const searchShotPath = path.join(outDir, "resource-manager-search.png");
  await modal.screenshot({ path: searchShotPath });
  console.log(`Saved search screenshot: ${searchShotPath}`);

  // 4. 검색어 초기화 후 얼굴 그래픽 카테고리
  await searchInput.fill("");
  const facesetOption = categories.getByRole("option", { name: /얼굴 그래픽/ });
  await facesetOption.click();
  await page.waitForTimeout(500);
  const facesetShotPath = path.join(outDir, "resource-manager-faceset.png");
  await modal.screenshot({ path: facesetShotPath });
  console.log(`Saved faceset screenshot: ${facesetShotPath}`);

  // 5. 칩셋 카테고리
  const chipsetOption = categories.getByRole("option", { name: /칩셋/ }).filter({ hasText: /^칩셋/ });
  await chipsetOption.click();
  await page.waitForTimeout(500);
  const chipsetShotPath = path.join(outDir, "resource-manager-chipset.png");
  await modal.screenshot({ path: chipsetShotPath });
  console.log(`Saved chipset screenshot: ${chipsetShotPath}`);

} catch (err) {
  console.error("Error capturing screenshots:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
