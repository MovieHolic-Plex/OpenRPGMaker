import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto('http://127.0.0.1:9853/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
// open the maps sidebar first
await page.click('[data-testid="sidebar-maps"]').catch(e => console.log('sidebar fail:', e.message.slice(0, 80)));
await page.waitForTimeout(800);
const vis = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="map-sidebar-properties-tab"]');
  return el ? el.offsetParent !== null : 'missing';
});
console.log('props tab visible after sidebar open:', vis);
if (vis === true) {
  await page.click('[data-testid="map-sidebar-properties-tab"]');
  await page.waitForTimeout(1200);
  const sections = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="map-props-section"]')).map(b => b.getAttribute('data-testid')));
  console.log('sections:', JSON.stringify(sections));
}
await browser.close();
