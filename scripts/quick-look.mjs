/** 레이아웃 반복 수정용 3컷 프로브: 커맨드 메뉴 → 스킬 서브메뉴 → 타깃 선택. */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const OUT = ".omo/battle-runs/quick-look";
const sleep = (n) => new Promise((r) => setTimeout(r, n));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 200)));
await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(9000);
await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
await page.waitForSelector(".battle-scene", { timeout: 30000 });
await sleep(600);
const clip = { x: 398, y: 194, width: 646, height: 516 };
await page.screenshot({ path: `${OUT}/0-intro.png`, clip });
await sleep(2200);
await page.screenshot({ path: `${OUT}/1-command.png`, clip });
// 스킬 서브메뉴: ArrowRight(스킬) → Enter
await page.keyboard.press("ArrowRight"); await sleep(250);
await page.keyboard.press("Enter"); await sleep(500);
await page.screenshot({ path: `${OUT}/2-submenu.png`, clip });
await page.keyboard.press("Escape"); await sleep(400);
// 공격 → 타깃 선택
await page.keyboard.press("ArrowLeft"); await sleep(250);
await page.keyboard.press("Enter"); await sleep(600);
await page.screenshot({ path: `${OUT}/3-target.png`, clip });
// 타깃 확정 → 액션 중간
await page.keyboard.press("Enter"); await sleep(900);
await page.screenshot({ path: `${OUT}/4-action.png`, clip });
await sleep(1200);
await page.screenshot({ path: `${OUT}/5-after.png`, clip });
await browser.close();
console.log("saved to", OUT);
