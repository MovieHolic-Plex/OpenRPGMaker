// 팀 워크플로 UI 비전 QA 드라이버 (감독 수행)
// 로그인 목업 모달 → 이메일 로그인 → topbar 신원 → 라벨 편집 → 커밋 히스토리 패널 → 재부팅 시 모달 억제 → 게스트 플로우
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence", "teamui-qa");
const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:5299";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const results = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  };

  // ── 시나리오 1: 최초 부팅 → 로그인 모달 → 이메일 로그인 → 신원/히스토리 ──
  const ctx1 = await browser.newContext({ viewport: { width: 1720, height: 960 } });
  const page = await ctx1.newPage();
  page.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 200)));
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };

  const modal = await page.waitForSelector('[data-testid="login-modal"]', { timeout: 20000 }).catch(() => null);
  check("최초 부팅 시 로그인 모달 표시", !!modal);
  await sleep(800);
  await shot("01-login-modal");

  if (modal) {
    await page.fill('[data-testid="login-email"]', "tester@example.com");
    await page.fill('[data-testid="login-password"]', "mock-password");
    await shot("02-login-filled");
    await page.click('[data-testid="login-submit"]');
    await sleep(800);
    const modalGone = await page.evaluate(() => !document.querySelector('[data-testid="login-modal"]'));
    check("로그인 제출 후 모달 닫힘", modalGone);
  }

  const idLabel = await page.evaluate(() => document.querySelector('[data-testid="topbar-identity-label"]')?.textContent ?? "");
  check("topbar 신원 라벨 = 이메일", idLabel === "tester@example.com", `label="${idLabel}"`);
  await shot("03-topbar-identity");

  // 신원 메뉴에서 라벨 편집
  await page.click('[data-testid="topbar-identity"]');
  const menuVisible = await page.waitForSelector('[data-testid="identity-menu"]', { timeout: 5000 }).catch(() => null);
  check("신원 메뉴 열림", !!menuVisible);
  await shot("04-identity-menu");
  if (menuVisible) {
    await page.fill('[data-testid="identity-label-input"]', "QA 감독");
    await page.click('[data-testid="identity-save"]');
    await sleep(500);
    const newLabel = await page.evaluate(() => document.querySelector('[data-testid="topbar-identity-label"]')?.textContent ?? "");
    check("라벨 편집 반영", newLabel === "QA 감독", `label="${newLabel}"`);
    await shot("05-label-edited");
  }

  // 커밋 히스토리 패널 (실 Supabase read)
  await page.click('[data-testid="commit-history-toggle"]');
  const panel = await page.waitForSelector('[data-testid="commit-history-panel"]', { timeout: 5000 }).catch(() => null);
  check("커밋 히스토리 패널 열림", !!panel);
  let histState = "timeout";
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    histState = await page.evaluate(() => {
      if (document.querySelector('[data-testid="commit-history-list"]')) return "list";
      if (document.querySelector('[data-testid="commit-history-error"]')) return "error";
      if (document.querySelector('[data-testid="commit-history-loading"]')) return "loading";
      return "none";
    });
    if (histState === "list" || histState === "error") break;
    await sleep(500);
  }
  const rowCount = await page.evaluate(() => document.querySelectorAll('[data-testid^="commit-history-row-"]').length);
  check("히스토리 로드 (list 도달)", histState === "list", `state=${histState}, rows=${rowCount}`);
  await shot("06-commit-history");

  // 재로드 → 모달 재표시 억제
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="topbar-identity"]', { timeout: 20000 }).catch(() => null);
  await sleep(1500);
  const modalAgain = await page.evaluate(() => !!document.querySelector('[data-testid="login-modal"]'));
  const labelAfterReload = await page.evaluate(() => document.querySelector('[data-testid="topbar-identity-label"]')?.textContent ?? "");
  check("재부팅 시 모달 미표시 + 신원 유지", !modalAgain && labelAfterReload === "QA 감독", `modal=${modalAgain}, label="${labelAfterReload}"`);
  await shot("07-reload-no-modal");
  await ctx1.close();

  // ── 시나리오 2: 게스트 플로우 (새 컨텍스트) ──
  const ctx2 = await browser.newContext({ viewport: { width: 1720, height: 960 } });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const m2 = await p2.waitForSelector('[data-testid="login-modal"]', { timeout: 20000 }).catch(() => null);
  if (m2) {
    await p2.click('[data-testid="login-guest"]');
    await sleep(800);
  }
  const guestLabel = await p2.evaluate(() => document.querySelector('[data-testid="topbar-identity-label"]')?.textContent ?? "");
  check("게스트 로그인 → 라벨 '게스트'", guestLabel === "게스트", `label="${guestLabel}"`);
  await p2.screenshot({ path: path.join(OUT, "08-guest-identity.png") });

  // ── 시나리오 3: OAuth 목업 (이름만) ──
  const ctx3 = await browser.newContext({ viewport: { width: 1720, height: 960 } });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const m3 = await p3.waitForSelector('[data-testid="login-modal"]', { timeout: 20000 }).catch(() => null);
  if (m3) {
    await p3.click('[data-testid="login-oauth-google"]');
    await sleep(500);
    await p3.screenshot({ path: path.join(OUT, "09-oauth-name-mode.png") });
    const nameInput = await p3.$('[data-testid="login-name"]');
    check("OAuth 클릭 → 이름 입력 모드 전환", !!nameInput);
    if (nameInput) {
      await p3.fill('[data-testid="login-name"]', "Google 리뷰어");
      await p3.click('[data-testid="login-submit"]');
      await sleep(800);
      const oauthLabel = await p3.evaluate(() => document.querySelector('[data-testid="topbar-identity-label"]')?.textContent ?? "");
      check("OAuth 목업 라벨 반영", oauthLabel === "Google 리뷰어", `label="${oauthLabel}"`);
      await p3.screenshot({ path: path.join(OUT, "10-oauth-identity.png") });
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length) { console.log("FAILURES:", failed.map((f) => f.name).join(" | ")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
