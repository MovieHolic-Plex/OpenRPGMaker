import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9841";
const outDir = path.resolve("output/evidence/resource-manager-url-import");
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

  // 1. URL 가져오기 버튼 클릭 -> 모달 오픈
  const urlBtn = page.locator(".rm-url-btn");
  await urlBtn.click();
  await page.waitForSelector(".rm-url-modal-window", { timeout: 5000 });
  await page.waitForTimeout(500);

  const urlModalShotPath = path.join(outDir, "url-import-modal-open.png");
  await page.screenshot({ path: urlModalShotPath });
  console.log(`Saved URL modal screenshot: ${urlModalShotPath}`);

  // URL 입력
  const urlInput = page.locator(".rm-url-input");
  await urlInput.fill("https://raw.githubusercontent.com/EasyRPG/RTP/master/CharSet/Actor1.png");
  await page.waitForTimeout(500);

  const urlInputFilledShotPath = path.join(outDir, "url-import-input-filled.png");
  await page.screenshot({ path: urlInputFilledShotPath });
  console.log(`Saved URL filled screenshot: ${urlInputFilledShotPath}`);

} catch (err) {
  console.error("Error capturing screenshots:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
