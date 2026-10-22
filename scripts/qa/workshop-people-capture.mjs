// 공방 「캐릭터」 카드와 char-gen 묶음 가져오기(미리 보기 · 작업 줄 행)를 실제 화면으로 찍는다. 모델 없이 돈다 —
// 묶음은 char-gen 이 사용자 컴퓨터에서 만든 폴더(manifest.json + blobs/)를 그대로 넣는다.
// BASE=http://127.0.0.1:9865 OUT=verify-shots/workshop-people PACKS=/path/packA,/path/packB node scripts/qa/workshop-people-capture.mjs
// VIDEO=1 이면 첫 묶음 장면을 1배 영상(webm)으로 남긴다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9865";
const out = resolve(process.env.OUT ?? "verify-shots/workshop-people");
const packs = (process.env.PACKS ?? "").split(",").filter(Boolean);
const width = Number(process.env.W ?? 1280), height = Number(process.env.H ?? 800);
mkdirSync(out, { recursive: true });


const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width, height }, ...(process.env.VIDEO ? { recordVideo: { dir: out, size: { width, height } } } : {}) });
const page = await context.newPage();
const t0 = Date.now();
const marks = [];
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
try {
  // 콜드 Vite 첫 부팅은 가끔 「?blankProject=1」 이동에서 멈춘다 — 다시 연다(최대 3번).
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 240_000 });
      await page.getByTestId("sidebar-workshop").click({ timeout: 180_000 });
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }
  await page.getByTestId("left-workshop-pane").waitFor();
  await page.waitForTimeout(800);
  await shot("00-left-pane");
  await page.getByTestId("workshop-gen-card-char-gen").screenshot({ path: resolve(out, "00-char-card.png") });
  for (const [index, dir] of packs.entries()) {
    await page.getByTestId("workshop-gen-open-char-gen").click();
    await page.getByTestId("workshop-gen-step-import").waitFor();
    await page.getByTestId("workshop-gen-folder").setInputFiles(dir);
    await page.getByTestId("workshop-gen-result").locator("img, canvas").first().waitFor();
    await page.waitForTimeout(1500);
    await page.getByTestId("workshop-gen-step-import").scrollIntoViewIfNeeded();
    await shot(`${String(index + 1).padStart(2, "0")}-import`);
    await page.getByTestId("workshop-gen-result").screenshot({ path: resolve(out, `${String(index + 1).padStart(2, "0")}-preview.png`) });
    if (process.env.VIDEO && index === 0) {
      marks.push({ name: "lineup-start", s: (Date.now() - t0) / 1000 });
      await page.waitForTimeout(8000);
      marks.push({ name: "lineup-end", s: (Date.now() - t0) / 1000 });
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  const pill = page.getByTestId("workshop-queue-pill");
  if (await pill.count()) {
    await pill.click();
    await page.getByTestId("workshop-queue-panel").waitFor();
    await page.waitForTimeout(1200);
    await shot("90-queue");
    await page.getByTestId("workshop-queue-panel").screenshot({ path: resolve(out, "90-queue-panel.png") });
  }
} finally {
  writeFileSync(resolve(out, "SUMMARY.md"), `# 공방 캐릭터 화면\n\n- 기준: ${base}\n- 묶음: ${packs.join(", ")}\n- 페이지 오류: ${errors.length ? errors.join(" / ") : "없음"}\n- 영상 표시(초): ${JSON.stringify(marks)}\n`);
  await context.close();
  await browser.close();
}
