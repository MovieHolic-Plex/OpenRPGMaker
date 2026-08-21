#!/usr/bin/env node
// 이펙트 감사 보고서용 정적 증거 이미지 생성기 (브라우저 불필요).
//
// 왜 필요한가: "3개 스킬이 화면에서 똑같다"·"이펙트 시트가 몇 장이다" 는 숫자로 말하면
// 감독이 검수할 수 없다. 실제 시트를 잘라 렌더해야 판단이 선다.
//
// 산출물: output/evidence/effect-report/
//   sheet-<name>-full.png      시트 원본(투명 처리 + 체커보드 합성)
//   record-<id>-strip.png      레코드가 실제 재생하는 프레임만 가로로 이어붙인 스트립
//   flash-swatches.png         저작됐지만 렌더에서 버려지는 flash 색 스와치
//
// 실행: node scripts/gen-effect-evidence-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// jimp 0.16 은 CommonJS 라 named export 가 없다 — default 로 받아야 한다.
import jimpPkg from "jimp";

const Jimp = jimpPkg.default ?? jimpPkg;

const OUT = "output/evidence/effect-report";
mkdirSync(OUT, { recursive: true });

const SCALE = 3; // 96px 셀을 288px 로 — 감독이 픽셀을 볼 수 있게
const CHECKER = 8;

/** 좌상단 픽셀색을 배경으로 보고 키아웃한다(런타임 applyAutoTransparencyKey 와 같은 전제). */
function keyOut(image) {
  const bg = image.getPixelColor(0, 0);
  const { width, height } = image.bitmap;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (image.getPixelColor(x, y) === bg) image.setPixelColor(0x00000000, x, y);
    }
  }
  return image;
}

/** 투명 영역이 보이도록 체커보드 위에 합성한다. */
function onChecker(image) {
  const { width, height } = image.bitmap;
  const board = new Jimp(width, height, 0x00000000);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dark = (Math.floor(x / CHECKER) + Math.floor(y / CHECKER)) % 2 === 0;
      board.setPixelColor(dark ? 0x2a2a32ff : 0x3a3a44ff, x, y);
    }
  }
  board.composite(image, 0, 0);
  return board;
}

/** 시트에서 pattern 번호의 셀을 잘라낸다. */
function cell(sheet, pattern, frameWidth, frameHeight, columns) {
  const column = pattern % columns;
  const row = Math.floor(pattern / columns);
  return sheet.clone().crop(column * frameWidth, row * frameHeight, frameWidth, frameHeight);
}

const SHEETS = [
  { id: "blow", file: "public/assets/easyrpg/battle/Blow.png", frameWidth: 96, frameHeight: 96, columns: 5 },
  { id: "sword1", file: "public/assets/easyrpg/battle/Sword1.png", frameWidth: 96, frameHeight: 96, columns: 5 },
  { id: "arrow", file: "public/assets/easyrpg/battle/Arrow.png", frameWidth: 96, frameHeight: 96, columns: 5 },
  { id: "scarloxy-explosion", file: "public/assets/scarloxy/scarloxy-battle-anim-explosion.png", frameWidth: 96, frameHeight: 96, columns: 4 },
  { id: "scarloxy-fire", file: "public/assets/scarloxy/scarloxy-battle-anim-fire.png", frameWidth: 96, frameHeight: 96, columns: 4 },
  { id: "scarloxy-green", file: "public/assets/scarloxy/scarloxy-battle-anim-green.png", frameWidth: 96, frameHeight: 96, columns: 4 },
  { id: "scarloxy-ice", file: "public/assets/scarloxy/scarloxy-battle-anim-ice.png", frameWidth: 96, frameHeight: 96, columns: 4 },
  { id: "scarloxy-scratch", file: "public/assets/scarloxy/scarloxy-battle-anim-scratch.png", frameWidth: 96, frameHeight: 96, columns: 4 },
  { id: "scarloxy-splash", file: "public/assets/scarloxy/scarloxy-battle-anim-splash.png", frameWidth: 96, frameHeight: 96, columns: 4 },
];

