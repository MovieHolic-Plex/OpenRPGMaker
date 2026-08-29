// 조수 유리면 대비 검증 — **실제 합성된 스크린샷 픽셀**로 판정한다.
//
// 왜 브라우저 안에서 못 하는가: 편집기 맵 캔버스는 WebGL 이라 `getContext("2d")` 가 null 이고,
// 알파 합성을 손으로 계산하면 backdrop-filter 의 blur/saturate 효과가 빠져 실제와 다른 값이 나온다.
// 스크린샷은 blur 까지 포함해 브라우저가 최종 합성한 결과라 이게 유일한 진실이다.
//
// 방법:
//   1. metrics.json 에서 각 텍스트 요소의 뷰포트 사각형과 선언된 전경색을 읽는다.
//   2. 같은 PNG 에서 그 사각형의 **글자 없는 배경 픽셀**을 표본으로 뽑는다.
//      (표본의 밝은 쪽 상위 분위수 = 배경. 글자는 어두우므로 아래 꼬리로 빠진다.)
//   3. WCAG 대비를 계산하고 AA 통과 여부를 낸다.
//   4. 유리 판정: 패널 뒤 영역이 실제로 변화가 있었는지(맵이 그려졌는지) 같이 본다 —
//      뒤가 단색이면 반투명이든 불투명이든 결과가 같아 "유리로 보인다"는 판정이 무의미하다.
//
// 실행: node scripts/analyze-glass-contrast.mjs verify-shots/assistant-glass/after

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Jimp from "jimp";

const dir = process.argv[2] ?? "verify-shots/assistant-glass/after";
const metricsPath = join(dir, "metrics.json");
if (!existsSync(metricsPath)) {
  console.error(`metrics.json 없음: ${metricsPath}`);
  process.exit(1);
}
const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (a, b) => {
  const [la, lb] = [lum(a), lum(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const parseRgb = (value) => {
  const nums = (value ?? "").match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
};

/** 사각형 안 픽셀을 밝기순으로 모아, 상위 분위수(=글자가 아닌 배경)를 배경색으로 잡는다. */
function backgroundOf(img, [x, y, w, h]) {
  const px = [];
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const ix = x + dx;
      const iy = y + dy;
      if (ix < 0 || iy < 0 || ix >= img.bitmap.width || iy >= img.bitmap.height) continue;
      const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(ix, iy));
      px.push([r, g, b]);
    }
  }
  if (px.length === 0) return null;
  px.sort((p, q) => lum(p) - lum(q));
  // 75 분위 — 글자 획(어두움)을 걷어내고 배경만 남긴다.
  return px[Math.floor(px.length * 0.75)];
}

/**
 * 패널 뒤가 실제로 다채로운가(=맵이 그려졌는가). 단색이면 유리 판정이 무의미하다.
 *
 * 조수 띠는 `backdrop-filter: none` · 불투명 흰 배경이므로 이 값은 **판정에 쓰이지 않는다**
 * (게이트는 대비뿐이다). 그래도 재는 이유: 반투명이 다시 들어오면 그날부터 이 숫자가
 * 필요해진다. 그리고 전체 기록 상태에서는 표본 지점이 오버레이에 가려 2~3 으로 떨어지므로
 * ⚠ 가 떠도 결함이 아니다 — 그 경고를 쫓지 말라는 뜻으로 여기 적어 둔다.
 */
function backdropVariety(img, [x, y, w, h]) {
  const seen = new Set();
  for (let dy = 0; dy < h; dy += 7) {
    for (let dx = 0; dx < w; dx += 7) {
      const ix = x + dx;
      const iy = y + dy;
      if (ix < 0 || iy < 0 || ix >= img.bitmap.width || iy >= img.bitmap.height) continue;
      const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(ix, iy));
      seen.add(`${r >> 3},${g >> 3},${b >> 3}`);
    }
  }
  return seen.size;
}

// 대비 판정 대상. 전경색은 metrics 의 실제 computed `color` 를 쓴다 — 추측하지 않는다.
const TARGETS = [
  ["hint", "빈화면 안내문"],
  ["examplesTitle", "예시 라벨"],
  ["exampleChip", "예시 칩"],
  ["inputField", "입력 플레이스홀더"],
  ["sendButton", "전송 버튼"],
];

/**
 * metrics 키 → 스크린샷 파일명. 계측기(`_assistant-glass-shots.spec.ts`)가
 * `<배경>_<상태>` 로 키를 쓰고 `<배경>-<번호>-<상태>-full.png` 로 찍으므로 규칙으로 푼다.
 * 예전에는 도크별 이름을 손으로 적은 표였다 — 배치가 사라져 표가 통째로 죽었다.
 */
