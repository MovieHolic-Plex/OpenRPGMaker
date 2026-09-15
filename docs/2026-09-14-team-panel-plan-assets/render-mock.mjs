/**
 * 목업 합성 렌더 — mock/team-deck.html 을 실측 바탕 위에 얹어 PNG 로 굽는다.
 * 사용: node docs/2026-09-14-team-panel-plan-assets/render-mock.mjs
 * 출력: docs/2026-09-14-team-panel-plan-assets/proposed/*.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "proposed");
mkdirSync(OUT, { recursive: true });
const mockUrl = pathToFileURL(join(HERE, "mock", "team-deck.html")).href;

// capture-base 가 남긴 데크 좌표 (manifest 없으면 기본값).
function deckBox(w) {
  const p = join(HERE, "base", `deck-${w}.json`);
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  return w === 1920 ? { x: 1144, y: 292, width: 760, height: 596 } : { x: 664, y: 292, width: 760, height: 596 };
}

// 팀 데크 폭 기본 640 — 호스트 폭에서 조수 컴팩트 데크(480)·여백 3×16 을 뻐고 남는 폭으로 클램프(1440 → 596, 1920 → 640).
const clampW = (w) => Math.min(640, (w - 300) - 480 - 48);
// 유휴 바탕의 조수 컴팩트 데크 레일 y — 캐럽쳘에서 데크 박스 기준(데크 높이 141, 레일은 상단).
const idleRailTop = (h) => h - 16 - 141 + 5;
const shots = [
  // [이름, 상태, 뷰포트, 바탕, 추가 파라미터]
  ["p1-running-1440", "running", { w: 1440, h: 900 }, "1440x900-idle.png", () => `deckW=${clampW(1440)}&annot=1&railTop=${idleRailTop(900)}`],
  ["p2-review-1440", "review", { w: 1440, h: 900 }, "1440x900-idle.png", () => `deckW=${clampW(1440)}`],
  ["p3-roster-1440", "roster", { w: 1440, h: 900 }, "1440x900-idle.png", () => `deckW=${clampW(1440)}`],
  ["p4-collapsed-1440", "collapsed", { w: 1440, h: 900 }, "1440x900-idle.png", () => ""],
  ["p5-running-1920", "running", { w: 1920, h: 1080 }, "1920x1080-conversation.png", () => `deckW=640`],
  ["p6-report-1440", "report", { w: 1440, h: 900 }, "1440x900-idle.png", () => `deckW=${clampW(1440)}`],
  ["p7-report-scrolled-1440", "report", { w: 1440, h: 900 }, "1440x900-idle.png", () => `deckW=${clampW(1440)}&scroll=760`],
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [name, state, vp, bgFile, extra] of shots) {
  const bgPath = join(HERE, "base", bgFile);
  if (!existsSync(bgPath)) { console.log("skip (no bg)", name); continue; }
  const d = deckBox(vp.w);
  const hostLeft = vp.w === 1920 ? 300 : 300; // 좌 도크 우측 경계 근사 — bg 이미지가 실측이므로 팀 데크 위치만 좌우한다.
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const url = `${mockUrl}?state=${state}&w=${vp.w}&h=${vp.h}&hostLeft=${hostLeft}&bg=${encodeURIComponent(pathToFileURL(bgPath).href)}&${extra(d)}`;
  await page.goto(url);
  await page.waitForTimeout(600);
  await page.locator("#stage").screenshot({ path: join(OUT, `${name}.png`) });
  console.log("shot", name);
  await context.close();
}
await browser.close();
console.log("done");
