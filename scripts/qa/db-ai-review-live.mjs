/**
 * DB AI 검토 오버레이 — **실제 모델** 라이브 QA.
 *
 * `db-ai-review.mjs` 가 send 만 모킹해 화면을 검증하는 것과 달리, 여기서는 아무것도 모킹하지 않는다.
 * 실제 편집기 → 실제 「AI 어시스턴트」 단추 → 채팅 세션(aiAssistantBridge, deferApply) → 모델 → 초안 →
 * 카드 → 「적용」 → applyProposedProject 커밋 게이트 → 되돌리기 라벨까지 한 줄로 검증한다.
 *
 * 전제: `~/.rpg-zzu/oh-my-pi-auth.json` 에 동반 서비스 OAuth 자격이 있어야 한다(머신 공용).
 * `?devProject=1` 은 원격 저장이 꺼진 쇼케이스라 Supabase 에 아무것도 쓰지 않는다.
 *
 * 사용: QA_BASE_URL=http://127.0.0.1:<port> node scripts/qa/db-ai-review-live.mjs
 * 출력: .omo/evidence/db-ai-review/live-*.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:9835";
const OUT = process.env.OUT_DIR ?? join(process.cwd(), ".omo", "evidence", "db-ai-review");
const PROMPT = process.env.QA_PROMPT ?? "슬라임의 최대 HP를 300으로 올리고 경험치를 40으로 바꿔줘";
const TURN_TIMEOUT_MS = Number(process.env.QA_TURN_TIMEOUT_MS ?? 300_000);
mkdirSync(OUT, { recursive: true });

async function snap(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  console.log("shot", name);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (error) => console.log("[pageerror]", String(error).slice(0, 300)));

// 기본 제공자(Antigravity)가 400 을 반복하면 QA_PROVIDER=openai-codex 로 우회한다 — 둘 다 머신 공용
// OAuth(oh-my-pi-auth.json) 자격을 쓴다. 키·토큰은 어디에도 찍히지 않는다.
const provider = process.env.QA_PROVIDER ?? null;
const model = process.env.QA_MODEL ?? null;
await page.addInitScript(({ provider: p, model: m }) => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  if (p) {
    const raw = localStorage.getItem("oprn:ai-config");
    const config = raw ? JSON.parse(raw) : {};
    config.providerId = p;
    if (m) { config.model = m; config.liteModel = m; }
    localStorage.setItem("oprn:ai-config", JSON.stringify(config));
  }
}, { provider, model });
await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 60_000 });
for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
  const button = page.getByTestId(testid);
  if (await button.isVisible().catch(() => false)) await button.click().catch(() => {});
}

// 브리지가 붙어 있고 설정이 준비됐는지 — 아니면 이 스크립트는 의미가 없다.
// 반드시 window 핸들로 읽는다: 페이지에서 `/src/editor/aiAssistantBridge.ts` 를 동적 import 하면 HMR 로
// 버전이 붙은 앱 인스턴스와 **다른 모듈**을 받아 handlers 가 null 로 보인다(실측).
await page.waitForFunction(() => Boolean(window.__oprnAiBridge), null, { timeout: 20_000 }).catch(() => {});
const readiness = await page.evaluate(() => window.__oprnAiBridge?.status() ?? { panelMounted: false, configReady: false });
console.log("BRIDGE", JSON.stringify(readiness));
if (!readiness.panelMounted || !readiness.configReady) {
  console.log("ABORT: AI 패널 미마운트 또는 설정 미준비");
  await browser.close();
  process.exit(2);
}

await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 20_000 });
await page.evaluate(async () => {
  const { switchDatabaseActiveTab } = await import(/* @vite-ignore */ "/src/editor/panels/database.ts");
  switchDatabaseActiveTab("enemies", document.querySelector(".database-modal-body"));
});
// 탭이 실제로 그려질 때까지 기다린다 — 고정 대기는 느린 기계에서 거짓 결과를 만든다.
await page.waitForFunction(() => document.querySelector('[data-testid^="db-record-row-"]') !== null, null, { timeout: 20_000 });

const before = await page.evaluate(async () => {
  const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
  const slime = store.getCurrent().database.enemies.find((e) => e.name === "슬라임") ?? store.getCurrent().database.enemies[0];
  return { id: slime.id, name: slime.name, maxHp: slime.stats.maxHp, exp: slime.rewards.exp };
});
console.log("BEFORE", JSON.stringify(before));

// 실제 단추 → 실제 오버레이
await page.getByTestId("database-ai-toggle").click();
await page.getByTestId("database-ai-bar").waitFor({ state: "visible" });
await page.getByTestId("database-ai-input").fill(PROMPT);
await snap(page, "live-01-prompt");
const started = Date.now();
await page.getByTestId("database-ai-run").click();

