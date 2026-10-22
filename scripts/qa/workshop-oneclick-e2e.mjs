// 공방 「한 번에 만들기」 실화면 시험 — 생성기 하나당 1배 영상 하나. 실제 모델(사용자 계정 경로 = 조수 엔진 local-cli)로 돈다.
// 정본 저장 확인: oprn-serve(프로젝트 폴더 SQLite)에 띄우고 Ctrl+S → 새로고침 → 맵에 놓인 것을 화면으로 다시 본다.
//   node scripts/oprn-serve.mjs --project-dir /tmp/proj --port 9860 &
//   BASE=http://127.0.0.1:9860 KIND=object OUT=/tmp/wsoc/e2e ENGINE_CLI=claude ENGINE_MODEL=sonnet node scripts/qa/workshop-oneclick-e2e.mjs
// 결과: OUT/<KIND>.webm, OUT/<KIND>-*.png, OUT/<KIND>.json(클릭 수·첫 결과까지 걸린 시간·저장 뒤 재로드 확인)
import { chromium } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9860";
const kind = process.env.KIND ?? "object";
const out = resolve(process.env.OUT ?? "verify-shots/workshop-oneclick");
const text = process.env.TEXT ?? "";
const width = 1440, height = 900;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out, size: { width, height } } });
const page = await context.newPage();
page.setDefaultTimeout(120_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") console.log(`[console.${message.type()}] ${message.text().slice(0, 400)}`); });
page.on("response", (response) => { if (/\/v1\/workshop\//.test(response.url()) && response.request().method() === "GET") response.text().then((body) => { if (!/"state":"running"/.test(body)) console.log(`[host] ${new URL(response.url()).pathname} ${body.slice(0, 300)}`); }).catch(() => {}); });
// 모델 호출 시간표(물건 경로 속도 재기) — 편집기 → 동반 서비스 /v1/chat/completions·/v1/workshop/* 요청마다 시작·끝·종류 꼬리표.
const calls = [];
const callLabel = (body) => {
  try {
    const json = JSON.parse(body ?? "{}");
    if (json.png || json.kind) return `gate:${json.kind ?? ""}`;
    const first = (json.messages ?? []).map((m) => (typeof m.content === "string" ? m.content : (m.content ?? []).map((part) => part.text ?? "").join(" "))).join(" | ");
    return first.replace(/\s+/g, " ").slice(0, 90);
  } catch { return "?"; }
};
page.on("request", (request) => {
  const url = request.url();
  if (!/\/v1\/(chat\/completions|workshop\/gate)/.test(url) || request.method() !== "POST") return;
  const entry = { path: new URL(url).pathname, label: callLabel(request.postData()), start: Date.now(), end: null, status: null };
  calls.push(entry);
  request.response().then((response) => response?.finished().then(async () => {
    entry.end = Date.now(); entry.status = response.status();
    const body = await response.text().catch(() => "");
    entry.answer = body.length > 600 ? `${body.slice(0, 300)} … ${body.slice(-300)}` : body;
    // 전체 답은 따로(기계 검사가 왜 떨어졌는지 다시 볼 때)
    try { mkdirSync(resolve(out, `${kind}-calls`), { recursive: true }); writeFileSync(resolve(out, `${kind}-calls`, `${calls.indexOf(entry)}.json`), body); } catch { /* 기록 실패는 시험을 막지 않는다 */ }
  })).catch(() => { entry.end = Date.now(); });
});
page.on("requestfailed", (request) => { const hit = calls.find((entry) => entry.end === null && request.url().endsWith(entry.path)); if (hit) { hit.end = Date.now(); hit.status = "failed"; } });
const engine = { kind: "local-cli", cli: process.env.ENGINE_CLI ?? "claude", routineModel: process.env.ENGINE_MODEL ?? "sonnet", deepModel: process.env.ENGINE_MODEL ?? "sonnet", effort: "high" };
await page.addInitScript((engineJson) => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
  localStorage.setItem("oprn:assistant-engine", engineJson);
  // 토스트 기록(저장 토스트가 겹치는지 센다)
  window.__toastLog = [];
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof HTMLElement && node.classList.contains("toast")) window.__toastLog.push({ at: Date.now(), text: node.textContent ?? "" });
    }
  }).observe(document, { childList: true, subtree: true });
}, JSON.stringify(engine));

