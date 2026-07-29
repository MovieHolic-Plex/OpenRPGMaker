// 농사 데모 작물 성장 스프라이트 시트 생성기.
// 16x16 프레임을 가로로 이어붙인 시트를 crops/<cropId>.png 로 출력한다.
// windowskin 과 동일하게 외부 이미지 라이브러리 없이 scripts/lib/pixelPng.mjs 로 인코딩.
// 픽셀 아트는 ASCII 그리드로 정의 — 행 길이/팔레트 문자를 스크립트가 검증한다.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { writePng } from "./lib/pixelPng.mjs";

const OUT_DIR = "public/assets/farming/crops";
const FRAME = 16;

// 공통 팔레트 — 좌상단 광원, 진한 외곽 대비 (완전 검정은 피한다).
const PALETTE = {
  ".": null, // 투명
  o: [45, 58, 30, 255], // 어두운 외곽 녹갈색
  d: [64, 48, 32, 255], // 흙 접점 그림자
  G: [51, 112, 42, 255], // 진초록
  g: [79, 158, 60, 255], // 중간초록
  l: [127, 201, 94, 255], // 밝은초록
  y: [168, 224, 122, 255], // 연두 하이라이트
  s: [116, 96, 52, 255], // 줄기 갈록색
  S: [88, 72, 40, 255], // 줄기 음영
  // 감자
  b: [169, 116, 69, 255], // 감자 갈색
  B: [122, 82, 48, 255], // 감자 진갈색
  k: [202, 160, 106, 255], // 감자 밝은 황갈
  // 딸기
  r: [216, 56, 63, 255], // 딸기 빨강
  R: [163, 31, 43, 255], // 딸기 진빨강
  w: [242, 216, 208, 255], // 씨앗/광 점
  f: [246, 242, 234, 255], // 꽃잎 흰색
  c: [236, 200, 74, 255], // 꽃술 노랑 / 옥수수 알 노랑
  // 토마토
  t: [224, 74, 56, 255], // 토마토 빨강
  T: [176, 42, 32, 255], // 토마토 진빨강
  h: [240, 138, 112, 255], // 토마토 하이라이트
  v: [143, 184, 62, 255], // 풋토마토 연녹
  V: [104, 141, 44, 255], // 풋토마토 진녹
  // 옥수수
  C: [192, 154, 44, 255], // 옥수수 진노랑
  // 블루베리
  u: [70, 90, 180, 255],   // 블루베리 파랑
  U: [40, 55, 120, 255],   // 블루베리 진파랑
  q: [130, 150, 220, 255], // 블루베리 하이라이트
  // 멜론
  m: [80, 160, 50, 255],   // 멜론 껍질 초록
  M: [50, 110, 30, 255],   // 멜론 진껍질
  // 호박
  n: [230, 130, 30, 255],  // 호박 주황
  N: [180, 90, 15, 255],   // 호박 진주황
  // 가지
  e: [120, 60, 140, 255],  // 가지 보라
  E: [80, 35, 100, 255],   // 가지 진보라
};

// 각 작물: 성장 단계 프레임(왼쪽 → 오른쪽 순서로 성장)의 ASCII 그리드.
// 그리드는 정확히 16행 x 16열이어야 한다.

const POTATO_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "....ll....ll....",
  "...lyyl..lyyl...",
  "....lggllggl....",
  "......gGGg......",
  ".......GG.......",
  ".......GG.......",
  "......dGGd......",
  "................",
];

const POTATO_MATURE = [
  "................",
  "................",
  "....lggg........",
  "..lgyylggg......",
  ".lgyyglgggg.....",
  ".lggglggGGgg....",
  ".gggGgGGgGGg....",
  "..gGGgGGGgGg....",
  "...gGGgGGGg.....",
  "....gGGGGg......",
  "......sGs.......",
  "......sss.......",
  "..bk..sss..kb...",
  ".kbbk.....kbbk..",
  ".obbbo...obbbo..",
  "................",
];

const STRAWBERRY_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......ll........",
  ".....lyyl.......",
  "..ll.lggl.ll....",
  ".lygl.gg.lgyl...",
  "..lgg.GG.ggl....",
  ".....gGGg.......",
  "......GG........",
  "................",
];

const STRAWBERRY_FRUIT = [
  "................",
  "................",
  "................",
  "....llgggg......",
  "..llyylggggg....",
  ".lgyggggGgggl...",
  ".lgggGgGGgGgl...",
  "..gGgGGGgGGg....",
  ".fwf.gGGg..rr...",
  ".fcf..gGg.rRRr..",
  "..f..rRr...rr...",
  "....rrRRr.......",
  "...rRRwRRr......",
  "....rRRRr.......",
  ".....rRr........",
  "......r.........",
];

