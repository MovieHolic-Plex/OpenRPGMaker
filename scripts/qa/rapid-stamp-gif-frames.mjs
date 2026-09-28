/**
 * 바로 깔기 연속 주문을 실제 편집기에서 찍어 GIF 프레임으로 남긴다.
 *   BASE=http://127.0.0.1:9924 OUT=/tmp/stamp-gif MODE=studio node scripts/qa/rapid-stamp-gif-frames.mjs
 * 모델 호출은 스텁(PLAN_DELAY_MS 지연 + 요청 target 안에 재료 하나). 프레임은 캔버스+채팅이 보이는 영역만 자른다.
 * 메인 스레드가 멈추면 screenshot 도 그만큼 기다린다 — 프레임 사이 실제 시간은 frames.json 에 남긴다.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9924";
const OUT = process.env.OUT ?? "/tmp/stamp-gif";
const MODE = process.env.MODE ?? "studio";
const PLAN_DELAY_MS = Number(process.env.PLAN_DELAY_MS ?? 3000);
await mkdir(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MATERIALS = ["물", "흙", "잔디"];
let call = 0;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.addInitScript(() => localStorage.setItem("oprn:ai-stamp-place", "1"));
await page.route("**/v1/chat/completions", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  const user = body.messages?.find((m) => m.role === "user");
  let payload = {}; try { payload = JSON.parse(user.content); } catch {}
  const t = payload.target ?? { x: 0, y: 0, w: 4, h: 4 };
  const sentence = String(payload.sentence ?? "");
  const material = sentence.includes("연못") ? "물" : sentence.includes("나무") ? null : "흙";
  call += 1;
  await sleep(PLAN_DELAY_MS);
  const step = material
    ? { tool: "fill_region", label: sentence.slice(0, 10), args: { rect: t, material, shape: "circle" } }
    : { tool: "place_props", label: sentence.slice(0, 10), args: { area: t, material: "침엽수", density: "dense" } };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ steps: [step] }) } }] }) });
});

await page.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded", timeout: 180000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 180000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.waitForTimeout(2500);
if (MODE === "studio") {
  await page.getByTestId("topbar-ai-studio").click();
  await page.getByTestId("ai-studio-shell").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(2000);
}
await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === "function", null, { timeout: 30000 });
// 토스트(첫 영역 안내)가 프레임을 가리지 않게 미리 한 번 걷는다.
const tileSize = await page.evaluate(() => {
  const vp = window.__oprnEditMapViewport?.(); const to = window.__oprnEditWorldToClient;
  const k = to(1, 0).x - to(0, 0).x; const c = document.querySelector("[data-testid=edit-canvas] canvas")?.getBoundingClientRect();
  for (const s of [48, 32, 16]) if (c && vp.viewW * s * k <= c.width + 1) return s; return 16;
});
const pt = (x, y) => page.evaluate(([x, y, s]) => window.__oprnEditWorldToClient(x * s + s / 2, y * s + s / 2), [x, y, tileSize]);

const frames = [];
let n = 0;
const t0 = Date.now();
const snap = async (caption) => {
  const file = path.join(OUT, String(n++).padStart(3, "0") + ".png");
  await page.screenshot({ path: file });
  frames.push({ file, at: Date.now() - t0, caption });
};

// 커서를 보이게 — 헤드리스는 포인터를 그리지 않는다.
await page.evaluate(() => {
  const dot = document.createElement("div");
  dot.id = "__qa-cursor";
  Object.assign(dot.style, { position: "fixed", width: "18px", height: "18px", marginLeft: "-9px", marginTop: "-9px", borderRadius: "50%",
    border: "2px solid #fff", background: "rgba(250,82,82,.85)", boxShadow: "0 0 0 2px rgba(0,0,0,.35)", zIndex: 2147483647, pointerEvents: "none", left: "-40px", top: "-40px" });
  document.body.append(dot);
  window.addEventListener("pointermove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
});

const drag = async (from, to, sentence) => {
  const a = await pt(from[0], from[1]), b = await pt(to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await snap("drag");
  await page.mouse.down({ button: "right" });
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(a.x + (b.x - a.x) * i / 4, a.y + (b.y - a.y) * i / 4, { steps: 3 });
    await snap("drag");
  }
  await page.mouse.up({ button: "right" });
  const prompt = page.getByTestId("selection-chip-prompt");
  await prompt.waitFor({ state: "visible", timeout: 60000 });
  await snap("bar");
  for (let i = 1; i <= sentence.length; i += 2) {
    await prompt.fill(sentence.slice(0, i));
    await snap("type");
  }
  await prompt.fill(sentence);
  await snap("type");
  await prompt.press("Enter");
  await page.waitForTimeout(150);
  await snap("sent");
};

await snap("start");
await drag([1, 1], [6, 5], "왼쪽에 연못");
await drag([12, 1], [17, 5], "오른쪽에 흙 원");
await drag([4, 4], [9, 8], "겹친 곳에 나무");
// 주문이 끝날 때까지 계속 찍는다.
const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  await snap("run");
  const active = await page.evaluate(() => (document.querySelector("[data-testid=ai-pending-queue]")?.textContent ?? "").includes("바로 깔기"));
  if (!active) break;
  await page.waitForTimeout(400);
}
for (let i = 0; i < 4; i++) { await page.waitForTimeout(400); await snap("done"); }
await writeFile(path.join(OUT, "frames.json"), JSON.stringify({ mode: MODE, tileSize, calls: call, frames }, null, 2));
console.log(MODE + " frames=" + frames.length + " elapsed=" + (Date.now() - t0) + "ms calls=" + call);
await browser.close();

