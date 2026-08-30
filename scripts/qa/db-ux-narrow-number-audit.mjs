// scripts/qa/db-ux-narrow-number-audit.mjs
// -/+ 스테퍼를 붙인 뒤 값 칸이 너무 좁아져 숫자가 안 보이는 곳을 찾는다.
// 판정: 값 입력칸의 콘텐츠 폭이 숫자 한 글자도 못 담는 수준(< 22px)이면 눌린 것으로 본다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:9877/";
const MIN = Number(process.env.MIN_CONTENT ?? 22);
// REVERT=1 이면 이번 수정(좁은 폭에서 −/+ 접기)만 되돌린 상태를 재현해 "고치기 전" 을 센다.
const REVERT = process.env.REVERT === "1";
const OUT = process.env.AUDIT_OUT ?? "verify-shots/db-ux/narrow-number";
const OUT_FILE = process.env.AUDIT_FILE ?? (REVERT ? "audit-before.json" : "audit-after.json");
const TABS = (process.env.TABS ?? [
  "overview", "actors", "classes", "skills", "items", "equipment", "enemies",
  "monster-species", "troops", "elements", "states", "animations",
  "battle-screen", "battle-commands", "terrain", "tilesets", "crops",
  "characters", "life-crafting", "life-collections", "farm-animals",
  "farm-spatial", "daily-weather", "factions", "structure-kits",
  "common-events", "switches", "variables", "terms", "system",
].join(",")).split(",");

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.waitForTimeout(800);
if (REVERT) {
  await page.addStyleTag({
    content: ".database-modal-backdrop .database-modal-window .db-number-stepper-button{display:inline-flex}",
  });
  await page.waitForTimeout(200);
}

const AUDIT = (min) => {
  const root = document.querySelector(".database-modal-backdrop");
  if (!root) return [];
  const out = [];
  for (const input of root.querySelectorAll('input[type="number"]')) {
    const r = input.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(input);
    const content = r.width - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0)
      - parseFloat(cs.borderLeftWidth || 0) - parseFloat(cs.borderRightWidth || 0);
    if (content >= min) continue;
    // 라벨 추정
    let label = "";
    const wrap = input.closest("label, .db-field, .db-form-row, .db-number-field") || input.parentElement;
    if (wrap) label = (wrap.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30);
    out.push({
      label,
      value: input.value,
      boxW: Math.round(r.width * 10) / 10,
      contentW: Math.round(content * 10) / 10,
      cls: String(input.className).slice(0, 50),
      wrapCls: String(wrap?.className ?? "").slice(0, 50),
      x: Math.round(r.x), y: Math.round(r.y),
    });
  }
  return out;
};

let total = 0;
const byTab = {};
for (const slug of TABS) {
  const ok = await page.evaluate((id) => {
    const n = document.querySelector(`[data-testid="db-tab-${id}"]`);
    if (!(n instanceof HTMLElement)) return false;
    n.scrollIntoView({ block: "nearest" });
    n.click();
    return true;
  }, slug);
  if (!ok) { console.log(`skip ${slug}`); continue; }
  await page.waitForTimeout(600);
  const hits = await page.evaluate(AUDIT, MIN);
  if (hits.length) {
    byTab[slug] = hits;
    total += hits.length;
    console.log(`\n!! ${slug}: ${hits.length}건`);
    for (const h of hits) console.log(`   ${h.x},${h.y} box=${h.boxW} content=${h.contentW} value="${h.value}" | ${h.label}`);
  } else {
    console.log(`ok  ${slug}`);
  }
}
console.log(`\n눌린 숫자칸 합계: ${total} (기준: 콘텐츠 폭 < ${MIN}px)`);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/${OUT_FILE}`, JSON.stringify({
  at: new Date().toISOString(),
  base: BASE,
  state: REVERT ? "before-fix (스테퍼 접기 규칙 되돌림)" : "after-fix",
  minContentPx: MIN,
  total,
  byTab,
}, null, 2));
console.log(`기록 → ${OUT}/${OUT_FILE}`);

await browser.close();
// REVERT 모드는 "고치기 전" 을 재는 것이므로 0건이 아닌 게 정상이다.
process.exit(REVERT ? 0 : (total ? 1 : 0));
