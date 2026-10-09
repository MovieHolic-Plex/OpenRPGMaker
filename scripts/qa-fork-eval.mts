import { chromium } from "playwright";

const BASE = "http://127.0.0.1:9999";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`${BASE}/?dev-showcase=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.locator('button:has-text("전문가 모드")').click();
  await page.waitForTimeout(1000);
  await page.getByTestId("layer-event").click();
  await page.waitForTimeout(300);
  await page.getByTestId("tool-event").click();
  await page.waitForTimeout(300);

  // Try each event to find one with fork commands
  const eventRows = await page.locator('[data-testid*="event-list-row"]').count();
  console.log("Event rows:", eventRows);

  for (let ev = 0; ev < Math.min(eventRows, 5); ev++) {
    await page.locator('[data-testid*="event-list-row"]').nth(ev).click();
    await page.waitForTimeout(300);
    await page.getByTestId("event-editor-open").click();
    await page.waitForTimeout(1500);

    // Open preview
    const previewSummary = page.locator('.event-script-live-preview > summary');
    if (await previewSummary.count()) {
      await previewSummary.click();
      await page.waitForTimeout(400);
    }

    // Check if this event has fork commands
    const position = await page.locator('.event-script-live-position').textContent().catch(() => "");
    console.log(`Event ${ev}: position=${position}`);

    // Navigate through all steps looking for fork eval
    const nextBtn = page.locator('[data-testid="event-script-live-next"]');
    let foundFork = false;
    if (await nextBtn.count()) {
      const maxSteps = parseInt(position?.split("/")?.[1] ?? "1") || 1;
      for (let i = 0; i < maxSteps + 2; i++) {
        await nextBtn.click();
        await page.waitForTimeout(150);
        const forkEval = await page.locator('[data-testid="ecp-fork-eval"]').count();
        if (forkEval > 0) {
          console.log(`  Found fork eval at step ${i + 2}!`);
          foundFork = true;
          await page.screenshot({ path: `output/evidence/preview-qa-fork-event${ev}.png` });
          break;
        }
      }
    }

    const skipped = await page.locator('.ecp-skipped').count();
    const runtimeEffect = await page.locator('[data-testid="ecp-runtime-effect"]').count();
    console.log(`  Skipped: ${skipped}, Runtime effects: ${runtimeEffect}`);

    if (foundFork || skipped > 0 || runtimeEffect > 0) {
      console.log("FOUND_RICH_PREVIEW:", true);
      await page.screenshot({ path: "output/evidence/preview-qa-rich.png" });
      break;
    }

    // Close modal and try next event
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // Also verify both panels can be open simultaneously
  const previewOpen = await page.locator('.event-script-live-preview').first().evaluate(el => (el as HTMLDetailsElement).open).catch(() => false);
  const flowOpen = await page.locator('.event-script-flowchart').first().evaluate(el => (el as HTMLDetailsElement).open).catch(() => false);
  
  // Open flow too if not already
  if (!flowOpen) {
    const flowSummary = page.locator('.event-script-flowchart > summary');
    if (await flowSummary.count()) {
      await flowSummary.click();
      await page.waitForTimeout(400);
    }
  }
  const previewOpen2 = await page.locator('.event-script-live-preview').first().evaluate(el => (el as HTMLDetailsElement).open).catch(() => false);
  const flowOpen2 = await page.locator('.event-script-flowchart').first().evaluate(el => (el as HTMLDetailsElement).open).catch(() => false);
  console.log("BOTH_SIMULTANEOUS:", previewOpen2 && flowOpen2);
  await page.screenshot({ path: "output/evidence/preview-qa-final.png" });

  console.log("PAGE_ERRORS:", errors.length);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