const TOMATO_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......ll.......",
  "..ll..lyyl......",
  ".lyyl.lgl.......",
  "..lggsgg........",
  ".....ss.........",
  ".....ss.........",
  "....dssd........",
  "................",
];

const TOMATO_VINE = [
  "................",
  "................",
  "......lyl.......",
  ".....lyggl......",
  ".......sslggl...",
  ".......sslygl...",
  "...lgglss.......",
  "...lyglss.......",
  ".......ss.......",
  ".......sslggl...",
  ".......sslygl...",
  "....vv.ss.......",
  "...vVVvss.......",
  ".......ss.......",
  "......dssd......",
  "................",
];

const TOMATO_RIPE = [
  "................",
  "................",
  "......lyl.......",
  ".....lyggl......",
  ".......sslggl...",
  "......lsslygl...",
  "...lgglss.hht...",
  "...lyglss.httT..",
  ".......ss.ttT...",
  ".......sslggl...",
  "..hht.ssslygl...",
  ".httT.ss........",
  ".ttTT.ss.htt....",
  "..tT..ss.ttT....",
  "......dssd......",
  "................",
];

const CORN_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......l........",
  ".......ll.......",
  "......lyl.......",
  "....l.lgl.l.....",
  "....lg.g.gl.....",
  ".....g.g.g......",
  "......ggg.......",
  "................",
];

const CORN_STALK = [
  "................",
  "................",
  ".......ll.......",
  "......lgG.......",
  "......gG.ll.....",
  "......gGlyl.....",
  "..ll..gGgl......",
  ".lyyl.gG........",
  "..lggggG........",
  "......gG.ll.....",
  "......gGlyyl....",
  "..ll..gGgl......",
  ".lygllgG........",
  "......gG........",
  ".....ogGo.......",
  "................",
];

const CORN_RIPE = [
  ".......y........",
  "......yyy.......",
  ".....y.y.y......",
  "......lgG.......",
  "......gG.ll.....",
  "......gGlyl.....",
  "..ll..gGgl......",
  ".lyyl.gG........",
  "..lggggG.cc.....",
  "......gGgccC....",
  "......gG.cCC....",
  "..cc..gGg.gl....",
  ".ccC.lgG........",
  ".cCC..gG........",
  ".....ogGo.......",
  "................",
];

