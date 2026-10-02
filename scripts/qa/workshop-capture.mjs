// 공방 화면을 모델 없이 찍는다: window.__oprnWorkshopChat 가짜 채팅(dev 빌드 전용)이 격자와 검수 답을 낸다.
// BASE=http://127.0.0.1:9803 node scripts/qa/workshop-capture.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9803";
const out = resolve("verify-shots/workshop");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const shots = [];
page.on("pageerror", (error) => errors.push(error.message));
const shot = async (name, note) => { await page.screenshot({ path: resolve(out, `${name}.png`) }); shots.push({ name, note }); };

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
  localStorage.removeItem("oprn:ai-sidebar-collapsed");
  let calls = 0;
  window.__oprnWorkshopChat = async (surface, request) => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 300));
    const text = JSON.stringify(request.messages);
    if (surface === "workshop-review") {
      const failing = calls % 7 === 0;
      return JSON.stringify({ verdict: failing ? "FAIL" : "PASS", codes: failing ? ["FRONT"] : [], top: failing ? "윗판 윗면 2행" : "윗판 윗면 3행(y=4~6)", top_rows: failing ? 2 : 3, reasons: failing ? "윗판이 2행" : "윗판 3행", fix: failing ? "윗판을 3행으로" : "", worse: false });
    }
    const m = /캔버스 (\d+)×(\d+)px/.exec(text);
    const w = Number(m?.[1] ?? 16), h = Number(m?.[2] ?? 16);
    const pad = Number(/맨 위 (\d+)줄은 비운다/.exec(text)?.[1] ?? 0);
    const shade = ["wood:3", "wood:5", "pine:3", "dwood:4", "stone:4"][calls % 5];
    const rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
      if (y < Math.max(pad, 2) || x < 1 || x >= w - 1) return ".";
      if (y < Math.max(pad, 2) + 3) return "t";
      return x === 1 || x === w - 2 || y === h - 1 ? "o" : "f";
    }).join(""));
    return JSON.stringify({ legend: { t: "wood:7", f: shade, o: "wood:1" }, rows, note: "가짜 그림 · 꼭대기 윗면 3행", topRows: 3 });
  };
});
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByTestId("sidebar-workshop").click();
  await page.getByTestId("left-workshop-pane").waitFor();
  await shot("01-left-pane", "왼쪽 막대 「공방」 판");
  await page.getByTestId("left-workshop-open-interior-props").click();
  await page.getByTestId("workshop").waitFor();
  await page.getByTestId("workshop-filter-all").click();
  await page.locator('[data-testid="workshop-item"][data-key="wardrobe"]').click().catch(() => page.getByTestId("workshop-item").first().click());
  await shot("02-item-empty", "기물 선택, 아직 판 없음 — 지금 그림 비교");
  await page.getByTestId("workshop-start-round").click();
  await page.waitForTimeout(1500);
  await shot("03-drawing", "후보 그리는 중(진행 줄)");
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="workshop-card"]')].every((card) => ["done", "failed"].includes(card.getAttribute("data-status"))), null, { timeout: 120_000 });
  await shot("04-round-done", "후보 5장 · 꼭대기 행 · 검수 칩");
  await page.keyboard.press("3");
  await page.keyboard.press("f");
  await shot("05-zoom-compare", "3번 선택 · 크게 · 비교");
  await page.keyboard.press("x");
  await shot("06-reject-reasons", "버리기 이유 칩");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await shot("07-picked", "고름 표시");
  await page.getByTestId("workshop-new-item").click();
  await page.getByTestId("workshop-item-form").waitFor();
  await shot("08-new-item-form", "새 기물 정의 폼");
} finally {
  writeFileSync(resolve(out, "SUMMARY.md"), [
    "# 공방 화면 캡처 (가짜 모델)", "",
    `- 기준: ${base}`, `- 페이지 오류: ${errors.length ? errors.join(" / ") : "없음"}`, "",
    ...shots.map((s) => `- \`${s.name}.png\` — ${s.note}`), "",
    "즉시 확인: 04-round-done.png, 05-zoom-compare.png",
  ].join("\n") + "\n");
  await browser.close();
}
if (errors.length) process.exitCode = 1;
