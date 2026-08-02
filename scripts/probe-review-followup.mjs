// 후속 계측: ① 반복 ERR_CONNECTION_REFUSED 의 URL ② 적 HUD 동명 넘버링 클리핑
// ③ 다수 적 배치 겹침. 2마리 이상 트루프가 나올 때까지 랜덤 전투 재시도.
import { chromium } from "playwright";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const sleep = (n) => new Promise((r) => setTimeout(r, n));

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
const failed = [];
page.on("requestfailed", (r) => failed.push({ url: r.url().slice(0, 160), err: r.failure()?.errorText }));
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(12000);

let info = null;
for (let attempt = 0; attempt < 8 && !info; attempt += 1) {
  await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
  await page.waitForSelector(".battle-scene", { timeout: 30000 });
  await sleep(2600);
  info = await page.evaluate(() => {
    const enemies = Array.from(document.querySelectorAll(".battle-enemy:not(.defeated)"));
    if (enemies.length < 2) return null;
    const imgRect = (n) => {
      const img = n.querySelector(".battle-enemy-image, .battle-actor-sprite");
      const r = (img ?? n).getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const rects = enemies.map(imgRect);
    const overlaps = [];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i], b = rects[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0 && oy > 0) overlaps.push({ i, j, ox, oy });
      }
    }
    const names = Array.from(document.querySelectorAll(".battle-enemy-list-name")).map((n) => ({
      text: n.textContent,
      clientW: n.clientWidth,
      scrollW: n.scrollWidth,
      clipped: n.scrollWidth > n.clientWidth + 1,
      visibleApprox: getComputedStyle(n).textOverflow,
    }));
    return { enemyCount: enemies.length, rects, overlaps, names };
  });
  if (!info) {
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.querySelector(".battle-scene")?.closest(".test-play-modal-backdrop")?.querySelector("[aria-label='닫기'], .test-play-close")?.click());
    // 도주로 전투 종료 시도 후 재진입
    await page.keyboard.press("ArrowDown").catch(() => {});
    await sleep(300);
    // 그냥 모달 X 버튼
    const closeBtn = page.locator(".test-play-modal-backdrop button:has-text('X')").first();
    if (await closeBtn.count()) await closeBtn.click().catch(() => {});
    await sleep(1500);
  }
}
console.log(JSON.stringify({ failedRequests: failed.slice(0, 10), battle: info }, null, 1));
await browser.close();
