// 조수 띠 기하 게이트 — 스펙 §6 게이트 2.
//
// 대비는 `analyze-glass-contrast.mjs` 가 본다. 이 스크립트는 **크기와 자리**만 본다:
//
//   1. 유휴 높이 = 56 ± 2px.            (구 구현의 `height: 100%` 가 만든 600px 공백 회귀 신호)
//   2. 자람 높이 ≤ 480px.
//   3. 우하단 앵커 = 16px / 16px.       (`inset: auto 16px 16px auto`)
//   4. 좌측 레일(0~73px) 과 겹치지 않음.
//   5. 띠 안에 40px 이상 **연속 공백 밴드**가 없음 — 이게 600px 공백의 직접 신호다.
//
// 5번만 PNG 를 읽는다. 나머지는 metrics.json 의 실측 사각형으로 충분하다. 공백 판정을
// 브라우저 안에서 못 하는 이유는 대비 스크립트와 같다 — 캔버스가 WebGL 이고, 무엇보다
// "빈 것처럼 보이는가" 는 합성된 픽셀에서만 답이 나온다.
//
// 전체 기록 상태는 **다른 계약**으로 잰다. 띠가 아니라 캔버스 우측을 덮는 520px 전면
// 오버레이이므로(스펙 §1) 56px·480px·16px 앵커를 들이대면 전부 위반으로 나온다.
//
// 공백 밴드도 기록에는 들이대지 않는다. 40px 상한은 **띠**의 계약이다(구 600px 공백은 띠가
// `height: 100%` 로 빈 로그를 펼친 결과였다). 전체 높이 아카이브 화면은 대화가 없으면 아래쪽이
// 비는 게 정상이다 — 문제는 여백이 아니라 **설명 없는 여백**이다. 그래서 기록에는 대신
// "비었으면 안내문이 있는가" 를 단정한다. 실제로 이 검사가 없던 동안 기록은 951px 짜리
// 말 없는 흰 판으로 열렸고, 밴드 검사가 377px×2 로 그것을 먼저 잡아냈다.
//
// 실행: node scripts/check-strip-geometry.mjs verify-shots/assistant-glass/after

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Jimp from "jimp";

const dir = process.argv[2] ?? "verify-shots/assistant-glass/after";
const metricsPath = join(dir, "metrics.json");
if (!existsSync(metricsPath)) {
  console.error(`metrics.json 없음: ${metricsPath} — 계측기(_assistant-glass-shots.spec.ts)를 먼저 돌려라.`);
  process.exit(1);
}
const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));

const IDLE_HEIGHT = 56;
const IDLE_TOLERANCE = 2;
const MAX_HEIGHT = 480;
const ANCHOR_GAP = 16;
const LEFT_RAIL_RIGHT = 73;
const MAX_BLANK_BAND = 40;
const HISTORY_WIDTH = 520;

const STAGE_INDEX = { idle: "01", focus: "02", risen: "03", history: "04" };
function shotNameFor(key) {
  const at = key.indexOf("_");
  if (at < 0) return null;
  const stage = key.slice(at + 1);
  const index = STAGE_INDEX[stage];
  return index ? `${key.slice(0, at)}-${index}-${stage}` : null;
}

/**
 * 셸 안에서 가장 긴 **연속 공백 행 구간**의 높이(px).
 *
 * 한 행이 "공백"인 판정: 그 행의 픽셀이 거의 한 색이다(밝기 폭이 좁다). 글자·칩·버튼이
 * 있으면 어두운 획이 섞여 폭이 벌어진다. 좌우 8px 는 테두리·둥근 모서리라 잘라낸다.
 */
async function longestBlankBand(shotPath, [x, y, w, h]) {
  const img = await Jimp.read(shotPath);
  const x0 = Math.max(0, x + 8);
  const x1 = Math.min(img.bitmap.width, x + w - 8);
  if (x1 - x0 < 8) return { band: 0, at: null };

  let longest = 0;
  let longestAt = null;
  let run = 0;
  let runStart = 0;
  for (let row = Math.max(0, y); row < Math.min(img.bitmap.height, y + h); row += 1) {
    let min = 255;
    let max = 0;
    for (let col = x0; col < x1; col += 2) {
      const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(col, row));
      const v = (r * 299 + g * 587 + b * 114) / 1000;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    // 폭 12 이하 = 사실상 한 색. 안티에일리어싱·미세 그라디언트는 이 아래로 들어온다.
    if (max - min <= 12) {
      if (run === 0) runStart = row;
      run += 1;
      if (run > longest) {
        longest = run;
        longestAt = runStart;
      }
    } else {
      run = 0;
    }
  }
  return { band: longest, at: longestAt };
}