// 블루베리 — 2단계 (새싹 → 수확기)
const BLUEBERRY_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......ll........",
  ".....lyyl.......",
  "..ll.lggl.ll....",
  ".lygl.gg.lgyl...",
  "..lgg.GG.ggl....",
  ".....gGGg.......",
  "......GG........",
  "................",
];
const BLUEBERRY_MATURE = [
  "................",
  "....llgggg......",
  "..llyylggggg....",
  ".lgyggggGgggl...",
  ".lgggGgGGgGgl...",
  "..gGgGGGgGGg....",
  ".quq.gGGg..uqq..",
  ".qUq..gGg.qUuq..",
  "..q..uUu..uUq...",
  "....uuUuu.......",
  "...uUUEUu.......",
  "....uUEEu.......",
  ".....uUu........",
  "......s.........",
  "......dssd......",
  "................",
];
// 멜론 — 3단계 (새싹 → 덩굴 → 수확기)
const MELON_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......ll.......",
  "..ll..lyyl......",
  ".lyyl.lgl.......",
  "..lggsgg........",
  ".....ss.........",
  ".....ss.........",
  "....dssd........",
  "................",
];
const MELON_VINE = [
  "................",
  "......lyl.......",
  ".....lyggl......",
  ".......sslggl...",
  "......lsslygl...",
  "...lgglss.......",
  "...lyglss.......",
  ".......ss.......",
  "......lmm.......",
  "....llmMMml.....",
  "...lmMmmMMml....",
  "..lmMMmMMmMml...",
  "..mMMMmMMMMm....",
  "..lmMmmMMMml....",
  "...lmmMMml......",
  "................",
];
const MELON_RIPE = [
  "................",
  "......lyl.......",
  ".....lyggl......",
  "......lssggl....",
  "......lssygl....",
  "...lgglss.......",
  "...lyglss.......",
  "......lmm.......",
  "....llmMMml.....",
  "...lmMmmMMml....",
  "..lmMMmMMmMml...",
  "..mMMMmMMMMm....",
  "..lmMmmMMMml....",
  "...lmmMMml......",
  "....dssd........",
  "................",
];
// 호박 — 3단계 (새싹 → 덩굴 → 수확기)
const PUMPKIN_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......l........",
  ".......ll.......",
  "......lyl.......",
  "....l.lgl.l.....",
  "....lg.g.gl.....",
  ".....g.g.g......",
  "......ggg.......",
  "................",
];
const PUMPKIN_VINE = [
  "................",
  "......lyl.......",
  ".....lyggl......",
  "......lssggl....",
  "......lsslygl...",
  "...lgglss.......",
  "...lyglss.......",
  "......lss.......",
  "......lss.......",
  "......nnNn......",
  ".....nNNNn......",
  "....lnnNNnl.....",
  "....nNNNNNn.....",
  ".....lnNnl......",
  ".....ogGo.......",
  "................",
];
const PUMPKIN_RIPE = [
  "................",
  "......lyl.......",
  ".....lyggl......",
  ".......ss.......",
  ".......ss.......",
  "......lnnl......",
  "....llnnNNll....",
  "...lnnnNNnnl....",
  "..lnNNnnnnNNl...",
  "..nNNnnnnnnNNl..",
  "..lnNNnnnnNNl...",
  "...lnnnNNnnl....",
  "....llnnll......",
  "....lsssl.......",
  "....dggd........",
  "................",
];
// 가지 — 2단계 (새싹 → 수확기)
const EGGPLANT_SPROUT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......ll.......",
  "......lyyl......",
  ".....lyggl......",
  "....lggGgl......",
  ".....gGGg.......",
  "......gGg.......",
  ".....dggd.......",
  "................",
];
const EGGPLANT_MATURE = [
  "................",
  "....llgggg......",
  "..llyylggggg....",
  ".lgyggggGgggl...",
  ".lgggGgGGgGgl...",
  "..gGgGGGgGGg....",
  "....leEl........",
  "...lEEEl........",
  "...lEEEl........",
  "...leEel........",
  "....leel........",
  ".....lel........",
  "......s.........",
  ".....dssd.......",
  "................",
  "................",
];
const CROPS = [
  { id: "crop_potato", frames: [POTATO_SPROUT, POTATO_MATURE] },
  { id: "crop_strawberry", frames: [STRAWBERRY_SPROUT, STRAWBERRY_FRUIT] },
  { id: "crop_tomato", frames: [TOMATO_SPROUT, TOMATO_VINE, TOMATO_RIPE] },
  { id: "crop_corn", frames: [CORN_SPROUT, CORN_STALK, CORN_RIPE] },
  { id: "crop_blueberry", frames: [BLUEBERRY_SPROUT, BLUEBERRY_MATURE] },
  { id: "crop_melon", frames: [MELON_SPROUT, MELON_VINE, MELON_RIPE] },
  { id: "crop_pumpkin", frames: [PUMPKIN_SPROUT, PUMPKIN_VINE, PUMPKIN_RIPE] },
  { id: "crop_eggplant", frames: [EGGPLANT_SPROUT, EGGPLANT_MATURE] },
];

function validateGrid(cropId, frameIndex, grid) {
  if (grid.length !== FRAME) {
    throw new Error(`${cropId} frame ${frameIndex}: 행 수가 ${FRAME} 이어야 하는데 ${grid.length} 입니다.`);
  }
  grid.forEach((row, y) => {
    if (row.length !== FRAME) {
      throw new Error(`${cropId} frame ${frameIndex} row ${y}: 길이가 ${FRAME} 이어야 하는데 ${row.length} 입니다: "${row}"`);
    }
    for (const char of row) {
      if (!(char in PALETTE)) throw new Error(`${cropId} frame ${frameIndex} row ${y}: 팔레트에 없는 문자 "${char}"`);
    }
  });
}

function renderSheet(crop) {
  const width = FRAME * crop.frames.length;
  const rgba = Buffer.alloc(width * FRAME * 4);
  crop.frames.forEach((grid, frameIndex) => {
    validateGrid(crop.id, frameIndex, grid);
    grid.forEach((row, y) => {
      for (let x = 0; x < FRAME; x += 1) {
        const color = PALETTE[row[x]];
        if (!color) continue;
        const offset = (y * width + frameIndex * FRAME + x) * 4;
        rgba[offset] = color[0];
        rgba[offset + 1] = color[1];
        rgba[offset + 2] = color[2];
        rgba[offset + 3] = color[3];
      }
    });
  });
  return writePng(width, FRAME, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const crop of CROPS) {
  const target = path.join(OUT_DIR, `${crop.id}.png`);
  writeFileSync(target, renderSheet(crop));
  console.log(`Generated ${target} (${FRAME * crop.frames.length}x${FRAME}, ${crop.frames.length} stages)`);
}
