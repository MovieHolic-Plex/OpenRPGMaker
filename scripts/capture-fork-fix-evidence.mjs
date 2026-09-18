// scripts/capture-fork-fix-evidence.mjs
// 조건 분기 수정 증거: fork 폼(라벨 통일+타이머 경고+판정 뱃지) 스크린샷.
// QA_BASE_URL 로 dev 서버 주소를 준다.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:9843";
const label = process.argv[2] ?? "fork-fix";
const evidenceDir = `.omo/evidence/fork-branch-fix/${label}`;
mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
const page = await context.newPage();
const failures = [];
try {
  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  // 부팅 폴링
  const bootDeadline = Date.now() + 180000;
  let booted = false;
  while (Date.now() < bootDeadline) {
    booted = await page.evaluate(() => {
      const host = document.querySelector("[data-testid=edit-canvas]");
      const c = host?.querySelector("canvas");
      const layer = document.querySelector("[data-testid=layer-event]");
      return Boolean(c && c.getBoundingClientRect().width > 200 && layer && layer.getClientRects().length > 0);
    }).catch(() => false);
    if (booted) break;
    await page.waitForTimeout(2000);
  }
  if (!booted) throw new Error("boot failed");

  // 이벤트 모달 열기
  const canvas = page.getByTestId("edit-canvas").locator("canvas").last();
  await page.getByTestId("layer-event").click();
  const editor = page.getByTestId("event-editor-modal");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing canvas");
  for (const offset of [0, 32, -32]) {
    await canvas.dblclick({ position: { x: Math.floor(box.width / 2) + offset, y: Math.floor(box.height / 2) + offset } });
    if (await editor.isVisible().catch(() => false)) break;
    await page.waitForTimeout(800);
  }
  await editor.waitFor({ state: "visible", timeout: 25000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${evidenceDir}/01-event-editor.png` });

  // 조건 분기 명령 추가: [+ 명령] → 검색 "분기" → 선택
  await page.getByTestId("event-command-toolbar-add").click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${evidenceDir}/02-picker.png` });
  const search = page.locator("input[placeholder*='명령 검색'], input[placeholder*='검색']").first();
  if (await search.count()) {
    await search.fill("분기");
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `${evidenceDir}/02b-picker-search.png` });
  const forkClicked = await page.evaluate(() => {
    const btn = document.querySelector("[data-testid='command-add-branch']");
    if (!btn) return "missing";
    btn.scrollIntoView({ block: "center" });
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return "clicked";
  });
  console.log("forkClick:", forkClicked);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${evidenceDir}/03-fork-form.png` });

  const form = await page.evaluate(() => ({
    forkForm: Boolean(document.querySelector("[data-testid='event-command-fork-form']")),
    elseCheck: Boolean(document.querySelector("[data-testid='event-fork-else-enabled']")),
    elseLabel: document.querySelector(".event-fork-else-check span")?.textContent ?? null,
    evalBadge: document.querySelector("[data-testid='event-condition-eval-badge']")?.textContent ?? null,
    summaryThen: document.querySelector("[data-testid='event-fork-summary-then']")?.textContent ?? null,
  }));
  console.log("form:", JSON.stringify(form));
  if (!form.forkForm) failures.push("fork form not visible");

  // 타이머 조건으로 전환 → 경고 확인
  const modeSelect = page.getByTestId("event-condition-mode");
  if (await modeSelect.count()) {
    await modeSelect.first().selectOption("timer");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${evidenceDir}/04-timer-warning.png` });
    const timer = await page.evaluate(() => ({
      warning: document.querySelector("[data-testid='event-fork-timer-warning']")?.textContent ?? null,
    }));
    console.log("timer:", JSON.stringify(timer));
    if (!timer.warning) failures.push("timer warning not visible");
  }

  // 구역 조건으로 전환 → 뱃지 판정 확인(편집 중 맵 기준 충족/판정 불가)
  if (await modeSelect.count()) {
    await modeSelect.first().selectOption("insideLocation");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${evidenceDir}/05-inside-location.png` });
    const loc = await page.evaluate(() => ({
      badge: document.querySelector("[data-testid='event-condition-eval-badge']")?.textContent ?? null,
      summary: document.querySelector("[data-testid='event-condition-eval-summary']")?.textContent ?? null,
    }));
    console.log("insideLocation:", JSON.stringify(loc));
    if (!loc.badge) failures.push("insideLocation badge not visible");
  }
} catch (e) {
  failures.push(String(e).slice(0, 300));
  console.log("ERROR:", failures[failures.length - 1]);
  await page.screenshot({ path: `${evidenceDir}/00-failure.png` }).catch(() => {});
} finally {
  await browser.close();
}
console.log(failures.length ? `FAIL ${failures.length}: ${failures.join("; ")}` : "EVIDENCE-OK");
process.exit(failures.length ? 1 : 0);
