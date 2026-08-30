// scripts/qa/db-ux-report-shots.mjs
// 보고서에 넣을 근접 캡처를 만든다. 전부 실기 화면이며, 좌표는 실행 시점에 DOM 에서 찾는다.
//
// 사용: SHOT_BASE=http://127.0.0.1:9877/ node scripts/qa/db-ux-report-shots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:9877/";
const OUT = process.env.SHOT_OUT ?? "verify-shots/db-ux/report-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

async function boot(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(60_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
  await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
  await page.getByTestId("toolbar-database").click();
  await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
  return page;
}

const tab = async (page, slug) => {
  const ok = await page.evaluate((id) => {
    const n = document.querySelector(`[data-testid="db-tab-${id}"]`);
    if (!(n instanceof HTMLElement)) return false;
    n.scrollIntoView({ block: "nearest" });
    n.click();
    return true;
  }, slug);
  if (!ok) throw new Error(`tab not found: ${slug}`);
  await page.waitForTimeout(700);
};

/** 셀렉터로 찾은 요소들을 모두 감싸는 사각형을 여백과 함께 캡처한다. */
async function shotArea(page, name, selectors, pad = 14) {
  const rect = await page.evaluate((sels) => {
    const root = document.querySelector(".database-modal-backdrop");
    if (!root) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, n = 0;
    for (const sel of sels) {
      for (const el of root.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.bottom < 0 || r.top > innerHeight) continue;
        x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top);
        x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom);
        n += 1;
      }
    }
    return n ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1, n } : null;
  }, selectors);
  if (!rect) { console.log(`miss ${name}`); return null; }
  const clip = {
    x: Math.max(0, Math.floor(rect.x - pad)),
    y: Math.max(0, Math.floor(rect.y - pad)),
    width: Math.ceil(rect.w + pad * 2),
    height: Math.ceil(rect.h + pad * 2),
  };
  const vp = page.viewportSize();
  clip.width = Math.min(clip.width, vp.width - clip.x);
  clip.height = Math.min(clip.height, vp.height - clip.y);
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
  console.log(`ok   ${name}  ${clip.width}x${clip.height} (요소 ${rect.n}개)`);
  return clip;
}

// ── 1. 좁은 칸 숫자 스테퍼: 고친 뒤 값이 보이는지 ──────────────────────────
{
  const page = await boot(1680, 1050);
  await tab(page, "enemies");
  await shotArea(page, "num-enemies-stats", [".db-enemy-panel-stats"], 10);
  await shotArea(page, "num-enemies-reward", [".db-enemy-reward-grid"], 10);
  await tab(page, "terrain");
  await shotArea(page, "num-terrain-quick", [".db-terrain-quick-row"], 10);
  // 넉넉한 칸은 −/+ 를 유지한다는 대비 컷
  await tab(page, "skills");
  await shotArea(page, "num-skills-wide", [".db-number-stepper"], 12);
  await page.close();
}

// ── 2. 스테퍼에 마우스를 올린 모습 ────────────────────────────────────────
{
  const page = await boot(1680, 1050);
  await tab(page, "skills");
  const btn = page.locator(".db-number-stepper-inc").first();
  if (await btn.count()) {
    await btn.hover();
    await page.waitForTimeout(250);
    await shotArea(page, "num-hover", [".db-number-stepper"], 12);
  }
  await page.close();
}

// ── 3. 한글 받침 잘림: 제목 근접 (화면 폭 4종) ────────────────────────────
for (const w of [1024, 1280, 1680, 1920]) {
  const page = await boot(w, 900);
  await tab(page, "overview");
  await shotArea(page, `clip-title-${w}`, [".db-overview-hero"], 8);
  await page.close();
}

// ── 4. 화면 폭 4종 전체 모습 ──────────────────────────────────────────────
for (const w of [1024, 1280, 1680, 1920]) {
  const page = await boot(w, 900);
  await tab(page, "overview");
  await page.screenshot({ path: `${OUT}/matrix-${w}.png` });
  console.log(`ok   matrix-${w}`);
  await page.close();
}

// ── 5. 헤더가 얇아진 탭들의 상단 ──────────────────────────────────────────
{
  const page = await boot(1680, 1050);
  for (const slug of ["characters", "crops", "monster-species", "battle-screen"]) {
    await tab(page, slug);
    await shotArea(page, `head-${slug}`, [".db-ws-hero", ".db-overview-hero", ".db-cx-hero", "[class*=hero]"], 8);
  }
  await page.close();
}

// ── 6. 슬라이더 / 셀렉트 / 체크박스 근접 ──────────────────────────────────
{
  const page = await boot(1680, 1050);
  await tab(page, "enemies");
  await shotArea(page, "ctl-slider", [".db-slider-input", "input[type=range]"], 16);
  await shotArea(page, "ctl-select", ["select"], 12);
  await page.close();
}

await browser.close();
console.log("\n캡처 완료 →", OUT);
