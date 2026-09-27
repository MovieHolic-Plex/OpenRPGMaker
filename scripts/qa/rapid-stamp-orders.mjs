/**
 * 드래그 연속 바로 깔기 QA — 표준 편집기와 스튜디오 모드에서 우클릭 드래그로 주문 세 개를 연달아 내린다.
 *
 *   BASE=http://127.0.0.1:<워크트리 포트> OUT=verify-shots/rapid-stamp node scripts/qa/rapid-stamp-orders.mjs
 *
 * 모델 호출(/v1/chat/completions)은 page.route 로 스텁한다 — 응답을 PLAN_DELAY_MS 늦춰 주문이 겹쳐 도는 구간을 만든다.
 * 스텁은 요청의 target 사각형 안에 흙 원 하나(fill_region)를 돌려준다. 도구·스토어·캔버스는 실제 경로다.
 * 확인: ① 두 번째·세 번째 드래그가 거절되지 않는다 ② 떨어진 두 영역은 동시에 읽힌다(inflightMax ≥ 2)
 *       ③ 겹친 셋째는 첫째가 끝날 때까지 기다린다 ④ 세 주문의 결과가 채팅에 번호와 함께 남는다.
 * blankProject 세션이라 정본 저장 증거가 아니다(코드 QA 전용).
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9924";
const OUT = process.env.OUT ?? "verify-shots/rapid-stamp";
const PLAN_DELAY_MS = Number(process.env.PLAN_DELAY_MS ?? 2500);
await mkdir(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let inflight = 0;
let inflightMax = 0;
const requests = [];

function planFor(body) {
  const user = body.messages?.find((m) => m.role === "user");
  let payload = {};
  try { payload = JSON.parse(typeof user?.content === "string" ? user.content : ""); } catch { /* repair prompt */ }
  const target = payload.target ?? { x: 0, y: 0, w: 4, h: 4 };
  const material = payload.fillMaterials?.[0]?.label ?? payload.fillMaterials?.[0] ?? "흙";
  return {
    steps: [{
      tool: "fill_region",
      label: String(payload.sentence ?? "채우기").slice(0, 12),
      args: { rect: { x: target.x, y: target.y, w: target.w, h: target.h }, material: typeof material === "string" ? material : "흙", shape: "circle" },
    }],
  };
}

