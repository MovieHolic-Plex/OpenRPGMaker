
/**
 * 진단 전용(커밋 안 함): 성공 기준 4(DB 키스트로크 클론)와 5(자원 관리자 인터벌 누수)의 근거를 잰다.
 * 실행: node scripts/qa/_db-and-leak-probe.mjs <project.json> <label>
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const fixturePath = process.argv[2];
const label = process.argv[3] ?? "db-leak";
if (!fixturePath) throw new Error("usage: <project.json> <label>");
const port = process.env.DEV_SERVER_PORT ?? "9820";
const base = `http://127.0.0.1:${port}`;
const outDir = "verify-shots/editor-perf-fix";
mkdirSync(outDir, { recursive: true });

const project = JSON.parse(readFileSync(fixturePath, "utf8"));
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

// setInterval/clearInterval 을 계수한다 — 누수 관측의 근거.
await page.addInitScript((seed) => {
  window.__OPRN_E2E_PROJECT__ = seed;
  window.localStorage.clear();
  const live = new Set();
  const realSet = window.setInterval.bind(window);
  const realClear = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...rest) => { const id = realSet(fn, ms, ...rest); live.add(id); return id; };
  window.clearInterval = (id) => { live.delete(id); return realClear(id); };
  window.__intervalCount = () => live.size;
}, project);

await page.goto(base, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 180000 });
await page.waitForTimeout(4000);

const intervalsAfterBoot = await page.evaluate(() => window.__intervalCount());

// 성공 기준 4: DB 텍스트 필드 키스트로크 1회의 동기 비용
const dbCost = await page.evaluate(async () => {
  const [actionsMod, storeMod] = await Promise.all([
    import(/* @vite-ignore */ "/src/editor/databaseActions.ts"),
    import(/* @vite-ignore */ "/src/project/store.ts"),
  ]);
  const store = storeMod.store;
  const actors = store.getCurrent().database.actors;
  if (!Array.isArray(actors) || actors.length === 0) return { error: "no actors" };
  const id = actors[0].id;
  const samples = [];
  for (let i = 0; i < 8; i += 1) {
    const t = performance.now();
    actionsMod.updateDatabaseRecord("actors", id, { name: `이름${i}` });
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  return {
    actorId: id,
    medianMs: Math.round(samples[Math.floor(samples.length / 2)] * 100) / 100,
    maxMs: Math.round(samples[samples.length - 1] * 100) / 100,
    firstMs: Math.round(samples[0] * 100) / 100,
  };
});

// 성공 기준 5: 자원 관리자 모달을 열고 닫은 뒤 인터벌 수 (실제 모달 API 경로)
const leak = await page.evaluate(async () => {
  const before = window.__intervalCount();
  let opened = false, closed = false, error = null, cardCount = 0;
  try {
    const modalMod = await import(/* @vite-ignore */ "/src/editor/panels/resourceModal.ts");
    const openFn = modalMod.openResourceModal ?? modalMod.showResourceModal ?? modalMod.renderResourceModal;
    if (typeof openFn !== "function") return { before, error: "no open fn: " + Object.keys(modalMod).join(","), exports: Object.keys(modalMod) };
    openFn("charset");
    opened = true;
    await new Promise((r) => setTimeout(r, 2500));
    cardCount = document.querySelectorAll(".rm-asset-card").length;
  } catch (e) { error = String(e).slice(0, 300); }
  const afterOpen = window.__intervalCount();
  try {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "닫기" && b.closest(".resource-modal-window"));
    if (btn) { btn.click(); closed = true; }
    await new Promise((r) => setTimeout(r, 2000));
  } catch (e) { error = error ?? String(e).slice(0, 300); }
  const afterClose = window.__intervalCount();
  // 남은 인터벌의 정체: 아직 DOM 에 붙어 있는 카드인가, 떨어졌는데도 도는 시계인가
  const cardsStillInDom = document.querySelectorAll(".rm-charset-row-card").length;
  const modalStillInDom = document.querySelectorAll(".resource-modal-window").length;
  // 카드가 떨어졌다면 다음 틱에서 스스로 멈춘다 — 한 주기(260ms) 더 기다려 본다
  await new Promise((r) => setTimeout(r, 1200));
  const afterSettle = window.__intervalCount();
  return { before, afterOpen, afterClose, afterSettle, opened, closed, cardCount, cardsStillInDom, modalStillInDom, error, leaked: afterSettle - before };
});

const payload = { label, intervalsAfterBoot, dbCost, leak, pageErrors: pageErrors.slice(0, 5) };
writeFileSync(`${outDir}/${label}.json`, JSON.stringify(payload, null, 2));
await page.screenshot({ path: `${outDir}/${label}.png` });
console.log(JSON.stringify(payload, null, 2));
await browser.close();