const STAGE_INDEX = { idle: "01", focus: "02", risen: "03", history: "04" };
function shotNameFor(key) {
  const at = key.indexOf("_");
  if (at < 0) return null;
  const backdrop = key.slice(0, at);
  const stage = key.slice(at + 1);
  const index = STAGE_INDEX[stage];
  return index ? `${backdrop}-${index}-${stage}` : null;
}

const out = { dir, states: [] };

for (const [key, state] of Object.entries(metrics)) {
  if (!state || typeof state !== "object" || !state.panel) continue;
  const name = shotNameFor(key);
  if (!name) continue;
  const shot = join(dir, `${name}-full.png`);
  if (!existsSync(shot)) {
    console.warn(`샷 없음 — 건너뜀: ${shot}`);
    continue;
  }
  const img = await Jimp.read(shot);
  const panelRect = state.panel.rect;

  // 패널 오른쪽 바깥 영역 = 가려지지 않은 맵. 여기 다양성으로 "맵이 그려졌는가"를 본다.
  const outsideX = Math.min(img.bitmap.width - 260, panelRect[0] + panelRect[2] + 40);
  const variety = backdropVariety(img, [outsideX, panelRect[1] + 40, 240, 240]);

  const rows = [];
  for (const [field, label] of TARGETS) {
    const node = state[field];
    if (!node?.rect || node.rect[2] < 4 || node.rect[3] < 4) continue;
    const bg = backgroundOf(img, node.rect);
    if (!bg) continue;
    const fg = parseRgb(node.color);
    const ratio = contrast(fg, bg);
    // 큰 텍스트 기준(18.66px+bold 또는 24px+)은 3:1 이 AA 기준이다.
    const bold = Number(node.fontWeight) >= 700;
    const large = node.fontSize >= 24 || (node.fontSize >= 18.66 && bold);
    const threshold = large ? 3 : 4.5;
    // WCAG 1.4.3 은 비활성 컨트롤을 면제한다(Incidental — inactive user interface components).
    // 재긴 하고 판정에서만 뺀다: 지우면 **활성** 상태가 저대비로 망가지는 회귀를 놓친다.
    const disabled = node.disabled === true || node.ariaDisabled === "true";
    rows.push({
      label,
      fg: node.color,
      fontSize: node.fontSize,
      large,
      threshold,
      background: bg.map(Math.round),
      contrast: Number(ratio.toFixed(2)),
      disabled,
      passesAA: disabled ? true : ratio >= threshold,
      exempt: disabled,
    });
  }
  out.states.push({
    state: key,
    // `dock` 을 싣던 자리 — 배치가 하나라 구분할 값이 없다. 대신 기하 상태를 싣는다(스펙 §1).
    risen: state.risen ?? null,
    historyOpen: state.historyOpen ?? null,
    panelBg: state.panel.background,
    backdropFilter: state.panel.backdropFilter,
    backdropVariety: variety,
    backdropIsFlat: variety <= 3,
    rows,
  });
}

writeFileSync(join(dir, "contrast.json"), JSON.stringify(out, null, 2), "utf8");

let failures = 0;
for (const s of out.states) {
  console.log(`\n### ${s.state} (risen=${s.risen} history=${s.historyOpen})`);
  console.log(`  panelBg=${s.panelBg}  backdrop=${s.backdropFilter}`);
  console.log(`  뒤 배경 다양성=${s.backdropVariety} ${s.backdropIsFlat ? "⚠ 단색 — 유리 판정 무의미" : "OK(맵 그려짐)"}`);
  for (const r of s.rows) {
    if (!r.passesAA) failures += 1;
    const verdict = r.exempt ? "면제" : r.passesAA ? "PASS" : "FAIL";
    console.log(
      `  ${verdict}  ${r.label}  fg=${r.fg} ${r.fontSize}px  ` +
      `bg=rgb(${r.background.join(",")})  ${r.contrast}:1 (기준 ${r.threshold})` +
      `${r.exempt ? " — 비활성(WCAG 1.4.3 면제)" : ""}`,
    );
  }
}
console.log(`\n→ ${join(dir, "contrast.json")}`);
if (out.states.length === 0) {
  // 게이트로 쓰이므로 "잰 것이 없다" 를 통과로 보고하면 안 된다.
  console.error("판정한 상태가 0 개다 — 계측기(_assistant-glass-shots.spec.ts)를 먼저 돌려라.");
  process.exit(1);
}
if (failures > 0) {
  console.error(`\nAA 미달 ${failures}건.`);
  process.exit(1);
}
