// 적 정보 패널 행 레이아웃 프로브 — 1줄 압축(grid name|bar)이 어긋난 원인 확인.
import { chromium } from "playwright";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const sleep = (n) => new Promise((r) => setTimeout(r, n));

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(9000);
await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
await page.waitForSelector(".battle-scene", { timeout: 30000 });
await sleep(2500);

const info = await page.evaluate(() => {
  const row = document.querySelector(".battle-enemy-list-row");
  if (!row) return null;
  const dump = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      cls: el.className, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      display: cs.display, position: cs.position, gridColumn: cs.gridColumn, gridRow: cs.gridRow,
      gridTemplateColumns: cs.gridTemplateColumns, width: cs.width, marginLeft: cs.marginLeft,
      before: getComputedStyle(el, "::before").content,
      after: getComputedStyle(el, "::after").content,
    };
  };
  return {
    row: dump(row),
    children: Array.from(row.children).map(dump),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
