/**
 * 실행형 HTML 이 정말 더블클릭으로 도는지 증명한다 — `file://` 로 직접 연다.
 *
 * 단위 테스트로는 안 잡히는 게 여기서 나온다. 실제로 잡았던 것들:
 * - `type=module` 스크립트와 외부 CSS 가 file:// 에서 CORS 로 막힘
 * - Phaser 를 `import.meta.url` 로 주입하다 단일 번들에서 주소 실종
 * - 에셋 프리워밍이 원본 경로를 때려 ERR_FILE_NOT_FOUND 36건
 *
 *   npm run build:standalone -- --out /tmp/standalone-game.html
 *   node scripts/qa-standalone-boot.mjs /tmp/standalone-game.html
 *
 * 통과 기준: 타이틀 표시 → 새 게임 진입 → 방향키로 화면이 바뀜, 그리고 네트워크 실패 0 · 콘솔
 * 에러 0. 스크린샷은 <html경로>.png 로 남긴다(맵은 WebGL 이라 픽셀을 JS 로 못 읽는다).
 */
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const target = process.argv[2] ?? "dist/oprn-game.html";
const url = pathToFileURL(resolve(target)).href;
const shot = `${resolve(target)}.png`;

const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
const consoleErrors = [];
page.on("requestfailed", (request) => failures.push(`FAILED ${request.url().slice(0, 100)}`));
page.on("response", (response) => {
  if (response.status() >= 400) failures.push(`${response.status()} ${response.url().slice(0, 100)}`);
});
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200)); });
page.on("pageerror", (error) => consoleErrors.push(`PAGEERROR ${String(error).slice(0, 200)}`));

const problems = [];
try {
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 90_000 });
  console.log("타이틀     : 표시됨");

  await page.keyboard.press("Enter");
  await page.waitForSelector("canvas", { timeout: 90_000 });
  await page.waitForTimeout(6000);
  console.log("맵 진입    : 완료");

  // 캔버스에 포커스를 준 뒤 키를 **유지**해야 한 칸이 실제로 움직인다.
  await page.locator("canvas").click({ position: { x: 10, y: 10 } }).catch(() => {});
  const before = await page.screenshot();
  for (const key of ["ArrowRight", "ArrowDown"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(900);
    await page.keyboard.up(key);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1200);
  const after = await page.screenshot({ path: shot });
  const moved = Buffer.compare(before, after) !== 0;
  console.log(`이동       : ${moved ? "화면이 바뀜" : "변화 없음"}`);
  if (!moved) problems.push("방향키를 눌러도 화면이 그대로다");

  const stuck = await page.locator("text=불러오는 중").count();
  if (stuck > 0) problems.push(`로딩 표시가 ${stuck}개 남아 있다`);
} catch (error) {
  problems.push(`부팅 실패: ${String(error).slice(0, 200)}`);
} finally {
  await browser.close();
}

console.log(`네트워크   : 실패 ${failures.length}건`);
for (const line of failures.slice(0, 10)) console.log("  -", line);
console.log(`콘솔       : 에러 ${consoleErrors.length}건`);
for (const line of consoleErrors.slice(0, 10)) console.log("  !", line);
console.log(`스크린샷   : ${shot}`);

if (failures.length > 0) problems.push(`네트워크 실패 ${failures.length}건`);
if (consoleErrors.length > 0) problems.push(`콘솔 에러 ${consoleErrors.length}건`);
if (problems.length > 0) {
  console.error(`\n실패: ${problems.join(" / ")}`);
  process.exit(1);
}
console.log("\n통과: file:// 에서 부팅·진입·이동이 모두 됐고 실패 0건이다.");
