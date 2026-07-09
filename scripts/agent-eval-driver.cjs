// 인-에디터 AI 에이전트 직접 사용 평가 드라이버 (감독 수행)
// 블랭크 프로젝트에서 채팅으로 맵 제작→꾸미기→NPC→lint, 각 턴 스크린샷/로그 수집
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence", "agent-eval");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const API_KEY = (() => {
  const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const m = env.match(/OPENROUTER_API_KEY=(.+)/);
  return m ? m[1].trim() : "";
})();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  const timeline = [];
  const mark = (label) => { timeline.push({ t: Date.now(), label }); console.log(new Date().toISOString().slice(11, 19), label); };

  await page.addInitScript((key) => {
    localStorage.setItem("rpg-zzu:ai-config", JSON.stringify({
      baseUrl: "https://openrouter.ai/api/v1", model: "google/gemini-3.1-flash-lite",
      apiKey: key, maxToolCalls: 60, maxTokens: 10240, reasoningEffort: "medium", autoApprove: false,
    }));
  }, API_KEY);

  await page.goto("http://127.0.0.1:5199/?freshProject=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="ai-input"]', { timeout: 30000 });
  await sleep(1500);
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };
  await shot("00-editor-blank");

  const status = () => page.evaluate(() => document.querySelector('[data-testid="ai-status"]')?.textContent ?? "");
  const lastAssistant = () => page.evaluate(() => {
    const bs = document.querySelectorAll('[data-testid="ai-bubble-assistant"]');
    return bs.length ? bs[bs.length - 1].textContent.slice(0, 400) : "";
  });
  const toolActivity = () => page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid="ai-tool-activity"]');
    return els.length ? els[els.length - 1].textContent.slice(0, 500) : "";
  });

  const chat = async (label, text, maxWaitMs = 240000) => {
    const t0 = Date.now();
    mark(`SEND [${label}]: ${text.slice(0, 60)}`);
    await page.fill('[data-testid="ai-input"]', text);
    await page.evaluate(() => document.querySelector('[data-testid="ai-send"]')?.click());
    // 완료 대기: proposal 카드 또는 status 복귀
    let accepted = false;
    while (Date.now() - t0 < maxWaitMs) {
      await sleep(1500);
      const card = await page.evaluate(() => !!document.querySelector('[data-testid="ai-proposal-accept"]'));
      if (card && !accepted) {
        await sleep(600);
        await shot(`${label}-proposal`);
        mark(`PROPOSAL [${label}] +${((Date.now() - t0) / 1000).toFixed(1)}s`);
        await page.evaluate(() => document.querySelector('[data-testid="ai-proposal-accept"]')?.click());
        accepted = true;
        await sleep(1200);
        continue;
      }
      const st = await status();
      if ((st === "대기" || st.includes("완료") || st.includes("오류") || st.includes("에러")) && (Date.now() - t0) > 8000 && !(await page.evaluate(() => !!document.querySelector('[data-testid="ai-proposal-accept"]')))) {
        break;
      }
    }
    mark(`DONE [${label}] +${((Date.now() - t0) / 1000).toFixed(1)}s status="${await status()}" accepted=${accepted}`);
    console.log("  assistant:", (await lastAssistant()).replace(/\n/g, " ").slice(0, 250));
    console.log("  tools:", (await toolActivity()).replace(/\n/g, " ").slice(0, 250));
    await shot(`${label}-after`);
    return accepted;
  };

  // ── 평가 시나리오 ──
  await chat("T1-map", "24x18 크기의 새 마을 맵을 만들어줘. 이름은 '평가 마을'. 잔디 바닥에 흙길을 깔고, 집 두 채를 지어줘. 시작 위치도 이 맵으로 설정해줘.");
  await chat("T2-decor", "평가 마을 남쪽에 작은 연못을 만들고, 연못 주변을 꽃과 나무로 꾸며줘.");
  await chat("T3-npc", "평가 마을 입구 근처에 '리나'라는 주민 NPC를 배치해줘. 말을 걸면 \"어서 오세요, 평가 마을에!\"와 \"남쪽 연못이 우리 마을 자랑이에요.\" 두 마디를 해.");
  await chat("T4-lint", "run_lint로 프로젝트를 검증하고, 발견된 문제가 있으면 직접 고쳐줘. 결과를 요약해줘.");

  // ── VisualQA: 에디터 캔버스 + 테스트 플레이 ──
  await sleep(1000);
  await shot("50-editor-final-map");
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(3000);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Enter");
    await sleep(1200);
    const started = await page.evaluate(() => !!window.__rpgzzuPlayerSprite?.());
    if (started) break;
  }
  await sleep(1500);
  await shot("51-play-start");
  await page.keyboard.down("ArrowDown"); await sleep(900); await page.keyboard.up("ArrowDown");
  await page.keyboard.down("ArrowRight"); await sleep(900); await page.keyboard.up("ArrowRight");
  await shot("52-play-walk");
  fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline, null, 1));
  console.log("done");
  await browser.close();
})().catch((e) => { console.error("DRIVER FAIL:", String(e).slice(0, 400)); process.exit(1); });
