import { chromium } from "playwright";

const BASE = "http://127.0.0.1:9999";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`${BASE}/?dev-showcase=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Switch to expert mode for full toolbar
  const expertBtn = page.locator('button:has-text("전문가 모드")');
  if (await expertBtn.count()) {
    await expertBtn.click();
    await page.waitForTimeout(1000);
    console.log("Switched to expert mode");
  }

  // Click event layer
  await page.getByTestId("layer-event").click();
  await page.waitForTimeout(300);

  // Click event tool
  const eventTool = page.getByTestId("tool-event");
  if (await eventTool.count()) {
    await eventTool.click();
    await page.waitForTimeout(300);
    console.log("Clicked event tool");
  }

  // Look for event list
  const eventRows = await page.locator('[data-testid*="event-list-row"]').count();
  console.log("Event rows found:", eventRows);

  // If no event rows, try double-clicking on canvas to create new event
  if (eventRows === 0) {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      // Try double-click on canvas
      await page.mouse.dblclick(box.x + 160, box.y + 120);
      await page.waitForTimeout(1500);
    }
    
    const modal = page.locator('[data-testid="event-editor-modal"]');
    if (await modal.count()) {
      console.log("Modal opened from dblclick!");
    }
  } else {
    // Click first event row and open editor
    await page.locator('[data-testid*="event-list-row"]').first().click();
    await page.waitForTimeout(300);
    
    const openBtn = page.getByTestId("event-editor-open");
    if (await openBtn.count()) {
      await openBtn.click();
      await page.waitForTimeout(1000);
      console.log("Opened event editor");
    }
  }

  await page.screenshot({ path: "output/evidence/preview-qa-01-modal.png" });

  const modal = page.locator('[data-testid="event-editor-modal"]');
  console.log("Modal open:", await modal.count() > 0);

  if (await modal.count()) {
    // Open preview panel
    const previewSummary = page.locator('.event-script-live-preview > summary');
    if (await previewSummary.count()) {
      await previewSummary.click();
      await page.waitForTimeout(400);
      console.log("Opened preview");
    }
    
    // Open flow panel
    const flowSummary = page.locator('.event-script-flowchart > summary');
    if (await flowSummary.count()) {
      await flowSummary.click();
      await page.waitForTimeout(400);
      console.log("Opened flow");
    }

    await page.screenshot({ path: "output/evidence/preview-qa-02-both-panels.png" });

    const previewOpen = await page.locator('.event-script-live-preview').first().evaluate(el => (el as HTMLDetailsElement).open).catch(() => false);
    const flowOpen = await page.locator('.event-script-flowchart').first().evaluate(el => (el as HTMLDetailsElement).open).catch(() => false);
    console.log("Preview open:", previewOpen);
    console.log("Flow open:", flowOpen);
    console.log("BOTH_SIMULTANEOUS:", previewOpen && flowOpen);

    // Check live preview content
    const liveStage = await page.locator('[data-testid="event-script-live-stage"]').count();
    const flowBody = await page.locator('[data-testid="event-flowchart-body"]').count();
    console.log("Live stage rendered:", liveStage > 0);
    console.log("Flow body rendered:", flowBody > 0);

    // Check for fork eval and skipped elements
    const forkEval = await page.locator('[data-testid="ecp-fork-eval"]').count();
    const skipped = await page.locator('.ecp-skipped').count();
    const runtimeEffect = await page.locator('[data-testid="ecp-runtime-effect"]').count();
    console.log("Fork eval badge:", forkEval > 0);
    console.log("Skipped elements:", skipped);
    console.log("Runtime effect cards:", runtimeEffect);

    // Navigate steps
    const nextBtn = page.locator('[data-testid="event-script-live-next"]');
    if (await nextBtn.count()) {
      for (let i = 0; i < 3; i++) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }
      console.log("Navigated 3 steps");
    }

    await page.screenshot({ path: "output/evidence/preview-qa-03-after-nav.png" });
  }

  console.log("PAGE_ERRORS:", errors.length);
  if (errors.length) console.log("FIRST_ERROR:", errors[0]);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
