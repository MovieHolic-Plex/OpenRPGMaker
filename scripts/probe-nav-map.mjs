// 커맨드 그리드 2D 내비게이션 전수 매핑 — (시작 버튼, 방향) → 도착 버튼.
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

const cursorId = () => page.evaluate(() =>
  document.querySelector("[data-battle-command-cursor='true']")?.dataset.testid ?? null);
const rects = await page.evaluate(() =>
  [...document.querySelectorAll("button.battle-command")].map((b) => {
    const r = b.getBoundingClientRect();
    return { id: b.dataset.testid, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), disabled: b.disabled };
  }));
console.log("layout:", JSON.stringify(rects, null, 1));

// 커서를 특정 버튼으로 옮기는 헬퍼: focus로 이동(포커스가 커서 인덱스를 갱신한다는 계약)
const setCursor = async (id) => {
  await page.evaluate((tid) => {
    document.querySelector(`[data-testid='${tid}']`)?.focus();
  }, id);
  await sleep(150);
};

const ids = rects.filter((r) => !r.disabled).map((r) => r.id);
for (const id of ids) {
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
    await setCursor(id);
    const before = await cursorId();
    await page.keyboard.press(key);
    await sleep(150);
    const after = await cursorId();
    console.log(`${before} --${key.replace("Arrow", "")}--> ${after}`);
  }
}
await browser.close();
