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
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await page.waitForSelector("[data-testid='toolbar-resource-manager']", { timeout: 15000 });
  await page.getByTestId("toolbar-resource-manager").click();

  await page.waitForSelector("[data-testid='resource-modal']", { timeout: 10000 });
  await page.waitForTimeout(1000); // 렌더링 안정화

  const modal = page.locator(".resource-modal-window");
  
  // 1. 기본 화면 (전투 배경 그리드 뷰)
  const defaultShotPath = path.join(outDir, "modern-studio-backdrop-grid.png");
  await modal.screenshot({ path: defaultShotPath });
  console.log(`Saved modal screenshot: ${defaultShotPath}`);

  // 2. 캐릭터셋 카테고리 (그리드 뷰 + 카드 호버 애니메이션 상태)
  const categories = page.getByTestId("resource-category-list");
  const categoryButtons = categories.locator("button");
  const charsetBtn = categoryButtons.filter({ hasText: "캐릭터셋" }).filter({ hasNotText: "전투 캐릭터셋" });
  await charsetBtn.click();
  await page.waitForTimeout(500);

  // 캐릭터셋 카드 중 Actor1 호버 및 선택
  const actor1Card = page.locator(".rm-asset-card").filter({ hasText: "Actor1" }).first();
  if (await actor1Card.isVisible()) {
    await actor1Card.hover();
    await actor1Card.click();
    await page.waitForTimeout(600);
  }

  const charsetShotPath = path.join(outDir, "modern-studio-charset-grid.png");
  await modal.screenshot({ path: charsetShotPath });
  console.log(`Saved charset screenshot: ${charsetShotPath}`);

  // 3. 칩셋 카테고리 (그리드 뷰)
  const chipsetBtn = categoryButtons.filter({ hasText: "칩셋" });
  await chipsetBtn.click();
  await page.waitForTimeout(500);

  const chipsetCard = page.locator(".rm-asset-card").filter({ hasText: "합본 마을" }).first();
  if (await chipsetCard.isVisible()) {
    await chipsetCard.click();
    await page.waitForTimeout(500);
  }

  const chipsetShotPath = path.join(outDir, "modern-studio-chipset-grid.png");
  await modal.screenshot({ path: chipsetShotPath });
  console.log(`Saved chipset screenshot: ${chipsetShotPath}`);

  // 4. 얼굴 그래픽 카테고리 (112장 낱장 카드 그리드)
  const facesetBtn = categoryButtons.filter({ hasText: "얼굴 그래픽" });
  await facesetBtn.click();
  await page.waitForTimeout(500);

  const facesetCard = page.locator(".rm-asset-card").first();
  if (await facesetCard.isVisible()) {
    await facesetCard.click();
    await page.waitForTimeout(500);
  }

  const facesetShotPath = path.join(outDir, "modern-studio-faceset-grid.png");
  await modal.screenshot({ path: facesetShotPath });
  console.log(`Saved faceset screenshot: ${facesetShotPath}`);

  // 5. 컴팩트 리스트 뷰 전환 테스트
  const listToggleBtn = page.getByRole("button", { name: "리스트 뷰" });
  await listToggleBtn.click();
  await page.waitForTimeout(500);

  const listShotPath = path.join(outDir, "modern-studio-list-view.png");
  await modal.screenshot({ path: listShotPath });
  console.log(`Saved list view screenshot: ${listShotPath}`);

  // 6. 에디터 전체 스크린샷
  const fullShotPath = path.join(outDir, "modern-studio-full.png");
  await page.screenshot({ path: fullShotPath });
  console.log(`Saved full screenshot: ${fullShotPath}`);

} catch (err) {
  console.error("Error capturing screenshots:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
