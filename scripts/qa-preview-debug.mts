import { chromium } from "playwright";

const BASE = "http://127.0.0.1:9999";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Find the event layer button - it could be in the left rail or toolbar
  const allButtons = await page.locator("button").allTextContents();
  console.log("Buttons visible:", allButtons.filter(b => b.trim()).slice(0, 30));

  // Try finding layer buttons
  const layerBtns = await page.locator('[class*="layer"], [data-testid*="layer"]').allTextContents();
  console.log("Layer elements:", layerBtns.filter(b => b.trim()).slice(0, 10));

  // Look for the basic rail event button
  const eventBtn = page.locator('button:has-text("이벤트"), [data-testid*="event"], [class*="event"]').first();
  console.log("Event button found:", await eventBtn.count());

  // Try to click on the event layer
  const eventLayerBtn = page.locator('[data-testid="layer-event"]');
  console.log("layer-event testid:", await eventLayerBtn.count());
  
  const leftRail = page.locator('.editor-left-rail, [class*="left-rail"]');
  console.log("Left rail:", await leftRail.count());

  await page.screenshot({ path: "output/evidence/preview-qa-debug-01.png" });

  // Get the full page text to understand what's visible
  const bodyText = await page.textContent("body");
  const keywords = ["이벤트", "레이어", "layer", "event", "맵", "도구"];
  for (const kw of keywords) {
    console.log(`Contains "${kw}":`, bodyText?.includes(kw) ?? false);
  }

  // Try right-click on canvas to get context menu
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 120, box.y + 90, { button: "right" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "output/evidence/preview-qa-debug-02-rightclick.png" });
    
    // Check for context menu
    const ctxMenu = await page.textContent("body");
    console.log("After right-click, has '이벤트':", ctxMenu?.includes("이벤트"));
    console.log("After right-click, has '추가':", ctxMenu?.includes("추가"));
    console.log("After right-click, has '생성':", ctxMenu?.includes("생성"));
  }

  // Try to find and click event layer, then dblclick
  const possibleEventBtns = page.locator('button[title*="이벤트"], button[title*="event"], [data-testid*="layer-event"]');
  if (await possibleEventBtns.count() > 0) {
    await possibleEventBtns.first().click();
    await page.waitForTimeout(300);
    console.log("Clicked event layer button");
  }

  if (box) {
    await page.mouse.dblclick(box.x + 120, box.y + 90);
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: "output/evidence/preview-qa-debug-03.png" });
  
  const modal = page.locator('[data-testid="event-editor-modal"]');
  console.log("Modal open:", await modal.count());

  // Try keyboard shortcut or menu
  const menuItems = await page.locator('button, [role="menuitem"], [role="button"]').allTextContents();
  console.log("Menu items:", menuItems.filter(b => b.trim()).slice(0, 20));

  console.log("PAGE_ERRORS:", errors.length);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