async function run(mode) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 240)));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:ai-stamp-place", "1");
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__longTasks.push({ start: Math.round(entry.startTime), ms: Math.round(entry.duration) });
      }).observe({ type: "longtask", buffered: true });
    } catch { /* 없는 브라우저 */ }
  });
  await page.route("**/v1/chat/completions", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    inflight += 1;
    inflightMax = Math.max(inflightMax, inflight);
    const started = Date.now();
    await sleep(PLAN_DELAY_MS);
    inflight -= 1;
    const plan = planFor(body);
    requests.push({ mode, started, ms: Date.now() - started, target: plan.steps[0].args.rect });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "stub", model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(plan) } }] }),
    });
  });

  await page.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.waitForTimeout(1500);
  if (mode === "studio") {
    await page.getByTestId("topbar-ai-studio").click();
    await page.getByTestId("ai-studio-shell").waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForTimeout(1200);
  }

  await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === "function", null, { timeout: 20_000 }).catch(() => undefined);
  // 월드 좌표의 칸 한 변(맵마다 16/32/48). 맵 전체(viewW 칸)가 캔버스 안에 들어가는 가장 큰 후보를 고른다.
  const tileSize = await page.evaluate(() => {
    const vp = window.__oprnEditMapViewport?.();
    const to = window.__oprnEditWorldToClient;
    if (!vp || !to) return 32;
    const pxPerWorld = to(1, 0).x - to(0, 0).x;
    const canvas = document.querySelector("[data-testid=edit-canvas] canvas")?.getBoundingClientRect();
    // 맵이 캔버스보다 작으면 가운데 놓인다 — 칸 폭 후보 중 viewW 칸이 캔버스 안에 들어가는 가장 큰 값.
    for (const size of [48, 32, 16]) if (canvas && vp.viewW * size * pxPerWorld <= canvas.width + 1) return size;
    return 16;
  });
  console.log("tileSize", tileSize);
  const canvasBox = await page.getByTestId("edit-canvas").locator("canvas").boundingBox();
  const tileToClient = async (tx, ty) => {
    const viaHook = await page.evaluate(([x, y, size]) => window.__oprnEditWorldToClient?.(x * size + size / 2, y * size + size / 2) ?? null, [tx, ty, tileSize]);
    if (viaHook) return viaHook;
    // 훅이 없으면 캔버스 왼쪽 위 기준으로 어림한다(줌 1 가정).
    return canvasBox ? { x: canvasBox.x + tx * tileSize + tileSize / 2, y: canvasBox.y + ty * tileSize + tileSize / 2 } : null;
  };

  const drag = async (from, to, sentence) => {
    const began = Date.now();
    const a = await tileToClient(from[0], from[1]);
    const b = await tileToClient(to[0], to[1]);
    if (!a || !b) throw new Error("world→client 변환이 없습니다");
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up({ button: "right" });
    const prompt = page.getByTestId("selection-chip-prompt");
    try {
      await prompt.waitFor({ state: "visible", timeout: 20000 });
    } catch (error) {
      await page.screenshot({ path: path.join(OUT, mode + "-debug-no-bar.png") });
      const info = await page.evaluate(() => [...document.querySelectorAll("[data-testid=selection-chip-prompt]")].map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const bar = el.closest("[data-testid=selection-action-chips]");
        return { rect: [r.x, r.y, r.width, r.height], vis: cs.visibility, disp: cs.display, barVis: bar ? getComputedStyle(bar).visibility : null, connected: el.isConnected };
      }));
      console.log("debug", JSON.stringify({ a, b, info }).slice(0, 600));
      throw error;
    }
    await prompt.fill(sentence);
    await prompt.press("Enter");
    console.log("  drag " + sentence + " " + (Date.now() - began) + "ms");
    await page.waitForTimeout(250);
  };

  const snap = () => page.evaluate(() => ({
    queue: document.querySelector("[data-testid=ai-pending-queue]")?.textContent ?? "",
    abortVisible: !document.querySelector("[data-testid=ai-abort]")?.hidden,
    toasts: [...document.querySelectorAll(".toast, [data-testid=toast]")].map((t) => t.textContent?.slice(0, 60)),
    rows: [...document.querySelectorAll("[data-testid=ai-command-row]")].map((r) => (r.textContent ?? "").replace(/\s+/g, " ").slice(0, 90)),
  }));

  const t0 = Date.now();
  const perfStart = await page.evaluate(() => performance.now());
  await drag([1, 1], [5, 4], "왼쪽 위에 흙 원");
  await drag([12, 1], [16, 4], "오른쪽 위에 흙 원");
  await drag([3, 3], [7, 6], "겹친 자리에 흙 원");
  const afterSend = await snap();
  await page.screenshot({ path: path.join(OUT, mode + "-01-three-orders.png") });
  await page.waitForTimeout(PLAN_DELAY_MS + 400);
  const mid = await snap();
  await page.screenshot({ path: path.join(OUT, mode + "-02-third-running.png") });
  await page.waitForTimeout(PLAN_DELAY_MS * 2 + 1000);
  const done = await snap();
  await page.screenshot({ path: path.join(OUT, mode + "-03-all-done.png") });
  const elapsed = Date.now() - t0;
  const longTasks = await page.evaluate((from) => window.__longTasks.filter((t) => t.start >= from), perfStart);
  console.log("  longtasks>200ms " + JSON.stringify(longTasks.filter((t) => t.ms > 200).map((t) => [t.start - Math.round(perfStart), t.ms])));
  await browser.close();
  return { mode, elapsed, afterSend, mid, done, longTasks, errors: errors.slice(0, 6) };
}

const report = [];
for (const mode of ["editor", "studio"]) {
  inflight = 0;
  inflightMax = 0;
  const before = requests.length;
  const result = await run(mode);
  report.push({ ...result, inflightMax, modelCalls: requests.length - before });
  console.log(mode + ": elapsed=" + result.elapsed + "ms inflightMax=" + inflightMax + " calls=" + (requests.length - before)
    + " queue@send=\"" + result.afterSend.queue + "\" queue@mid=\"" + result.mid.queue + "\" queue@done=\"" + result.done.queue + "\" errors=" + result.errors.length);
}
await writeFile(path.join(OUT, "report.json"), JSON.stringify({ report, requests }, null, 2));
console.log("report → " + path.join(OUT, "report.json"));

