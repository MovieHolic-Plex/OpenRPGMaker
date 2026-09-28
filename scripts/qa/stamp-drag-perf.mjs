/**
 * 드래그·바로 깔기 성능 측정 — 같은 조건으로 전·후를 비교한다.
 *   BASE=http://127.0.0.1:9924 MODE=editor|studio LABEL=before node scripts/qa/stamp-drag-perf.mjs
 * 재는 것:
 *  ① 우클릭 드래그 pointermove 한 번의 메인 스레드 비용 — 40걸음 드래그를 requestAnimationFrame 간격으로 재생,
 *     걸음마다 (입력 → 다음 rAF) 벽시계와 스크립트 안 editorState 구독자 시간. Long Tasks 합.
 *  ② 바로 깔기 적용 한 번의 가장 긴 작업(ms) — 모델은 즉시 응답하는 스텁.
 *  ③ 적용 도중 다음 드래그 바가 뜨기까지(ms).
 * 결과는 verify-shots/stamp-drag-perf/<LABEL>-<MODE>.json.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9924";
const MODE = process.env.MODE ?? "editor";
const LABEL = process.env.LABEL ?? "run";
const OUT = process.env.OUT ?? "verify-shots/stamp-drag-perf";
const REPS = Number(process.env.REPS ?? 3);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.addInitScript(() => {
  localStorage.setItem("oprn:ai-stamp-place", "1");
  window.__longTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push({ start: e.startTime, ms: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
});
await page.route("**/v1/chat/completions", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  const user = body.messages?.find((m) => m.role === "user");
  let payload = {}; try { payload = JSON.parse(user.content); } catch {}
  const t = payload.target ?? { x: 0, y: 0, w: 4, h: 4 };
  const step = { tool: "fill_region", label: "흙", args: { rect: t, material: "흙", shape: "circle" } };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ steps: [step] }) } }] }) });
});
await page.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 180000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.waitForTimeout(3000);
if (MODE === "studio") {
  await page.getByTestId("topbar-ai-studio").click();
  await page.getByTestId("ai-studio-shell").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(2500);
}
await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === "function", null, { timeout: 30000 });
const tileSize = await page.evaluate(() => {
  const vp = window.__oprnEditMapViewport?.(); const to = window.__oprnEditWorldToClient;
  const k = to(1, 0).x - to(0, 0).x; const c = document.querySelector("[data-testid=edit-canvas] canvas")?.getBoundingClientRect();
  for (const s of [48, 32, 16]) if (c && vp.viewW * s * k <= c.width + 1) return s; return 16;
});
const pt = (x, y) => page.evaluate(([x, y, s]) => window.__oprnEditWorldToClient(x * s + s / 2, y * s + s / 2), [x, y, tileSize]);
// 첫 우클릭 안내 토스트를 미리 소비한다(측정 드래그에 끼지 않게).
{
  const a = await pt(15, 10), b = await pt(16, 11);
  await page.mouse.move(a.x, a.y); await page.mouse.down({ button: "right" }); await page.mouse.move(b.x, b.y, { steps: 2 }); await page.mouse.up({ button: "right" });
  await page.waitForTimeout(800); await page.keyboard.press("Escape"); await page.waitForTimeout(800);
}

/** 드래그 한 번: 걸음마다 pointermove 를 보내고 다음 프레임까지의 시간을 잰다. */
async function measureDrag(from, to, steps = 40) {
  const a = await pt(from[0], from[1]), b = await pt(to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  const ltBefore = await page.evaluate(() => performance.now());
  await page.mouse.down({ button: "right" });
  const perStep = [];
  for (let i = 1; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
    const t0 = Date.now();
    await page.mouse.move(x, y);
    // 입력이 처리되고 다음 프레임이 그려질 때까지.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    perStep.push(Date.now() - t0);
  }
  await page.mouse.up({ button: "right" });
  const barMs = await (async () => {
    const t0 = Date.now();
    await page.getByTestId("selection-chip-prompt").waitFor({ state: "visible", timeout: 60000 });
    return Date.now() - t0;
  })();
  const lt = await page.evaluate((from) => window.__longTasks.filter((t) => t.start >= from).map((t) => Math.round(t.ms)), ltBefore);
  perStep.sort((p, q) => p - q);
  return { stepMedian: perStep[Math.floor(perStep.length / 2)], stepP90: perStep[Math.floor(perStep.length * 0.9)], stepMax: perStep.at(-1), longTaskSum: lt.reduce((s, v) => s + v, 0), longTaskMax: Math.max(0, ...lt), barMs };
}

/** 바로 깔기 적용 한 번 — 가장 긴 작업 · 전송→완료. */
async function measureApply(index) {
  const from = [1 + (index % 3) * 6, 1 + Math.floor(index / 3) * 5], to = [from[0] + 4, from[1] + 3];
  const a = await pt(from[0], from[1]), b = await pt(to[0], to[1]);
  await page.mouse.move(a.x, a.y); await page.mouse.down({ button: "right" }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up({ button: "right" });
  const prompt = page.getByTestId("selection-chip-prompt");
  await prompt.waitFor({ state: "visible", timeout: 60000 });
  await prompt.fill("흙 원 " + index);
  const before = await page.evaluate(() => performance.now());
  const doneBefore = await page.evaluate(() => [...document.querySelectorAll("[data-testid=ai-command-row]")].filter((r) => (r.textContent ?? "").includes("— 완료")).length);
  const t0 = Date.now();
  await prompt.press("Enter");
  await page.waitForFunction((n) => [...document.querySelectorAll("[data-testid=ai-command-row]")].filter((r) => (r.textContent ?? "").includes("— 완료")).length > n, doneBefore, { timeout: 90000 });
  const total = Date.now() - t0;
  await page.waitForTimeout(600);
  const lt = await page.evaluate((from) => window.__longTasks.filter((t) => t.start >= from).map((t) => Math.round(t.ms)), before);
  return { total, longTaskMax: Math.max(0, ...lt), longTaskSum: lt.reduce((s, v) => s + v, 0) };
}

const drags = [];
for (let i = 0; i < REPS; i++) {
  drags.push(await measureDrag([1 + i, 1], [12 + i, 9]));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}
const applies = [];
for (let i = 0; i < REPS; i++) applies.push(await measureApply(i));
const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const summary = {
  label: LABEL, mode: MODE, tileSize, nodes,
  drag: { stepMedianMs: med(drags.map((d) => d.stepMedian)), stepP90Ms: med(drags.map((d) => d.stepP90)), longTaskSumMs: med(drags.map((d) => d.longTaskSum)), barMs: med(drags.map((d) => d.barMs)) },
  apply: { totalMs: med(applies.map((a) => a.total)), longTaskMaxMs: med(applies.map((a) => a.longTaskMax)), longTaskSumMs: med(applies.map((a) => a.longTaskSum)) },
  raw: { drags, applies },
};
await writeFile(path.join(OUT, LABEL + "-" + MODE + ".json"), JSON.stringify(summary, null, 2));
console.log(LABEL + " " + MODE + " drag step median=" + summary.drag.stepMedianMs + "ms p90=" + summary.drag.stepP90Ms + "ms longtask=" + summary.drag.longTaskSumMs + "ms bar=" + summary.drag.barMs
  + "ms | apply total=" + summary.apply.totalMs + "ms longest=" + summary.apply.longTaskMaxMs + "ms sum=" + summary.apply.longTaskSumMs + "ms nodes=" + nodes);
await browser.close();

