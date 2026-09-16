/**
 * 조화 검수 재시도 라이브 증거 — 프로바이더가 «최종 출력 없는 응답» 을 돌려줄 때 화면이 어떻게 달라지는지 찍는다.
 *
 *   BASE=http://127.0.0.1:9843 CASES=a,b node scripts/capture-pi-harmony-retry.mjs
 *
 * 동반 서비스(17832)와 실모델이 필요하다. canonical 프로젝트를 주입해 /pi 수용 게이트를 지나간다.
 * 검수 호출(model=gemini-3.8-flash)만 가로채 빈응답을 돌려준다 — 실제 프로바이더가 내는 모양 그대로
 * (200 + finish=stop + 빈 content). 나머지 호출은 그대로 실서버로 보낸다.
 *
 * a: 첫 검수 응답만 빈응답 → 재시도가 구제 → 정상 판정 → 적용
 * b: 모든 검수 응답을 빈응답 → 「검수 불가」로 보고(가짜 지적 아님) + 적용은 사용자가 결정
 */
import { chromium } from "playwright";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9843";
const OUT = process.env.OUT ?? "verify-shots/pi-harmony-retry";
const PROGRESS = "/tmp/pi-harmony-retry.log";
mkdirSync(OUT, { recursive: true });
const say = (line) => { appendFileSync(PROGRESS, `${new Date().toISOString()} ${line}\n`); console.log(line); };
writeFileSync(PROGRESS, "");

const liveJson = readFileSync("/tmp/pi-spatial-live.json", "utf8");

const emptyCompletion = (model) => JSON.stringify({
  id: "empty-final-output", object: "chat.completion", model,
  choices: [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "stop" }],
  image_delivery: [{ messageIndex: 1, partIndex: 1 }],
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (error) => say(`pageerror: ${String(error).slice(0, 200)}`));
page.on("console", (message) => { if (/ultrabrain|검수/i.test(message.text())) say(`console: ${message.text().slice(0, 300)}`); });

let sabotage = "first";
let reviewCalls = 0;
await page.route("**/v1/chat/completions**", async (route) => {
  if (route.request().method() !== "POST") return route.continue();
  const body = JSON.parse(route.request().postData() ?? "{}");
  if (body.model !== "gemini-3.8-flash") return route.continue();
  reviewCalls += 1;
  const sabotageNow = sabotage === "all" || (sabotage === "first" && reviewCalls === 1);
  if (sabotageNow) {
    say(`sabotage: 검수 응답 ${reviewCalls}회차를 빈응답으로 대체`);
    return route.fulfill({ status: 200, contentType: "application/json", body: emptyCompletion(body.model) });
  }
  say(`passthrough: 검수 응답 ${reviewCalls}회차는 실서버로`);
  return route.continue();
});

await page.addInitScript(({ projectJson }) => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:ai-config", JSON.stringify({ executionRoute: "pi-agent", piTeam: false, piApply: "review" }));
  window.__OPRN_E2E_PROJECT__ = JSON.parse(projectJson);
}, { projectJson: liveJson });

await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.route("**/auth/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

await page.goto(`${BASE}/?aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.waitForTimeout(1500);
say("boot:ok");

const paneOpen = async () => page.getByTestId("ai-studio-deck-pane").first().isVisible().catch(() => false);
if (!(await paneOpen())) await page.getByTestId("topbar-ai-studio").click().catch(() => {});

async function waitText(pattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const applyVisible = await page.getByTestId("ai-team-apply").first().isVisible().catch(() => false);
    const text = await page.evaluate(() => document.body.innerText);
    const match = text.match(pattern);
    if (applyVisible || match) return { match: match?.[0] ?? (applyVisible ? "적용 버튼 표시" : null), text, applyVisible };
    await page.waitForTimeout(1200);
  }
  return { match: null, text: await page.evaluate(() => document.body.innerText), applyVisible: false };
}

const cases = {
  a: { name: "retry-saves", task: "/pi 현재 맵 북쪽에 집 한 채와 우물을 놓아줘" },
  b: { name: "unavailable-honest", task: "/pi 현재 맵 남쪽에 길을 내고 나무를 심어줘" },
};

for (const [key, spec] of Object.entries(cases)) {
  const wanted = (process.env.CASES ?? "a,b").split(",").map((s) => s.trim());
  if (!wanted.includes(key)) continue;
  sabotage = key === "b" ? "all" : "first";
  reviewCalls = 0;
  await page.getByTestId("ai-input").fill(spec.task);
  await page.getByTestId("ai-send").click();
  say(`${spec.name}: sent`);
  const review = await waitText(/검수 불가[^\n]*|적용했습니다[^\n]*|적용 실패[^\n]*/, 900_000);
  say(`${spec.name}: review-state=${(review.match ?? "none").slice(0, 80)} | reviewCalls=${reviewCalls}`);
  await page.screenshot({ path: path.join(OUT, `${key}-${spec.name}-1-review.png`) });
  writeFileSync(path.join(OUT, `${key}-${spec.name}-1-review.txt`), review.text.slice(0, 8000));
  const apply = page.getByTestId("ai-team-apply").first();
  if (review.applyVisible || await apply.isVisible().catch(() => false)) {
    await apply.click().catch(() => {});
    const applied = await waitText(/적용했습니다[^\n]*|적용 실패[^\n]*/, 300_000);
    say(`${spec.name}: applied=${(applied.match ?? "none").slice(0, 120)}`);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${key}-${spec.name}-2-applied.png`) });
    writeFileSync(path.join(OUT, `${key}-${spec.name}-2-applied.txt`), applied.text.slice(0, 8000));
  } else {
    say(`${spec.name}: 적용 버튼 없음`);
  }
  await page.waitForTimeout(1500);
}
say("DONE");
await browser.close();
