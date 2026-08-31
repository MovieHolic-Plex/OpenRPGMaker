// 데이터베이스 29개 탭 스크린샷 — 모던 개편 before/after 비교용.
//   SHOOT_OUT=verify-shots/db-modernize/after node scripts/shoot-db-tabs.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const BASE = process.env.SHOOT_BASE ?? "http://127.0.0.1:9173/";
const OUT = process.env.SHOOT_OUT ?? "verify-shots/db-modernize/before";
const UI_MODE = process.env.SHOOT_UI_MODE ?? "expert";
const ONLY = process.env.SHOOT_ONLY ? process.env.SHOOT_ONLY.split(",") : null;
const WIDTH = Number(process.env.SHOOT_W ?? 1680);
const HEIGHT = Number(process.env.SHOOT_H ?? 1050);

const TABS = [
  ["overview", "db-tab-overview"],
  ["actors", "db-tab-actors"],
  ["classes", "db-tab-classes"],
  ["skills", "db-tab-skills"],
  ["items", "db-tab-items"],
  ["equipment", "db-tab-equipment"],
  ["enemies", "db-tab-enemies"],
  ["monster-species", "db-tab-monster-species"],
  ["troops", "db-tab-troops"],
  ["elements", "db-tab-elements"],
  ["states", "db-tab-states"],
  ["animations", "db-tab-animations"],
  ["battle-screen", "db-tab-battle-screen"],
  ["battle-commands", "db-tab-battle-commands"],
  ["terrain", "db-tab-terrain"],
  ["crops", "db-tab-crops"],
  ["characters", "db-tab-characters"],
  ["life-crafting", "db-tab-life-crafting"],
  ["daily-weather", "db-tab-daily-weather"],
  ["farm-animals", "db-tab-farm-animals"],
  ["farm-spatial", "db-tab-farm-spatial"],
  // factions 는 등록된 탭이지만 이 목록에 버전을 넘어 마 버지고 있어 before/after 대조에서
  // 항상 제외되어 있었다(2026-08-30 발견). 정본은 database.ts:36 DatabaseTab 유니온 이고
  // 실제 등록 탭은 30개다 — 이 목록이 29개여서 한 탭이 무증상으로 검증망을 모른다.
  ["factions", "db-tab-factions"],
  ["life-collections", "db-tab-life-collections"],
  ["tilesets", "db-tab-tilesets"],
  ["structure-kits", "db-tab-structure-kits"],
  ["common-events", "db-tab-common-events"],
  ["system", "db-tab-system"],
  ["terms", "db-tab-terms"],
  ["switches", "db-tab-switches"],
  ["variables", "db-tab-variables"],
];

mkdirSync(OUT, { recursive: true });

/**
 * vite dev 는 앱 소스를 수백 개 모듈 요청으로 쪼개 내려준다. 이 호스트처럼 docker/tailscale
 * 가상 NIC 이 많으면 크로미움이 네트워크 변경 알림을 받고 그중 일부를 취소해버려
 * (`ERR_NETWORK_CHANGED`) 동적 import 가 죽고 편집기가 안 뜬다. gotoWithRetry 는 네비게이션만
 * 재시도하므로, 부팅 판정(edit-canvas)까지 통째로 재시도한다.
 */
async function bootEditor(target) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await gotoWithRetry(target, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
      await target.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
      return;
    } catch (err) {
      lastError = err;
      console.log(`boot attempt ${attempt} failed: ${String(err).slice(0, 110)}`);
      await target.waitForTimeout(1500);
    }
  }
  throw lastError;
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
page.on("pageerror", (e) => console.error("[pageerror]", e.message.slice(0, 160)));

await page.addInitScript((mode) => localStorage.setItem("oprn:editor-ui-mode", mode), UI_MODE);
await bootEditor(page);

await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.waitForTimeout(800);

const report = [];
for (const [slug, testId] of TABS) {
  if (ONLY && !ONLY.includes(slug)) continue;
  try {
    // 탭 레일은 29 항목이 뷰포트를 넘겨 스크롤된다. 게다가 활성 탭이 바뀔 때마다
    // revealActiveTab 가 레일을 다시 스크롤해 Playwright 액셔너빌리티 판정이 흔들린다.
    // 계약(클릭 핸들러)만 확인하면 되므로 DOM 에서 직접 클릭한다.
    const clicked = await page.evaluate((id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      if (!(node instanceof HTMLElement)) return false;
      node.scrollIntoView({ block: "nearest" });
      node.click();
      return true;
    }, testId);
    if (!clicked) throw new Error(`tab button not found: ${testId}`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${slug}.png` });
    const metrics = await page.evaluate(() => {
      const body = document.querySelector(".database-modal-body .db-body");
      if (!(body instanceof HTMLElement)) return null;
      const controls = {
        inputs: body.querySelectorAll("input").length,
        selects: body.querySelectorAll("select").length,
        buttons: body.querySelectorAll("button").length,
        tables: body.querySelectorAll("table").length,
        fieldsets: body.querySelectorAll("fieldset").length,
        legends: body.querySelectorAll("legend").length,
        h3: body.querySelectorAll("h3").length,
      };
      return {
        scrollH: body.scrollHeight,
        clientH: body.clientHeight,
        overflow: body.scrollHeight > body.clientHeight + 4,
        topLevel: Array.from(body.children).slice(0, 8).map((n) => `${n.tagName.toLowerCase()}.${String(n.className || "").split(" ")[0]}`),
        controls,
      };
    });
    report.push({ slug, ok: true, metrics });
    console.log(`ok  ${slug} ${JSON.stringify(metrics?.controls)} overflow=${metrics?.overflow}`);
  } catch (err) {
    report.push({ slug, ok: false, error: String(err).slice(0, 160) });
    console.log(`ERR ${slug}: ${String(err).slice(0, 120)}`);
  }
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(`\nshot ${report.filter((r) => r.ok).length}/${report.length} -> ${OUT}`);
