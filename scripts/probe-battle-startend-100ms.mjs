/**
 * 전투 시작/끝 100ms 연사 프로브 — 적대적 리뷰용.
 * 전투 돌입 클릭부터 필드 복귀까지 전 구간을 ~100ms 간격 스크린샷 + 상태 스냅샷으로
 * 기록한다. 판정자는 프레임을 눈으로 본다. 콘솔 에러/페이지 에러도 타임스탬프와 함께 남긴다.
 *
 *   node scripts/probe-battle-startend-100ms.mjs
 * 산출: .omo/battle-runs/startend-0803/fNNN.jpg + timeline.json + errors.json
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const OUT = process.env.ADV_OUT || ".omo/battle-runs/startend-0803";
const sleep = (n) => new Promise((r) => setTimeout(r, n));

const READ_STATE = () => {
  const scene = document.querySelector(".battle-scene");
  const q = (sel) => document.querySelector(sel);
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    hasScene: !!scene,
    sceneRect: rect(scene),
    phase: scene?.dataset.battlePhase ?? null,
    step: scene?.dataset.battleDirectorStep ?? null,
    busy: scene?.dataset.battleSequenceBusy ?? null,
    message: (q(".battle-message-window")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    popups: document.querySelectorAll(".battle-damage-popup").length,
    resultRect: rect(q(".battle-result-panel")),
    enemyPanelVisible: (() => {
      const p = q(".battle-enemy-list-panel");
      return p ? getComputedStyle(p).visibility : null;
    })(),
    enemies: Array.from(document.querySelectorAll(".battle-enemy")).map((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), defeated: e.classList.contains("defeated") };
    }),
    transitionLayer: !!q(".battle-transition-layer, [data-testid='battle-transition']"),
    backdropOpen: !!q(".test-play-modal-backdrop"),
  };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push({ t: Date.now(), kind: "console", text: m.text().slice(0, 400) }); });
page.on("pageerror", (e) => errors.push({ t: Date.now(), kind: "pageerror", text: String(e).slice(0, 400) }));

await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(9000);

const frames = [];
let fi = 0;
let capturing = true;
const t0 = Date.now();
const captureLoop = (async () => {
  while (capturing) {
    const ms = Date.now() - t0;
    const file = `f${String(fi).padStart(3, "0")}.jpg`;
    try {
      const [state] = await Promise.all([
        page.evaluate(READ_STATE),
        page.screenshot({ path: `${OUT}/${file}`, type: "jpeg", quality: 70 }),
      ]);
      frames.push({ f: fi, ms, file, state });
    } catch { /* teardown race */ }
    fi += 1;
    const drift = (Date.now() - t0) % 100;
    await sleep(Math.max(10, 100 - drift));
  }
})();

// ── 전투 돌입(시작 구간 캡처는 이미 돌고 있음) ──
await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });

// ── 라운드 진행: 커맨드 입력 가능해질 때마다 공격 확정(Enter×2). 결과 패널까지. ──
const deadline = Date.now() + 120000;
let resultSeen = false;
while (Date.now() < deadline) {
  const st = await page.evaluate(READ_STATE).catch(() => null);
  if (!st) break;
  if (st.resultRect) { resultSeen = true; break; }
  if (st.hasScene && st.phase === "actorCommand" && st.busy !== "true" && st.step !== "intro") {
    await page.keyboard.press("Enter");
    await sleep(250);
    await page.keyboard.press("Enter");
    await sleep(600);
  } else {
    await sleep(200);
  }
}

// ── 결과 패널: 공개 연출을 그대로 두고 2.5s 관찰 후 확인(Z) → 퇴장 → 필드 복귀 ──
if (resultSeen) {
  await sleep(2500);
  await page.keyboard.press("z");
}
// 씬 언마운트 + 필드 페이드인까지 관찰
const tearDeadline = Date.now() + 15000;
while (Date.now() < tearDeadline) {
  const st = await page.evaluate(READ_STATE).catch(() => null);
  if (st && !st.hasScene) { await sleep(2500); break; }
  await sleep(200);
}
await sleep(500);
capturing = false;
await captureLoop;

await writeFile(`${OUT}/timeline.json`, JSON.stringify({ frames }, null, 1));
await writeFile(`${OUT}/errors.json`, JSON.stringify(errors, null, 1));
console.log(JSON.stringify({
  frames: frames.length,
  durationMs: frames.at(-1)?.ms,
  resultSeen,
  errors: errors.length,
  avgIntervalMs: frames.length > 1 ? Math.round(frames.at(-1).ms / (frames.length - 1)) : null,
}));
await browser.close();