// 상태줄이 review/done/error 중 하나에 닿을 때까지 **상태 변화를 구독한다**(고정 대기 금지).
// 진행 중 스냅샷은 working/thinking 을 한 번 기다려 찍는다 — 시간으로 짐작하지 않는다.
await page.waitForFunction(
  () => ["working", "thinking"].includes(document.querySelector("[data-testid='database-ai-turn-status']")?.dataset.phase ?? ""),
  null, { timeout: 30_000 },
).catch(() => { /* 첫 상태가 곷바로 종결일 수 있다 */ });
await snap(page, "live-02-running");
let phase = null;
try {
  await page.waitForFunction(
    () => ["review", "done", "error"].includes(document.querySelector("[data-testid='database-ai-turn-status']")?.dataset.phase ?? ""),
    null, { timeout: TURN_TIMEOUT_MS },
  );
} catch { /* 시간 초과 → 아래에서 phase=null 로 보고된다 */ }
phase = await page.getByTestId("database-ai-turn-status").getAttribute("data-phase");
const elapsed = Math.round((Date.now() - started) / 1000);
const statusText = await page.getByTestId("database-ai-turn-status").innerText();
console.log("TURN", JSON.stringify({ phase, elapsed, statusText }));
await snap(page, `live-03-${phase ?? "timeout"}`);

const cards = await page.evaluate(() => [...document.querySelectorAll("[data-testid='database-ai-card']")].map((card) => ({
  id: card.dataset.recordId, change: card.dataset.change,
  fields: [...card.querySelectorAll(".database-ai-card-field")].map((row) => row.textContent.replace(/\s+/gu, " ").trim()),
})));
console.log("CARDS", JSON.stringify(cards, null, 1));

// 진단: 상태 문구가 아니라 **저장소와 초안**을 직접 본다. 문구는 감사 항목에서 파생되므로
// "적용됐다" 고 말하면서 실제로는 아무것도 안 바뀌었을 수 있다(그 반대도).
const truth = await page.evaluate(async (id) => {
  const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
  const slime = store.getCurrent().database.enemies.find((e) => e.id === id);
  const audit = window.__oprnAiBridge?.audit?.() ?? [];
  return {
    storeMaxHp: slime?.stats.maxHp, storeExp: slime?.rewards.exp,
    writeTools: audit.filter((e) => e.kind === "tool" && e.mode === "write").map((e) => `${e.name}${e.ok === false ? "(실패)" : ""}`),
    statusLines: audit.filter((e) => e.kind === "status").slice(-6).map((e) => (e.text ?? "").slice(0, 140)),
  };
}, before.id);
console.log("TRUTH", JSON.stringify(truth, null, 1));
console.log("STORE_CHANGED", JSON.stringify({ maxHp: before.maxHp !== truth.storeMaxHp, exp: before.exp !== truth.storeExp }));

if (phase === "review") {
  const hpDuringReview = await page.evaluate(async (id) => {
    const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
    return store.getCurrent().database.enemies.find((e) => e.id === id)?.stats.maxHp;
  }, before.id);
  console.log("STORE_DURING_REVIEW", JSON.stringify({ maxHp: hpDuringReview, unchanged: hpDuringReview === before.maxHp }));

  await page.getByTestId("database-ai-turn-apply").click();
  // 적용도 상태 변화를 구독한다 — "적용됐어요" 문구나 error 단계가 종결 신호다.
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-testid='database-ai-turn-status']");
    return el?.dataset.phase === "error" || (el?.textContent ?? "").includes("적용됐어요");
  }, null, { timeout: 60_000 }).catch(() => {});
  await snap(page, "live-04-applied");
  const after = await page.evaluate(async (id) => {
    const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
    const slime = store.getCurrent().database.enemies.find((e) => e.id === id);
    const status = document.querySelector("[data-testid='database-ai-turn-status']");
    const undo = document.querySelector("[data-testid='database-ai-turn-undo']");
    return {
      maxHp: slime?.stats.maxHp, exp: slime?.rewards.exp,
      phase: status?.dataset.phase, statusText: status?.textContent,
      undoHidden: undo?.hidden, undoLabel: undo?.textContent?.trim(),
    };
  }, before.id);
  console.log("AFTER", JSON.stringify(after));
}

await browser.close();

// 결과를 종료 코드로 말한다 — 이 스크립트를 게이트에서 쓰는데 "실패해도 exit 0" 이면 게이트가 무의미하다.
// review = 초안이 사람에게 넘어감(정상), error = 턴 실패, null = 시간 초과.
console.log("RESULT", JSON.stringify({ phase, elapsed }));
if (phase !== "review") process.exitCode = 1;
