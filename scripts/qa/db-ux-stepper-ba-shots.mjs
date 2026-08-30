// scripts/qa/db-ux-stepper-ba-shots.mjs
// 좁은 칸 스테퍼 회귀의 전/후를 **같은 화면·같은 좌표**로 캡처한다.
//
// "고치기 전"은 지금 코드에서 컨테이너 쿼리만 되돌려 재현한다:
//   .db-number-stepper-button { display: inline-flex }
// 이 한 줄이 수정 전 상태와 동일한 렌더를 만든다(수정은 그 선언을 좁은 폭에서 끄는 것뿐).
// 같은 스크롤 위치에서 두 번 찍으므로 두 컷이 픽셀 단위로 정렬된다.
//
// 사용: SHOT_BASE=http://127.0.0.1:9877/ node scripts/qa/db-ux-stepper-ba-shots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:9877/";
const OUT = process.env.SHOT_OUT ?? "verify-shots/db-ux/report-shots";
mkdirSync(OUT, { recursive: true });

const REVERT_ID = "db-ux-stepper-revert";
const REVERT_CSS = `.database-modal-backdrop .database-modal-window .db-number-stepper-button{display:inline-flex}`;

const TARGETS = [
  { tab: "enemies", name: "stepper-enemies-stats", sel: ".db-enemy-panel-stats", pad: 10 },
  { tab: "enemies", name: "stepper-enemies-reward", sel: ".db-enemy-reward-grid", pad: 10 },
  { tab: "terrain", name: "stepper-terrain-row", sel: ".db-terrain-quick-row", pad: 12 },
  { tab: "skills", name: "stepper-skills-wide", sel: ".db-number-stepper", pad: 14 },
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
page.setDefaultTimeout(60_000);
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.waitForTimeout(800);

const setRevert = (on) => page.evaluate(({ on, id, css }) => {
  const old = document.getElementById(id);
  if (old) old.remove();
  if (!on) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}, { on, id: REVERT_ID, css: REVERT_CSS });

/** 눌린 칸(콘텐츠 폭 < 22px) 개수를 센다 — 캡처가 무엇을 보여주는지 기계로 확인 */
const squeezed = (sel) => page.evaluate((s) => {
  const scope = document.querySelector(s);
  if (!scope) return -1;
  let n = 0;
  for (const i of scope.querySelectorAll('input[type="number"]')) {
    const r = i.getBoundingClientRect();
    if (r.width < 1) continue;
    const cs = getComputedStyle(i);
    const content = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    if (content < 22) n += 1;
  }
  return n;
}, sel);

for (const t of TARGETS) {
  await page.evaluate((id) => {
    const n = document.querySelector(`[data-testid="db-tab-${id}"]`);
    if (n instanceof HTMLElement) { n.scrollIntoView({ block: "nearest" }); n.click(); }
  }, t.tab);
  await page.waitForTimeout(700);

  const el = page.locator(t.sel).first();
  if (!(await el.count())) { console.log(`miss ${t.name}`); continue; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const box = await el.boundingBox();
  if (!box) { console.log(`miss box ${t.name}`); continue; }
  const vp = page.viewportSize();
  const clip = {
    x: Math.max(0, Math.floor(box.x - t.pad)),
    y: Math.max(0, Math.floor(box.y - t.pad)),
    width: Math.ceil(box.width + t.pad * 2),
    height: Math.ceil(box.height + t.pad * 2),
  };
  clip.width = Math.min(clip.width, vp.width - clip.x);
  clip.height = Math.min(clip.height, vp.height - clip.y);

  await setRevert(true);
  await page.waitForTimeout(200);
  const nBefore = await squeezed(t.sel);
  await page.screenshot({ path: `${OUT}/${t.name}-before.png`, clip });

  await setRevert(false);
  await page.waitForTimeout(200);
  const nAfter = await squeezed(t.sel);
  await page.screenshot({ path: `${OUT}/${t.name}-after.png`, clip });

  console.log(`ok   ${t.name.padEnd(24)} ${clip.width}x${clip.height}  눌린 칸 ${nBefore} → ${nAfter}`);
}

await browser.close();
console.log("\n→", OUT);
