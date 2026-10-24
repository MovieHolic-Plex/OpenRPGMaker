// 공방 「캐릭터 → 사진으로 만들기」를 실제 호스트로 끝까지 돌려 찍는다: 사진 고르기 → 후보(호스트가 고정판 char-gen photo 를
// 사용자 CLI 로 돈다, 수 분) → 하나 고르기 → 묶음 → 이 게임에 넣기. 사진은 저장소에 두지 않는다(PHOTO 로 준다).
// BASE=http://127.0.0.1:9845 PHOTO=/path/photo.jpg OUT=verify-shots/workshop-photo node scripts/qa/workshop-photo-capture.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9845";
const photo = process.env.PHOTO;
if (!photo) throw new Error("PHOTO=사진 경로 를 주세요");
const out = resolve(process.env.OUT ?? "verify-shots/workshop-photo");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(120_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
});
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
const shot = (name) => page.screenshot({ path: resolve(out, `${name}.png`) });
const t0 = Date.now();
let result = "unfinished";
try {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 240_000 });
      await page.getByTestId("sidebar-workshop").click({ timeout: 180_000 });
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }
  await page.getByTestId("workshop-oneclick-tab-character").click();
  await page.getByTestId("workshop-gen-photo-open").click();
  const step = page.getByTestId("workshop-gen-step-photo");
  await step.waitFor();
  await shot("01-open");
  await page.getByTestId("workshop-gen-photo-file").setInputFiles(photo);
  await page.getByTestId("workshop-gen-photo-name").fill("빨간 가디건의 소녀");
  await page.waitForTimeout(500);
  await step.screenshot({ path: resolve(out, "02-photo.png") });
  await page.getByTestId("workshop-gen-photo-start").click();
  await page.waitForTimeout(8000);
  await step.screenshot({ path: resolve(out, "03-running.png") });
  await page.getByTestId("workshop-gen-photo-card").first().waitFor({ timeout: 40 * 60 * 1000 });
  await page.waitForTimeout(1500);
  await shot("04-candidates");
  await step.screenshot({ path: resolve(out, "04-candidates-step.png") });
  await page.getByTestId("workshop-gen-photo-pick").first().click();
  await page.getByTestId("workshop-gen-add").waitFor({ timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(1500);
  await shot("05-packed");
  await page.getByTestId("workshop-gen-add").click();
  await page.getByText("넣었어요 ✓").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await shot("06-added");
  result = "added";
} catch (error) {
  result = `error: ${error instanceof Error ? error.message : String(error)}`;
  await shot("99-error").catch(() => undefined);
} finally {
  writeFileSync(resolve(out, "SUMMARY.md"), `# 공방 캐릭터 · 사진으로 만들기\n\n- 기준: ${base}\n- 결과: ${result}\n- 걸린 시간: ${Math.round((Date.now() - t0) / 1000)}초\n- 페이지 오류: ${errors.length ? errors.join(" / ") : "없음"}\n`);
  await context.close();
  await browser.close();
}