// 스타터 DB 가 실제로 정의한 레코드. zoom/opacity 는 effectAnimation / scarloxyEffectAnimation 팩토리 값 그대로.
const RECORDS = [
  { id: "anim_hit", name: "타격", sheet: "blow", patterns: [0, 1, 2], zoom: [100, 110, 120], opacity: [255, 220, 180], flash: "#ffffff", flashLabel: "흰색" },
  { id: "anim_magic", name: "마법 충격", sheet: "blow", patterns: [0, 1, 2], zoom: [100, 110, 120], opacity: [255, 220, 180], flash: "#78b4ff", flashLabel: "파랑 (120,180,255)" },
  { id: "anim_heal", name: "회복 빛", sheet: "blow", patterns: [0, 1, 2], zoom: [100, 110, 120], opacity: [255, 220, 180], flash: "#a0ffb4", flashLabel: "초록 (160,255,180)" },
  { id: "anim_sword", name: "검격", sheet: "sword1", patterns: [0, 1, 2], zoom: [100, 110, 120], opacity: [255, 220, 180], flash: "#fff0dc", flashLabel: "미색 (255,240,220)" },
  { id: "anim_arrow", name: "화살", sheet: "arrow", patterns: [0, 1, 2], zoom: [100, 110, 120], opacity: [255, 220, 180], flash: null, flashLabel: "없음 (shake만)" },
  { id: "anim_poison", name: "독침", sheet: "arrow", patterns: [0, 1, 2], zoom: [100, 110, 120], opacity: [255, 220, 180], flash: "#78ff78", flashLabel: "초록 (120,255,120)" },
  { id: "anim_scarloxy_explosion", name: "폭발", sheet: "scarloxy-explosion", patterns: [0, 1, 2, 3], zoom: [100, 100, 100, 100], opacity: [255, 255, 255, 255], flash: "#ffc878", flashLabel: "주황 (255,200,120)" },
  { id: "anim_scarloxy_fire", name: "화염", sheet: "scarloxy-fire", patterns: [0, 1, 2, 3], zoom: [100, 100, 100, 100], opacity: [255, 255, 255, 255], flash: "#ff8c3c", flashLabel: "주황 (255,140,60)" },
  { id: "anim_scarloxy_green", name: "풀잎", sheet: "scarloxy-green", patterns: [0, 1, 2, 3], zoom: [100, 100, 100, 100], opacity: [255, 255, 255, 255], flash: "#8cff78", flashLabel: "연두 (140,255,120)" },
  { id: "anim_scarloxy_ice", name: "얼음", sheet: "scarloxy-ice", patterns: [0, 1, 2, 3], zoom: [100, 100, 100, 100], opacity: [255, 255, 255, 255], flash: "#aae6ff", flashLabel: "하늘 (170,230,255)" },
  { id: "anim_scarloxy_scratch", name: "할퀴기", sheet: "scarloxy-scratch", patterns: [0, 1, 2, 3], zoom: [100, 100, 100, 100], opacity: [255, 255, 255, 255], flash: "#ffffff", flashLabel: "흰색" },
  { id: "anim_scarloxy_splash", name: "물보라", sheet: "scarloxy-splash", patterns: [0, 1, 2, 3], zoom: [100, 100, 100, 100], opacity: [255, 255, 255, 255], flash: "#78b4ff", flashLabel: "파랑 (120,180,255)" },
];

const loaded = new Map();
const meta = { sheets: [], records: [] };

for (const sheet of SHEETS) {
  const image = keyOut(await Jimp.read(sheet.file));
  loaded.set(sheet.id, { image, ...sheet });
  const { width, height } = image.bitmap;
  const patterns = (width / sheet.frameWidth) * (height / sheet.frameHeight);
  const full = onChecker(image.clone()).scale(2, Jimp.RESIZE_NEAREST_NEIGHBOR);
  writeFileSync(join(OUT, `sheet-${sheet.id}-full.png`), await full.getBufferAsync(Jimp.MIME_PNG));
  meta.sheets.push({ id: sheet.id, file: sheet.file, width, height, patterns });
  console.log(`[sheet] ${sheet.id.padEnd(20)} ${width}x${height}  patterns=${patterns}`);
}

for (const record of RECORDS) {
  const source = loaded.get(record.sheet);
  if (!source) throw new Error(`시트 없음: ${record.sheet}`);
  const count = record.patterns.length;
  const cellW = source.frameWidth * SCALE;
  const gap = 12;
  const strip = new Jimp(cellW * count + gap * (count - 1), source.frameHeight * SCALE, 0x00000000);

  record.patterns.forEach((pattern, index) => {
    const crop = cell(source.image, pattern, source.frameWidth, source.frameHeight, source.columns);
    // 레코드가 선언한 zoom/opacity 를 그대로 반영해 "실제 재생 모습"에 가깝게 만든다.
    const zoom = (record.zoom[index] ?? 100) / 100;
    const alpha = (record.opacity[index] ?? 255) / 255;
    const scaled = crop.scale(SCALE * zoom, Jimp.RESIZE_NEAREST_NEIGHBOR);
    if (alpha < 1) scaled.opacity(alpha);
    const framed = onChecker(new Jimp(cellW, source.frameHeight * SCALE, 0x00000000));
    // 중앙 정렬 — zoom 이 걸리면 셀보다 커지므로 음수 오프셋이 될 수 있다.
    framed.composite(scaled, Math.round((cellW - scaled.bitmap.width) / 2), Math.round((source.frameHeight * SCALE - scaled.bitmap.height) / 2));
    strip.composite(framed, index * (cellW + gap), 0);
  });

  writeFileSync(join(OUT, `record-${record.id}-strip.png`), await strip.getBufferAsync(Jimp.MIME_PNG));
  meta.records.push({
    id: record.id,
    name: record.name,
    sheet: record.sheet,
    sheetFile: source.file,
    patterns: record.patterns,
    zoom: record.zoom,
    opacity: record.opacity,
    flash: record.flash,
    flashLabel: record.flashLabel,
    frames: count,
    durationMs: count * 120,
  });
  console.log(`[record] ${record.id.padEnd(26)} ${record.sheet.padEnd(20)} patterns=[${record.patterns}] ${count * 120}ms`);
}

// shake 클램프는 순수 함수다 — 스크린샷보다 계산표가 정확한 증거다.
// src/player/playSceneMapCommands.ts:118
const shakeTable = [1, 3, 6, 10].map((preset) => ({
  preset,
  label: { 1: "약하게", 3: "보통", 6: "강하게", 10: "매우 강하게" }[preset],
  raw: preset / 100,
  clamped: Math.min(0.05, Math.max(0.001, preset / 100)),
}));
meta.shakeTable = shakeTable;
console.log("\n[shake] 프리셋 → 실제 Phaser intensity");
for (const row of shakeTable) {
  console.log(`  ${String(row.preset).padStart(2)} ${row.label.padEnd(8)} raw=${row.raw.toFixed(2)} → clamped=${row.clamped.toFixed(2)}${row.raw !== row.clamped ? "  ← 잘림" : ""}`);
}

writeFileSync(join(OUT, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`\n산출물: ${OUT}`);