const problems = [];
const rows = [];

for (const [key, state] of Object.entries(metrics)) {
  if (!state || typeof state !== "object" || !state.panel) continue;
  const [x, y, w, h] = state.panel.rect;
  const history = state.historyOpen === true;
  const name = shotNameFor(key);
  const shot = name ? join(dir, `${name}-full.png`) : null;

  const fail = (message) => problems.push(`${key}: ${message}`);

  if (history) {
    // 전면 오버레이 계약: 폭 520px, 우측 정렬(앵커 0), 캔버스 높이를 채운다.
    if (w !== HISTORY_WIDTH) fail(`기록 오버레이 폭 ${w}px — ${HISTORY_WIDTH}px 여야 한다`);
    if (state.gapRight !== 0) fail(`기록 오버레이 우측 간격 ${state.gapRight}px — 0 이어야 한다`);
    if (state.gapBottom !== 0) fail(`기록 오버레이 하단 간격 ${state.gapBottom}px — 0 이어야 한다`);
    // 대화가 없으면 안내문이 실제 높이를 갖고 보여야 한다.
    if (state.conversation === "empty") {
      const empty = state.historyEmpty;
      if (!empty || empty.display === "none" || empty.rect[3] < 8) {
        fail("기록이 비었는데 안내문(.ai-history-empty)이 보이지 않는다 — 말 없는 흰 판으로 열린다");
      }
    }
  } else {
    if (state.risen) {
      if (h > MAX_HEIGHT) fail(`자람 높이 ${h}px > 상한 ${MAX_HEIGHT}px`);
      if (h <= IDLE_HEIGHT) fail(`자람 높이 ${h}px — 유휴(${IDLE_HEIGHT}px)보다 커야 한다`);
    } else if (Math.abs(h - IDLE_HEIGHT) > IDLE_TOLERANCE) {
      fail(`유휴 높이 ${h}px — ${IDLE_HEIGHT}±${IDLE_TOLERANCE}px 여야 한다`);
    }
    if (state.gapRight !== ANCHOR_GAP) fail(`우측 앵커 ${state.gapRight}px — ${ANCHOR_GAP}px 여야 한다`);
    if (state.gapBottom !== ANCHOR_GAP) fail(`하단 앵커 ${state.gapBottom}px — ${ANCHOR_GAP}px 여야 한다`);
  }

  if (x < LEFT_RAIL_RIGHT) fail(`좌측 x=${x} — 좌측 레일(0~${LEFT_RAIL_RIGHT}px) 과 겹친다`);

  let band = null;
  if (shot && existsSync(shot)) {
    const measured = await longestBlankBand(shot, state.panel.rect);
    band = measured.band;
    // 상한은 띠에만 적용한다(위 헤더 참고). 기록은 재서 출력만 하고 판정하지 않는다 —
    // 지우면 "기록 밴드가 어떻게 변했나" 를 다음 사람이 다시 재야 한다.
    if (!history && band > MAX_BLANK_BAND) {
      fail(`연속 공백 밴드 ${band}px (y=${measured.at}) > 상한 ${MAX_BLANK_BAND}px`);
    }
  }

  rows.push({ key, rect: [x, y, w, h], gapRight: state.gapRight, gapBottom: state.gapBottom, risen: state.risen, history, band });
}

for (const r of rows) {
  const kind = r.history ? "기록" : r.risen ? "자람" : "유휴";
  const band = r.band === null ? "(샷없음)" : `${r.band}px${r.history ? "(미판정)" : ""}`;
  console.log(
    `  ${kind.padEnd(2)}  ${r.key.padEnd(20)} ${r.rect[2]}x${r.rect[3]}@${r.rect[0]},${r.rect[1]}  ` +
    `앵커 ${r.gapRight}/${r.gapBottom}  공백밴드 ${band}`,
  );
}

if (rows.length === 0) {
  console.error("\n잰 상태가 0 개다 — 계측기(_assistant-glass-shots.spec.ts)를 먼저 돌려라.");
  process.exit(1);
}
if (problems.length > 0) {
  console.error(`\n기하 위반 ${problems.length}건:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`\n기하 OK — ${rows.length} 상태, 위반 0건.`);
