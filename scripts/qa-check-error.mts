import { chromium } from "playwright";

const BASE = "http://127.0.0.1:9999";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

  await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check for vite error overlay
  const overlay = page.locator("vite-error-overlay");
  if (await overlay.count()) {
    const shadow = await overlay.evaluateHandle(el => el.shadowRoot);
    const errorText = await shadow.evaluate(root => root?.textContent ?? "");
    console.log("VITE_ERROR:", errorText.slice(0, 2000));
  } else {
    console.log("No error overlay");
  }

  await page.screenshot({ path: "output/evidence/preview-qa-error-check.png" });
  await browser.close();
}

main().catch(console.error);