const hold = (ms) => page.waitForTimeout(ms);
const result = { kind, engine: `${engine.cli}:${engine.routineModel} (stand-in for the user's own account)`, clicks: 0, typed: false };
const click = async (locator) => { await locator.click(); result.clicks += 1; };
const t0 = Date.now();
const marks = {};
const mark = (name) => { marks[name] = Number(((Date.now() - t0) / 1000).toFixed(1)); console.log(`[mark] ${name} ${marks[name]}s`); };

async function boot() {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.getByTestId("sidebar-workshop").waitFor({ timeout: 240_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("도구 준비 중"), null, { timeout: 300_000 });
  await hold(1500);
}

async function canvasBox() {
  const canvas = page.locator("canvas").first();
  return canvas.boundingBox();
}

/** 판 기록(시도마다 기계 검사 오류·판정·관문) — 어디서 시간이 갔는지 본다 */
const dumpRounds = () => page.evaluate(() => new Promise((done) => {
    const req = indexedDB.open("oprn-workshop");
    req.onsuccess = () => {
      // 캐릭터·지형만 돈 새 브라우저에는 판 저장소가 없다 — 없는 저장소로 트랜잭션을 열면 던지고 약속이 영영 안 풀려 시험이 멈췄다
      if (!req.result.objectStoreNames.contains("rounds")) { req.result.close(); done(null); return; }
      const tx = req.result.transaction("rounds", "readonly").objectStore("rounds").getAll();
      tx.onsuccess = () => done(tx.result.map((round) => ({ id: round.id, item: round.itemKey, runs: round.runs.map((run) => ({ letter: run.letter, status: run.status, calls: run.calls, error: run.error, gate: run.gate ?? null, attempts: run.attempts.map((a) => ({ attempt: a.attempt, hard: a.hard, verdict: a.verdict?.verdict ?? null, codes: a.verdict?.codes ?? [] })) })) })));
      tx.onerror = () => done(null);
    };
    req.onerror = () => done(null);
  })).catch(() => null);

try {
  await boot();
  mark("booted");
  await click(page.getByTestId("sidebar-workshop"));
  await page.getByTestId("workshop-oneclick").waitFor();
  await page.getByTestId(`workshop-oneclick-tab-${kind}`).click();
  await hold(900);
  if (text) { await page.getByTestId("workshop-oneclick-input").pressSequentially(text, { delay: 60 }); result.typed = true; }
  else await click(page.getByTestId("workshop-oneclick-example-0"));
  await hold(600);
  await page.screenshot({ path: resolve(out, `${kind}-1-ready.png`) });
  const made = Date.now();
  mark("make");
  await click(page.getByTestId("workshop-oneclick-make"));
  await hold(2500);
  await page.screenshot({ path: resolve(out, `${kind}-2-running.png`) });
  const toast = page.getByTestId("workshop-oneclick-place-toast").first();
  const failed = page.getByTestId("workshop-oneclick-error");
  await Promise.race([toast.waitFor({ timeout: 45 * 60_000 }), failed.waitFor({ timeout: 45 * 60_000 }).then(() => { throw new Error(`실패 카드: ${"" }`); })]).catch(async (error) => {
    const reason = await failed.textContent().catch(() => null);
    throw new Error(`${error.message} ${reason ?? ""}`);
  });
  result.firstResultSeconds = Number(((Date.now() - made) / 1000).toFixed(1));
  result.rounds = await dumpRounds();
  mark("result");
  await hold(1200);
  await page.screenshot({ path: resolve(out, `${kind}-3-done.png`) });
  if (process.env.PROBE) {
    await page.evaluate(() => { document.querySelector("canvas").style.visibility = "hidden"; });
    await page.screenshot({ path: resolve(out, `${kind}-3-done-nocanvas.png`) });
    await page.evaluate(() => { document.querySelector("canvas").style.visibility = ""; });
    console.log("[probe-canvas]", JSON.stringify(await page.evaluate(() => { const c = document.querySelector("canvas"); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, style: c.getAttribute("style") }; })));
  }
  if (process.env.PROBE) console.log("[probe]", JSON.stringify(await page.evaluate(() => [[1100, 52], [1390, 893]].map(([x, y]) => document.elementsFromPoint(x, y).slice(0, 4).map((el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return `${el.tagName}.${String(el.className).slice(0, 50)} bg=${cs.backgroundColor} bs=${cs.boxShadow.slice(0, 60)} rect=${[r.x, r.y, r.width, r.height].map(Math.round)}`; })))));
  // 부하가 높으면 Playwright 의 「안정」 검사(두 프레임 같은 자리)가 2분 내내 못 맞춘 적이 있다(화면에서는 가만히 있었다) — 그때는 같은 자리를 그대로 누른다
  await toast.click({ timeout: 20_000 }).catch(() => toast.click({ force: true }));
  result.clicks += 1;
  await hold(900);
  const box = await canvasBox();
  const cx = box.x + box.width * 0.5, cy = box.y + box.height * 0.5;
  await page.mouse.move(cx - 40, cy - 20, { steps: 8 });
  await hold(700);
  if (kind === "terrain") {
    await page.mouse.move(cx - 80, cy - 40); await page.mouse.down();
    for (let row = 0; row < 4; row++) for (let i = 0; i <= 8; i++) await page.mouse.move(cx - 80 + (row % 2 ? 8 - i : i) * 20, cy - 40 + row * 24, { steps: 3 });
    await page.mouse.up();
  } else {
    // 풀밭에 놓는다(앞 영상의 용암 위가 아닌 칸)
    const dx = kind === "character" ? -160 : 160;
    await page.mouse.move(cx + dx, cy - 20, { steps: 6 });
    await hold(400);
    if (kind === "character") {
      result.cursorGhost = await page.getByTestId("map-pick-ghost").isVisible().catch(() => false);
      await page.screenshot({ path: resolve(out, `${kind}-3b-cursor.png`) });
    }
    await page.mouse.click(cx + dx, cy - 20);
  }
  result.clicks += 1;
  mark("placed");
  await hold(2000);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: resolve(out, `${kind}-4-placed.png`) });
  // 정본 저장 → 새로고침 → 다시 본다
  await page.keyboard.press("Control+s");
  await hold(4000);
  const status = await page.getByTestId("topbar-save-status").textContent().catch(() => "");
  result.saveToasts = await page.evaluate(() => (window.__toastLog ?? []).filter((entry) => /저장/.test(entry.text)).map((entry) => entry.text));
  result.saveStatus = status?.trim() ?? "";
  mark("saved");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("sidebar-workshop").waitFor({ timeout: 240_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("도구 준비 중"), null, { timeout: 300_000 });
  await hold(4000);
  // 타일 층에서는 이벤트가 「E」 배지로만 보인다 — NPC 그림을 다시 보려면 이벤트 층(F7)
  // 입력칸에 초점이 있으면 F7 이 무시된다 — 층 단추가 보이면 그것을, 아니면 초점을 풀고 F7
  if (kind === "character") {
    const pill = page.getByTestId("layer-event");
    if (await pill.isVisible().catch(() => false)) await pill.click();
    else { await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined)); await page.keyboard.press("F7"); }
    await hold(1500);
    result.reloadLayer = await page.evaluate(() => document.querySelector("[data-testid='layer-event']")?.getAttribute("aria-pressed") ?? document.body.dataset.layer ?? "?");
  }
  await page.mouse.move(cx - 40, cy - 20, { steps: 4 });
  await hold(800);
  await page.screenshot({ path: resolve(out, `${kind}-5-reloaded.png`) });
  // 새로고침 뒤 공방 창의 결과 카드(빠른 지형 카드가 사라졌었다)와 작업 알약
  result.cardAfterReload = await page.getByTestId("workshop-oneclick-card").first().getAttribute("data-state").catch(() => null);
  result.pillAfterReload = await page.getByTestId("workshop-queue-pill").isVisible().catch(() => false);
  mark("reloaded");
} catch (error) {
  result.error = error instanceof Error ? error.message.slice(0, 500) : String(error);
  console.log("FAIL", result.error);
  await page.screenshot({ path: resolve(out, `${kind}-fail.png`) }).catch(() => {});
} finally {
  result.rounds ??= await dumpRounds();
  result.marks = marks;
  result.calls = calls.map((entry) => ({ ...entry, startS: Number(((entry.start - t0) / 1000).toFixed(1)), seconds: entry.end ? Number(((entry.end - entry.start) / 1000).toFixed(1)) : null }));
  result.errors = errors.slice(0, 10);
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) renameSync(await video.path(), resolve(out, `${kind}.webm`));
  writeFileSync(resolve(out, `${kind}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
