// 「합본 마을 + 레트로 월드맵 + 숲 나무」 혼합 칩셋 PNG 를 만든다.
//
// 왜 세로로 잇는가: 두 원본은 모두 RM2K 규격 480×256(30×16 = 480칸) 한 장이다. 한 장에 겹쳐
// 넣으면 어느 한쪽의 칸을 버려야 하고, 합본 마을의 타일 ID(하네스·시맨틱·오토타일·물 애니가
// 전부 이 번호에 묶여 있다)가 흔들린다. 그래서 Tibo 실내 확장(480×1056, 1980칸)과 같은 방식으로
// 아래에 이어 붙인다 — 위 480칸은 합본 마을 그대로, 다음 480칸은 레트로 월드맵(ID = 원본 + 480),
// 맨 아래 6행(180칸, ID 960~1139)은 숲 나무 확장 띠(2026-09-18).
//
// 투명 처리: `easyrpg-chipset-retro-world-transparent.png` 는 이름과 달리 투명 픽셀이 0개다
// (실측 2026-09-18 — 팔레트 0번 키 색 (224,103,191) 이 RGB 그대로 남아 있고, 앱의 표준 키
// #FF00FF/#FF678B 허용 오차 8 에도 걸리지 않는다). 원본 팔레트 PNG 에서 이 색은 0번 인덱스에만
// 있으므로(중복 없음), 그 색을 알파 0 으로 뚫어 이어 붙인다. 합본 마을 반쪽은 이미 알파가 있어
// 그대로 복사한다.
//
// 숲 나무 확장 띠 `chipset-ext-forest-trees.png`(480×96 RGBA) 는 사용자가 붙인 32px 격자 자연 시트에서
// 나무·덤불만 원본 픽셀 그대로 잘라 16px 칸에 맞춘 것이다(축소 없음). 이미 알파가 있어 그대로 복사한다.
// 칸별 판정(수관/밑동/가장자리)은 src/project/defaults/forestTreesExtension.ts 가 정본이다.
//
// 재생성: node scripts/gen-combined-town-retro-world-chipset.mjs
// 출력:   public/assets/easyrpg-chipset-combined-town-retro-world-transparent.png (480×608 RGBA)
// 검증:   test/combinedTownRetroWorldChipset.test.ts 가 세 띠를 원본과 픽셀 비교한다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOP_PNG = path.join(ROOT, "public/assets/easyrpg-chipset-combined-town-transparent.png");
const BOTTOM_PNG = path.join(ROOT, "public/assets/easyrpg-chipset-retro-world-transparent.png");
const TREES_PNG = path.join(ROOT, "public/assets/chipset-ext-forest-trees.png");
const OUT_PNG = path.join(ROOT, "public/assets/easyrpg-chipset-combined-town-retro-world-transparent.png");

export const SHEET_WIDTH = 480;
export const SHEET_HEIGHT = 256;
/** 숲 나무 확장 띠 — 6행 × 16px. src/project/defaults/constants.ts FOREST_TREES_ROWS 와 같아야 한다. */
export const TREES_HEIGHT = 96;
/** retro_World.png 팔레트 0번 — RM2K 칩셋 규약상 투명 키. */
export const RETRO_WORLD_COLOR_KEY = { r: 224, g: 103, b: 191 };

function readSheet(file, height = SHEET_HEIGHT) {
  const png = PNG.sync.read(fs.readFileSync(file));
  if (png.width !== SHEET_WIDTH || png.height !== height) {
    throw new Error(`${path.basename(file)}: ${png.width}×${png.height} — ${SHEET_WIDTH}×${height} 시트가 아닙니다`);
  }
  return png;
}

/** 아래 반쪽용: 키 색 픽셀을 알파 0 으로 만든 복사본. 나머지 픽셀은 그대로. */
export function keyOutRetroWorld(src, key = RETRO_WORLD_COLOR_KEY) {
  const out = Buffer.from(src.data);
  let keyed = 0;
  for (let offset = 0; offset < out.length; offset += 4) {
    if (out[offset] === key.r && out[offset + 1] === key.g && out[offset + 2] === key.b) {
      out[offset + 3] = 0;
      keyed += 1;
    }
  }
  return { data: out, keyed };
}

export function composeSheet(top, bottom, trees) {
  const out = new PNG({ width: SHEET_WIDTH, height: SHEET_HEIGHT * 2 + TREES_HEIGHT });
  top.data.copy(out.data, 0);
  const { data, keyed } = keyOutRetroWorld(bottom);
  data.copy(out.data, SHEET_WIDTH * SHEET_HEIGHT * 4);
  trees.data.copy(out.data, SHEET_WIDTH * SHEET_HEIGHT * 2 * 4);
  return { png: out, keyed };
}

function main() {
  const top = readSheet(TOP_PNG);
  const bottom = readSheet(BOTTOM_PNG);
  const trees = readSheet(TREES_PNG, TREES_HEIGHT);
  const { png, keyed } = composeSheet(top, bottom, trees);
  fs.writeFileSync(OUT_PNG, PNG.sync.write(png));
  console.log(`${path.relative(ROOT, OUT_PNG)}: ${png.width}×${png.height}, 레트로 월드맵 키 픽셀 ${keyed}개 → 알파 0, 숲 나무 띠 ${trees.height}px`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
