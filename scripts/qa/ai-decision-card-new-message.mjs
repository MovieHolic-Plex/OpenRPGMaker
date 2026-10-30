// 확인 카드가 열린 채 입력창에 새 메시지가 오면 — 실제 편집기 패널의 send() 경로로 잰다(모델 호출 없음).
//
// 2026-10-29 vm1 argon: 맵 소실 확인 카드(ai-decision-prompt)에 단추 대신 글로 답하자, 글은 맵별 대기열에서 카드 주인 뒤에
// 줄을 서고 카드 주인은 단추를 기다려 워커 30분 적용 대기(piCheckpointBroker)·다음 턴 45분 상한으로 멈췄다.
// 이 탐침은 실제 실행 발행기(createPiPublication)로 카드를 열고, 그 맵을 잡은 앞 실행을 대기열에 둔 채 입력창에 친다.
//   A. 다른 요청 → 카드가 「그만두기」로 닫히고(발행이 [맵 소실 거절] + 「새 메시지」로 거절 = 워커가 그 변경만 되돌리고 계속),
//      시스템 말풍선이 남고, 요청은 대기열에 들어간다.
//   B. 「예」 → 카드 답(적용), 새 요청 없음.   C. 「그만」 → 카드 답(일반 거절), 새 요청 없음.
//   D. 다른 맵의 카드는 이 맵으로 온 요청에 닫히지 않는다.
// 사용: (워크트리에서 npm run dev:worktree 로 띄운 뒤) QA_BASE_URL=http://127.0.0.1:<포트> node scripts/qa/ai-decision-card-new-message.mjs
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9900";
const browser = await chromium.launch({ args: ["--disable-features=NetworkChangeNotifier", "--disable-network-change-notifier"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", e => console.log("pageerror", e.message));
const MOD = `window.__mod = async (path) => { const hit = performance.getEntriesByType("resource").map(e => e.name).find(n => n.includes(path) && !n.includes("?import")); return import(hit ?? "/" + path); };`;
await page.addInitScript(MOD);
await page.goto(`${base}/?freshProject=1&lang=ko`, { waitUntil: "commit", timeout: 300000 });
let booted = false;
for (let i = 0; i < 100 && !booted; i++) {
  await page.waitForTimeout(3000);
  booted = await page.evaluate(() => !!document.querySelector('[data-testid="ai-panel"]') && !!document.querySelector('[data-testid="ai-input"]')).catch(() => false);
}
if (!booted) throw new Error("편집기가 부팅하지 않았습니다");
await page.waitForTimeout(2000);

await page.evaluate(async () => {
  const { store } = await window.__mod("src/project/store.ts");
  const ms = await window.__mod("src/editor/mapSelection.ts");
  const p = store.getCurrent();
  const src = Object.values(p.maps)[0];
  const maps = { demo_0: { ...src, id: "demo_0", name: "시장 마을" }, demo_1: { ...src, id: "demo_1", name: "달빛 숲" } };
  store.replaceProject({ ...p, maps, startMapId: "demo_0" });
  ms.selectEditorMap("demo_0", { checkoutForEditing: false });
  // 보내기 관문만 통과시킨다 — 대기열에 들어간 요청은 모델을 부르기 전에 이 탐침이 뺀다.
  const helpers = await window.__mod("src/editor/panels/aiChatPanelHelpers.ts");
  const llm = await window.__mod("src/ai/llmClient.ts");
  window.__ready = helpers.isAiConfigReady(llm.loadAiConfig());
});
const ready = await page.evaluate(() => window.__ready);
console.log("ai config ready:", ready);

// 앞 실행이 demo_0 을 잡고 있다(패널의 claimForegroundMapRun 과 같은 표).
await page.evaluate(async () => {
  const q = (await window.__mod("src/editor/aiMapRunQueue.ts")).mapRunQueue();
  let release; const hold = new Promise(r => { release = r; });
  window.__releaseHold = release;
  q.enqueue({ mapKey: "demo_0", label: "앞 실행(카드 주인)", exclusive: false, force: true, start: () => hold });
});

/** 실제 발행기로 「맵 전체 청소」 확인 카드를 연다. 결과는 window.__outcome[tag]. */
const openCard = (tag, runKey) => page.evaluate(async ({ tag, runKey }) => {
  const { createPiPublication } = await window.__mod("src/editor/panels/aiPiPublication.ts");
  const { store } = await window.__mod("src/project/store.ts");
  const log = document.querySelector('[data-testid="ai-panel"]') ?? document.body;
  const surface = {
    appendBubble: () => undefined, appendCard: (e) => log.append(e), appendReviewPrompt: (e) => log.append(e),
    appendProcess: (t) => { (window.__process ??= []).push(t); }, setStatus: () => undefined,
    getCurrentMapId: () => runKey, runKey,
  };
  const before = store.getCurrent();
  const pub = createPiPublication(before, "live", surface);
  const next = structuredClone(before);
  next.maps[runKey] = { ...next.maps[runKey], name: next.maps[runKey].name + " (청소)" };
  window.__outcome ??= {};
  window.__outcome[tag] = "pending";
  pub.publish({ project: next, label: "맵 청소", toolName: "clear_map" })
    .then(() => { window.__outcome[tag] = "applied"; }, (e) => { window.__outcome[tag] = "rejected: " + (e?.message ?? e); });
  await new Promise(r => setTimeout(r, 300));
  return document.querySelectorAll('[data-testid="ai-decision-prompt"]').length;
}, { tag, runKey });

const type = async (text) => {
  // 패널이 접혀 있어도 같은 keydown 처리(send)를 탄다.
  await page.evaluate((text) => {
    const input = document.querySelector('[data-testid="ai-input"]');
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  }, text);
  await page.waitForTimeout(600);
};
const state = (tag) => page.evaluate(async (tag) => {
  const q = (await window.__mod("src/editor/aiMapRunQueue.ts")).mapRunQueue();
  const bubbles = [...document.querySelectorAll('[data-testid="ai-panel"] *')].map(n => n.childElementCount === 0 ? n.textContent ?? "" : "").filter(t => /확인 카드|카드에/.test(t));
  return { outcome: window.__outcome?.[tag], cards: document.querySelectorAll('[data-testid="ai-decision-prompt"]').length,
    queued: q.forMap("demo_0").map(t => `${t.label}:${t.status}`), bubbles: [...new Set(bubbles)].slice(-3), process: (window.__process ?? []).slice(-1) };
}, tag);
/** 탐침이 넣은 대기 요청을 모델 호출 전에 뺀다. */
const dropQueued = () => page.evaluate(async () => {
  const q = (await window.__mod("src/editor/aiMapRunQueue.ts")).mapRunQueue();
  for (const t of q.forMap("demo_0")) if (t.status === "waiting") q.cancel(t.id);
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`); };

// A. 다른 요청
console.log("A cards opened:", await openCard("A", "demo_0"));
await type("숲 맵도 하나 더 만들어 줘");
let s = await state("A");
check("A 새 요청이 카드를 그만두기로 닫음", s.cards === 0 && /^rejected: \[맵 소실 거절\].*새 메시지/u.test(s.outcome ?? ""), s);
check("A 새 요청은 대기열에", s.queued.some(l => l.startsWith("숲 맵도 하나 더 만들어 줘:waiting")), s.queued);
check("A 말풍선·과정 기록", s.bubbles.some(b => b.includes("그만두기로 닫았어요(")) && s.process.some(p => p.includes("새 메시지")), { b: s.bubbles, p: s.process });
await dropQueued();

// B. 「예」
console.log("B cards opened:", await openCard("B", "demo_0"));
await type("예");
await page.waitForTimeout(1500);
s = await state("B");
check("B 「예」 = 카드 승인, 새 요청 없음", s.outcome === "applied" && s.cards === 0 && !s.queued.some(l => l.startsWith("예:")), s);

// C. 「그만」
console.log("C cards opened:", await openCard("C", "demo_0"));
await type("그만");
s = await state("C");
check("C 「그만」 = 카드 거절(일반), 새 요청 없음", /^rejected: \[맵 소실 거절\]/u.test(s.outcome ?? "") && !/새 메시지/u.test(s.outcome ?? "") && s.cards === 0 && !s.queued.some(l => l.startsWith("그만:")), s);

// D. 다른 맵 카드는 그대로
console.log("D cards opened:", await openCard("D", "demo_1"));
await type("시장에 분수 하나 놔 줘");
s = await state("D");
check("D 다른 맵(demo_1) 카드는 열린 채", s.cards === 1 && s.outcome === "pending", s);
await dropQueued();
await page.evaluate(() => { document.querySelector('[data-testid="ai-decision-cancel"]')?.click(); window.__releaseHold?.(); });

await page.screenshot({ path: "/tmp/ai-decision-card-new-message.png" });
await browser.close();
const failed = results.filter(r => !r.ok);
console.log(failed.length ? `PROBE FAIL ${failed.length}/${results.length}` : `PROBE OK ${results.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
