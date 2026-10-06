// Preview capture only: open the eight actual GIF files, without game/test code.
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(pathToFileURL(path.join(__dirname, 'review.html')).href);
    await page.evaluate(() => {
      document.body.className = 'one';
      document.querySelectorAll('h1,h2,p,body>div:not(.grid)').forEach(e => e.remove());
      const css = document.createElement('style');
      css.textContent = '.grid{grid-template-columns:repeat(4,1fr)}.stage{height:120px}body{margin:12px}.contact{display:none}';
      document.head.append(css);
    });
    for (const [name, delay] of [['a', 250], ['b', 680], ['c', 680]]) {
      await page.waitForTimeout(delay);
      await page.screenshot({ path: path.join(__dirname, 'png', `gif-playback-${name}.png`) });
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
