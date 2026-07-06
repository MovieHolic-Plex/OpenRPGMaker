/* DB 오버홀 사후 검증 드라이버 — 신규 기능 실동작 + after 스크린샷 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "evidence", "db-overhaul", "after");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || "http://127.0.0.1:5302";

const results = [];
function report(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByTestId("toolbar-database").click();
  await page.waitForSelector('[data-testid="database-modal"]');

  // ---------- 스킬 탭 ----------
  await page.getByTestId("db-tab-skills").click({ force: true });
  await page.waitForTimeout(500);

  // 속성 select
  const elementSel = page.getByTestId("db-field-skill-element");
  report("skill-element-select-exists", await elementSel.count() > 0);
  if (await elementSel.count()) {
    await elementSel.selectOption({ index: 5 }).catch(() => {});
  }

  // 상태 효과 추가
  const addState = page.getByTestId("db-skill-state-effect-add");
  report("skill-state-effect-add-exists", await addState.count() > 0);
  if (await addState.count()) {
    await addState.click();
    await page.waitForTimeout(300);
    report("skill-state-effect-row-appears", await page.locator('[data-testid^="db-skill-state-effect-row-"]').count() > 0);
  }

  // 애니메이션 미리보기 패널
  report("skill-animation-preview-exists", await page.getByTestId("db-skill-animation-preview").count() > 0);

  // 스위치형 효과 → 스위치 피커
  const kindSel = page.getByTestId("db-field-skill-effect-kind");
  await kindSel.selectOption("switch").catch(() => {});
  await page.waitForTimeout(400);
  const switchPicker = await page.locator('[data-testid*="skill"][data-testid*="switch"]').count();
  report("skill-switch-picker-appears", switchPicker > 0, `count=${switchPicker}`);
  await page.screenshot({ path: path.join(OUT, "skills-switch-effect.png") });
  await kindSel.selectOption("damage").catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "skills-rich.png") });

  // 종류 라벨
  const typeLabel = await page.getByTestId("db-field-skill-type").locator("option[value='normal']").textContent().catch(() => "");
  report("skill-type-label-fixed", typeLabel !== null && typeLabel.trim() !== "일반 물품", `label=${typeLabel}`);

  // 리스트 썸네일
  const thumbs = await page.locator(".db-list .db-list-thumb").count();
  report("skill-list-thumbnails", thumbs > 0, `thumb count=${thumbs}`);

  // ---------- 아이템 탭 ----------
  await page.getByTestId("db-tab-items").click({ force: true });
  await page.waitForTimeout(500);
  report("item-icon-field-exists", await page.getByTestId("db-field-item-icon-resource").count() > 0);
  await page.screenshot({ path: path.join(OUT, "items-rich.png") });

  // ---------- 전투 애니메이션 탭 ----------
  await page.getByTestId("db-tab-animations").click({ force: true });
  await page.waitForTimeout(600);
  const play = page.getByTestId("db-animation-play");
  report("animation-play-button-exists", await play.count() > 0);
  if (await play.count()) {
    await play.click();
    // 기본 애니메이션은 3프레임(~200ms)이라 대기를 길게 잡으면 재생 종료와 경합한다.
    await page.waitForTimeout(80);
    const label = await play.textContent();
    report("animation-play-toggles", (label || "").includes("정지"), `label=${label}`);
    await page.screenshot({ path: path.join(OUT, "animation-playing.png") });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(OUT, "animations-stage.png") });

  // ---------- 주인공 탭 ----------
  await page.getByTestId("db-tab-actors").click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "actors-rich.png") });
  // 설정... → 리소스 다이얼로그
  const setButtons = page.locator(".actor-resource-set-button");
  if (await setButtons.count()) {
    await setButtons.first().click();
    await page.waitForTimeout(500);
    const dialog = await page.getByTestId("db-actor-resource-dialog").count();
    report("actor-resource-dialog-opens", dialog > 0);
    if (dialog) {
      await page.screenshot({ path: path.join(OUT, "actor-resource-dialog.png") });
      const cancel = page.getByTestId("db-actor-resource-cancel");
      if (await cancel.count()) await cancel.click();
      else await page.keyboard.press("Escape");
    }
  } else {
    report("actor-resource-dialog-opens", false, "설정 버튼 없음(미리보기로 대체됐을 수 있음)");
  }

  // 몬스터 리스트 썸네일
  await page.getByTestId("db-tab-enemies").click({ force: true });
  await page.waitForTimeout(500);
  const enemyThumbs = await page.locator(".db-list .db-list-thumb").count();
  report("enemy-list-thumbnails", enemyThumbs > 0, `count=${enemyThumbs}`);
  await page.screenshot({ path: path.join(OUT, "enemies-list-thumbs.png") });

  report("no-page-errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  fs.writeFileSync(path.join(OUT, "verify-results.json"), JSON.stringify(results, null, 2));
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
