// 꿈 세계 탐험 레인 브라우저 QA (지시서 §4-3) — mdc-server:9928 에서 새 프로젝트 마법사로
// dream-explore 기획을 입력하고 조수가 만드는 것을 지켜보며 스크린샷·활동 로그를 남긴다.
// 게임 화면 플레이는 이 스크립트의 몫이 아니다 — scripts/qa/runtime/dream-explore.scenario.mjs
// (npm run qa:runtime)이 출하 플레이어 경로로 찍는다.
//
// 실행: node scripts/qa/grok-dream-wizard-qa.mjs
// 크로미움 필수 플래그(지시서 §9): --disable-background-networking --disable-features=NetworkChangeNotifier
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://mdc-server:9928").replace(/\/$/, "");
const OUT = process.env.SHOT_DIR ?? ".playwright-mcp/shots/dream-r5";
const BRIEF_PATH = "scripts/qa-game/briefs/dream-explore.json";
const IDLE_MS = 120_000; // 활동 로그가 이만큼 멈추면 조수 작업이 끝으로 본다
const MAX_MS = 25 * 60_000;

const brief = JSON.parse(readFileSync(BRIEF_PATH, "utf8"));
const answers = Object.values(brief.brief.answers).map((entry) => entry.text);
const summary = brief.brief.summary;

mkdirSync(OUT, { recursive: true });
const shots = [];
const log = [];

function note(message) {
  const entry = { at: new Date().toISOString(), message };
  log.push(entry);
  console.log(`${entry.at} ${message}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  shots.push(path);
  note(`shot ${name}`);
  return path;
}

async function activityCount(page) {
  return page.evaluate(async () => {
    const response = await fetch("/__oprn/ai-activity").catch(() => null);
    if (!response || !response.ok) return -1;
    const body = await response.json().catch(() => null);
    if (!body) return -1;
    // 엔드포인트는 최신 항목 1개(객체)를 돌려준다 — 객체면 활동이 있다는 뜻으로 1을 센다.
    if (!Array.isArray(body) && typeof body === "object") return body.runId ? 1 : 0;
    const list = Array.isArray(body) ? body : (body.entries ?? body.activities ?? []);
    return Array.isArray(list) ? list.length : -1;
  });
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-background-networking",
    "--disable-features=NetworkChangeNotifier",
    "--no-sandbox",
    "--use-gl=swiftshader",
    "--disable-gpu",
  ],
});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  page.on("pageerror", (error) => note(`pageerror: ${error.message}`));

  const health = await fetch(`${BASE}/`).then((r) => r.status).catch(() => 0);
  if (health !== 200) throw new Error(`editor-unreachable:${BASE}:${health}`);
  const auth = await fetch(`${BASE}/auth/status`).then((r) => r.json()).catch(() => null);
  note(`auth/status ${JSON.stringify(auth)}`);

  await page.goto(`${BASE}/?forceWelcome=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => localStorage.removeItem("oprn:editor-welcome-dismissed"));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByTestId("editor-welcome").waitFor({ state: "visible", timeout: 45_000 });
  await shot(page, "01-welcome");

  // 회상 스토리 포스터(anchor pack story-cutscene) → 기획 인터뷰가 연다.
  const poster = page.locator('[data-pack-id="story-cutscene"]').first();
  await poster.waitFor({ state: "visible", timeout: 15_000 });
  await poster.click();
  await page.getByTestId("project-interview").waitFor({ state: "visible", timeout: 20_000 });
  await shot(page, "02-interview-open");

  // 질문 최대 5개:毎 답을 적고 다음. 요약 단계로 넘어가면 루프를 끊는다.
  let step = 0;
  for (; step < 6; step++) {
    const summaryBox = page.getByTestId("project-interview-summary");
    if (await summaryBox.count()) break;
    const answer = page.getByTestId("project-interview-answer");
    await answer.waitFor({ state: "visible", timeout: 15_000 });
    await answer.fill(answers[step % answers.length]);
    if (step === 0) await shot(page, "03-interview-question");
    await page.getByTestId("project-interview-next").click();
    await page.waitForTimeout(400);
  }
  const summaryBox = page.getByTestId("project-interview-summary");
  await summaryBox.waitFor({ state: "visible", timeout: 20_000 });
  await summaryBox.fill(summary);
  await shot(page, "04-interview-summary");
  await page.getByTestId("project-interview-confirm").click();
  note("brief confirmed — 조수 생성 시작");

  // 웰컴이 닫히고 편집기가 뜬 뒤 조수가 만든다. 활동 로그가 멈추면 끝으로 본다.
  await page.getByTestId("editor-welcome").waitFor({ state: "detached", timeout: 60_000 }).catch(() => note("welcome still open after confirm"));
  const started = Date.now();
  let lastCount = -1;
  let lastChange = Date.now();
  let buildShots = 0;
  while (Date.now() - started < MAX_MS) {
    await page.waitForTimeout(15_000);
    const count = await activityCount(page);
    if (count !== lastCount) {
      lastCount = count;
      lastChange = Date.now();
      if (buildShots < 4) {
        buildShots += 1;
        await shot(page, `05-assistant-building-${buildShots}`);
      }
      note(`activity entries=${count}`);
    } else if (count > 0 && Date.now() - lastChange > IDLE_MS) {
      note(`activity idle after ${Math.round((Date.now() - started) / 1000)}s (entries=${count})`);
      break;
    }
  }
  await shot(page, "06-editor-final");

  const finalState = await page.evaluate(() => ({
    title: document.title,
    activityLog: localStorage.getItem("oprn:ai-activity-logs")?.slice(0, 200000) ?? null,
  }));
  writeFileSync(join(OUT, "activity-log.txt"), finalState.activityLog ?? "", "utf8");
  writeFileSync(
    join(OUT, "wizard-qa.json"),
    JSON.stringify({ ok: true, base: BASE, shots, idleEntries: lastCount, elapsedS: Math.round((Date.now() - started) / 1000), pageTitle: finalState.title, log }, null, 2),
    "utf8",
  );
  console.log(JSON.stringify({ ok: true, shots: shots.length, entries: lastCount }));
} catch (error) {
  writeFileSync(join(OUT, "wizard-qa.json"), JSON.stringify({ ok: false, error: String(error), shots, log }, null, 2), "utf8");
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
