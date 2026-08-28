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

/** 패널 뒤가 실제로 다채로운가(=맵이 그려졌는가). 단색이면 유리 판정이 무의미하다. */
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
];

const out = { dir, states: [] };

for (const [key, state] of Object.entries(metrics)) {
  if (!state || typeof state !== "object" || !state.panel) continue;
  const shot = join(dir, `${{
    basic_boot: "01-basic-boot",
    basic_focus: "02-basic-focus",
    dock_side: "10-dock-side",
    dock_float: "11-dock-float",
    dock_glass: "12-dock-glass",
  }[key] ?? key}-full.png`);
  if (!existsSync(shot)) continue;
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
    rows.push({
      label,
      fg: node.color,
      fontSize: node.fontSize,
      large,
      threshold,
      background: bg.map(Math.round),
      contrast: Number(ratio.toFixed(2)),
      passesAA: ratio >= threshold,
    });
  }
  out.states.push({
    state: key,
    dock: state.dock,
    panelBg: state.panel.background,
    backdropFilter: state.panel.backdropFilter,
    backdropVariety: variety,
    backdropIsFlat: variety <= 3,
    rows,
  });
}

writeFileSync(join(dir, "contrast.json"), JSON.stringify(out, null, 2), "utf8");

for (const s of out.states) {
  console.log(`\n### ${s.state} (dock=${s.dock})`);
  console.log(`  panelBg=${s.panelBg}  backdrop=${s.backdropFilter}`);
  console.log(`  뒤 배경 다양성=${s.backdropVariety} ${s.backdropIsFlat ? "⚠ 단색 — 유리 판정 무의미" : "OK(맵 그려짐)"}`);
  for (const r of s.rows) {
    console.log(
      `  ${r.passesAA ? "PASS" : "FAIL"}  ${r.label}  fg=${r.fg} ${r.fontSize}px  ` +
      `bg=rgb(${r.background.join(",")})  ${r.contrast}:1 (기준 ${r.threshold})`,
    );
  }
}
console.log(`\n→ ${join(dir, "contrast.json")}`);
