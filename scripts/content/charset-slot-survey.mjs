#!/usr/bin/env node
/**
 * charset-slot-survey — 번들 캐릭터칩 시트의 모든 슬롯을 실제 PNG 화소에서 잘라 검수용 그림으로 만든다.
 *
 * 왜 필요한가: `src/assets/charsetSemantics.ts` 의 라벨은 오래전 육안 판독으로 적힌 값이고,
 * 실제 PNG 와 어긋난 칸이 있다(`물건 2` #6 은 보석이 아니라 회보라 바위). 라벨을 고치려면
 * 칸마다 **지금 그 화소**를 다시 봐야 한다.
 *
 * 사용:
 *   node scripts/content/charset-slot-survey.mjs [--out <dir>] [--zoom <n>]
 *
 * 산출물:
 *   <out>/manifest.json                  — 시트별 슬롯 점유/크롭 경로
 *   <out>/sheets/<sheet>-slots.png       — 시트 전체 8칸 격자(칸 번호 표시)
 *   <out>/slots/<sheet>-<slot>.png       — 칸 하나(방향 4행 × 프레임 3열) 확대 크롭
 *
 * RM2K3/2k 시트 기하: 288×256, 4열×2행의 8 캐릭터 블록(72×128).
 *   블록 안쪽은 3프레임 × 4방향(24×32): 행=down,left,right,up. 열=왼발/정지/오른발.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
function argOf(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const OUT = resolve(argOf('--out', 'verify-shots/charset-semantics-fix/survey'));
const ZOOM = Number(argOf('--zoom', '6'));
const SLOT_ZOOM = Number(argOf('--slot-zoom', '8'));

const CHARSET_DIR = 'public/assets/easyrpg/charset';
const SHEETS = [
  ['tex_easyrpg_charset_actor1', `${CHARSET_DIR}/Actor1.png`],
  ['tex_easyrpg_charset_actor2', `${CHARSET_DIR}/Actor2.png`],
  ['tex_easyrpg_charset_actor3', `${CHARSET_DIR}/Actor3.png`],
  ['tex_easyrpg_charset_actor4', `${CHARSET_DIR}/Actor4.png`],
  ['tex_easyrpg_charset_animal', `${CHARSET_DIR}/Animal.png`],
  ['tex_easyrpg_charset_monster1', `${CHARSET_DIR}/Monster1.png`],
  ['tex_easyrpg_charset_monster2', `${CHARSET_DIR}/Monster2.png`],
  ['tex_easyrpg_charset_monster3', `${CHARSET_DIR}/Monster3.png`],
  ['tex_easyrpg_charset_monster4', 'public/assets/generated/charsets/Monster4.png'],
  ['tex_easyrpg_charset_monster5', 'public/assets/generated/charsets/Monster5.png'],
  ['tex_easyrpg_charset_monster6', 'public/assets/generated/charsets/Monster6.png'],
  ['tex_easyrpg_charset_people1', `${CHARSET_DIR}/People1.png`],
  ['tex_easyrpg_charset_people2', `${CHARSET_DIR}/People2.png`],
  ['tex_easyrpg_charset_people3', `${CHARSET_DIR}/People3.png`],
  ['tex_easyrpg_charset_people4', `${CHARSET_DIR}/People4.png`],
  ['tex_easyrpg_charset_people5', `${CHARSET_DIR}/People5.png`],
  ['tex_easyrpg_charset_object1', `${CHARSET_DIR}/Object1.png`],
  ['tex_easyrpg_charset_object2', `${CHARSET_DIR}/Object2.png`],
  ['tex_easyrpg_charset_vehicles', `${CHARSET_DIR}/Vehicles.png`],
  ['tex_easyrpg_charset_template', `${CHARSET_DIR}/Template.png`],
  ['tex_scarloxy_charset_people1', 'public/assets/scarloxy/scarloxy-charset-people1.png'],
  ['tex_scarloxy_charset_people2', 'public/assets/scarloxy/scarloxy-charset-people2.png'],
  ['tex_farming_charset_chicken', 'public/assets/farming/animals/chicken.png'],
  ['tex_farming_charset_cow', 'public/assets/farming/animals/cow.png'],
  ['tex_oprn_charset_wizarding1', 'public/assets/generated/charsets/Wizarding1.png'],
  ['tex_oprn_charset_wizarding2', 'public/assets/generated/charsets/Wizarding2.png'],
  ['tex_oprn_charset_wizarding3', 'public/assets/generated/charsets/Wizarding3.png'],
  ['tex_oprn_charset_wizarding4', 'public/assets/generated/charsets/Wizarding4.png'],
  ['tex_oprn_charset_wizarding5', 'public/assets/generated/charsets/Wizarding5.png'],
];

const BLOCK_W = 72;
const BLOCK_H = 128;
const FRAME_W = 24;
const FRAME_H = 32;
const DIRECTION_NAMES = ['down', 'left', 'right', 'up'];

mkdirSync(resolve(OUT, 'sheets'), { recursive: true });
mkdirSync(resolve(OUT, 'slots'), { recursive: true });

function sheetPath(relPath) {
  const candidates = [resolve(relPath), resolve('public', relPath)];
  return candidates.find(existsSync);
}

function blankCanvas(width, height, rgba) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  return png;
}

function blit(dst, src, srcX, srcY, srcW, srcH, dstX, dstY, zoom) {
  for (let y = 0; y < srcH * zoom; y++) {
    const sy = srcY + Math.floor(y / zoom);
    const dy = dstY + y;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < srcW * zoom; x++) {
      const sx = srcX + Math.floor(x / zoom);
      const dx = dstX + x;
      if (dx < 0 || dx >= dst.width) continue;
      const s = (sy * src.width + sx) * 4;
      const alpha = src.data[s + 3];
      if (alpha === 0) continue;
      const d = (dy * dst.width + dx) * 4;
      const a = alpha / 255;
      dst.data[d] = Math.round(src.data[s] * a + dst.data[d] * (1 - a));
      dst.data[d + 1] = Math.round(src.data[s + 1] * a + dst.data[d + 1] * (1 - a));
      dst.data[d + 2] = Math.round(src.data[s + 2] * a + dst.data[d + 2] * (1 - a));
      dst.data[d + 3] = 255;
    }
  }
}

function strokeRect(dst, x0, y0, w, h, rgba) {
  const put = (x, y) => {
    if (x < 0 || y < 0 || x >= dst.width || y >= dst.height) return;
    const d = (y * dst.width + x) * 4;
    dst.data[d] = rgba[0];
    dst.data[d + 1] = rgba[1];
    dst.data[d + 2] = rgba[2];
    dst.data[d + 3] = 255;
  };
  for (let x = x0; x < x0 + w; x++) { put(x, y0); put(x, y0 + h - 1); }
  for (let y = y0; y < y0 + h; y++) { put(x0, y); put(x0 + w - 1, y); }
}

function slotIsOccupied(image, slot, background) {
  const bx = (slot % 4) * BLOCK_W;
  const by = Math.floor(slot / 4) * BLOCK_H;
  for (let y = by; y < by + BLOCK_H; y++) {
    for (let x = bx; x < bx + BLOCK_W; x++) {
      const o = (y * image.width + x) * 4;
      const alpha = image.data[o + 3];
      if (alpha === 0) continue;
      // 투명 시트가 아닌 시트(불투명 배경)는 배경색과 다른 화소만 내용으로 본다.
      if (alpha === 255 && background) {
        if (image.data[o] === background[0] && image.data[o + 1] === background[1] && image.data[o + 2] === background[2]) continue;
      }
      return true;
    }
  }
  return false;
}

const manifest = { generatedAt: new Date().toISOString(), zoom: ZOOM, slotZoom: SLOT_ZOOM, directionNames: DIRECTION_NAMES, sheets: [] };

for (const [textureKey, relPath] of SHEETS) {
  const file = sheetPath(relPath);
  if (!file) throw new Error(`missing charset sheet: ${textureKey} -> ${relPath}`);
  const image = PNG.sync.read(readFileSync(file));
  const hasAlpha = image.data.some((value, index) => index % 4 === 3 && value < 255);
  const background = hasAlpha ? null : [image.data[0], image.data[1], image.data[2]];
  const cols = Math.floor(image.width / BLOCK_W);
  const rows = Math.floor(image.height / BLOCK_H);
  const slots = cols * rows;

  const sheetCanvas = blankCanvas(cols * BLOCK_W * ZOOM, rows * BLOCK_H * ZOOM, [250, 246, 240, 255]);
  const slotEntries = [];
  for (let slot = 0; slot < slots; slot++) {
    const bx = (slot % cols) * BLOCK_W;
    const by = Math.floor(slot / cols) * BLOCK_H;
    const occupied = slotIsOccupied(image, slot, background);
    blit(sheetCanvas, image, bx, by, BLOCK_W, BLOCK_H, (slot % cols) * BLOCK_W * ZOOM, Math.floor(slot / cols) * BLOCK_H * ZOOM, ZOOM);
    strokeRect(sheetCanvas, (slot % cols) * BLOCK_W * ZOOM, Math.floor(slot / cols) * BLOCK_H * ZOOM, BLOCK_W * ZOOM, BLOCK_H * ZOOM, [150, 150, 158]);

    // 슬롯 단독 크롭 — 프레임 칸마다 파란 격자를 그려 방향/프레임을 눈으로 구분한다.
    const slotCanvas = blankCanvas(BLOCK_W * SLOT_ZOOM, BLOCK_H * SLOT_ZOOM, [250, 246, 240, 255]);
    blit(slotCanvas, image, bx, by, BLOCK_W, BLOCK_H, 0, 0, SLOT_ZOOM);
    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < 3; frame++) {
        strokeRect(slotCanvas, frame * FRAME_W * SLOT_ZOOM, dir * FRAME_H * SLOT_ZOOM, FRAME_W * SLOT_ZOOM, FRAME_H * SLOT_ZOOM, [120, 170, 230]);
      }
    }
    const slotFile = resolve(OUT, 'slots', `${textureKey}-${slot}.png`);
    writeFileSync(slotFile, PNG.sync.write(slotCanvas));

    slotEntries.push({ slot, occupied, crop: slotFile.replace(resolve('.'), '').replace(/^\//, ''), absoluteCrop: slotFile });
  }
  const sheetFile = resolve(OUT, 'sheets', `${textureKey}-slots.png`);
  writeFileSync(sheetFile, PNG.sync.write(sheetCanvas));
  manifest.sheets.push({
    textureKey, file: file.replace(resolve('.'), '').replace(/^\//, ''), width: image.width, height: image.height,
    cols, rows, hasAlpha, contactSheet: sheetFile, slots: slotEntries,
  });
  console.log(`${textureKey}: ${slots} slots, occupied ${slotEntries.filter((s) => s.occupied).length}`);
}

writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`manifest: ${resolve(OUT, 'manifest.json')}`);
