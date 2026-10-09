// 농장 동물(닭/젖소) RM2K3 캐릭셋 생성기.
// 이 저장소의 캐릭셋 규격을 그대로 따른다 (src/assets/resourceSlicing.ts charset):
//   시트 288x256, 프레임 24x32, 12열 x 8행 = 캐릭터 8슬롯(4x2), 슬롯당 3패턴 x 4방향.
//   방향 행 순서는 CHARSET_DIRECTIONS = up, right, down, left.
//   걷기 패턴은 WALK_PATTERNS [0,1,2,1], idle = 패턴 1 (가운데 열).
// 동물은 캐릭터 슬롯 0 에 그리고 나머지 슬롯은 투명으로 둔다.
// 배경은 (0,0,0,0) 투명 — 런타임 색키가 좌상단 픽셀 RGB(0,0,0)를 투명 처리하므로
// 아트에는 순수 검정을 쓰지 않는다 (외곽선은 진갈색).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { writePng } from "./lib/pixelPng.mjs";

const OUT_DIR = "public/assets/farming/animals";
const FRAME_W = 24;
const FRAME_H = 32;
const SHEET_W = 288;
const SHEET_H = 256;

const PALETTE = {
  ".": null, // 투명
  o: [58, 44, 36, 255], // 외곽 진갈색 (순수 검정 금지 — 색키 보호)
  w: [244, 240, 232, 255], // 몸통 흰색
  W: [214, 206, 190, 255], // 몸통 음영
  e: [36, 28, 24, 255], // 눈
  r: [208, 48, 40, 255], // 닭 볏 빨강
  b: [232, 134, 44, 255], // 닭 부리 주황
  n: [168, 124, 72, 255], // 갈색 포인트 (꼬리깃/꼬리)
  h: [216, 200, 160, 255], // 소 뿔 크림색
  m: [224, 168, 152, 255], // 소 주둥이 분홍
  M: [172, 116, 104, 255], // 소 콧구멍
  p: [90, 66, 50, 255], // 소 얼룩 갈색
  P: [67, 48, 42, 255], // 소 얼룩 진갈색
};

// 'L'/'R' 는 왼발/오른발 픽셀 — 걷기 프레임에서 접지/들어올림 애니메이션에 쓰인다.
// 발 색은 동물별 legColor, 각 발 컬럼의 최하단 픽셀은 hoofColor 로 칠한다.

// 닭 — 흰 몸통 + 갈색 날개끝/꼬리깃, 빨간 볏, 주황 부리. down/up/right (left 는 미러).
const CHICKEN_DOWN = {
  top: 14,
  rows: [
    "..........rr............",
    ".........rrrr...........",
    "........owwwwo..........",
    ".......owwwwwwo.........",
    ".......owewwewo.........",
    ".......owwbbwwo.........",
    "......owwwbbwwwo........",
    ".....owwwwwwwwwwo.......",
    ".....oWwwwwwwwwWo.......",
    ".....oWWwwwwwwWWo.......",
    "......oWWwwwwWWo........",
    ".......oWWWWWWo.........",
    "........owwwwo..........",
    ".........L..R...........",
    "........LL..RR..........",
  ],
};

const CHICKEN_UP = {
  top: 14,
  rows: [
    "..........rr............",
    ".........rrrr...........",
    "........owwwwo..........",
    ".......owwwwwwo.........",
    ".......owwwwwwo.........",
    ".......owwwwwwo.........",
    "......owwwwwwwwo........",
    ".....owwwwwwwwwwo.......",
    ".....oWwwwwwwwwWo.......",
    ".....oWWwwnnwwWWo.......",
    "......oWWnnnnWWo........",
    ".......oWnnnnWo.........",
    "........ownnwo..........",
    ".........L..R...........",
    "........LL..RR..........",
  ],
};

const CHICKEN_RIGHT = {
  top: 14,
  rows: [
    "...........rr...........",
    "..........rrr...........",
    ".........owwwwo.........",
    ".........owwewwob.......",
    ".........owwwwobb.......",
    "........owwwwwwo........",
    "....n..owwwwwwwwo.......",
    "...nn.owwwwwwwwwwo......",
    "...nnowwwwwwwwwwWo......",
    "....nowwWWWWWwwwWo......",
    ".....owwWWWWWwwWo.......",
    "......owwwwwwwwo........",
    ".......owwwwwo..........",
    ".........L..R...........",
    "........LL..RR..........",
  ],
};

// 젖소 — 흰 바탕 + 갈색 얼룩, 크림색 뿔, 분홍 주둥이. 닭보다 큰 실루엣.
const COW_DOWN = {
  top: 12,
  rows: [
    "......hh......hh........",
    ".....oo.owwwwo.oo.......",
    ".....owwowwwwowwo.......",
    "......owwwwwwwwo........",
    "......owewwwwewo........",
    "......owwwwwwwwo........",
    "......ommmmmmmmo........",
    "......omMmmmmMmo........",
    ".......ommmmmmo.........",
    "...owwppwwwwwwppwwo.....",
    "..owwppppwwwwppppwwo....",
    "..owwppppwwwwppppwwo....",
    "..owwwppwwwwwwppwwwo....",
    "..oWwwwwwwwwwwwwwwWo....",
    "...oWWwwwwwwwwwwWWo.....",
    "....LL........RR........",
    "....LL........RR........",
    "....LL........RR........",
  ],
};

const COW_UP = {
  top: 12,
  rows: [
    "......hh......hh........",
    ".....oo.owwwwo.oo.......",
    ".....owwowppwowwo.......",
    "......owwppppwwo........",
    "......owwwppwwwo........",
    "......owwwwwwwwo........",
    "......owwwwwwwwo........",
    "......owwwwwwwwo........",
    ".......owwwwwwo.........",
    "...owwppwwwnwwppwwo.....",
    "..owwppppwwnwppppwwo....",
    "..owwppppwwnwppppwwo....",
    "..owwwppwwwnwwppwwwo....",
    "..oWwwwwwwwnwwwwwwWo....",
    "...oWWwwwwwPwwwwWWo.....",
    "....LL........RR........",
    "....LL........RR........",
    "....LL........RR........",
  ],
};

const COW_RIGHT = {
  top: 13,
  rows: [
    "..............hh........",
    ".............ohwwo......",
    "............owwwwwo.....",
    "............owewwwo.....",
    "............owwwmmo.....",
    "............owwmMmo.....",
    "..nowwwwwwwwwwwwwwo.....",
    ".nowwppppwwwwwppwwwo....",
    ".nowppppppwwwppppwwo....",
    ".Powppppppwwwppppwwo....",
    "..owwppppwwwwwppwwwo....",
    "...oWwwwwwwwwwwwwWo.....",
    "....oWWWwwwwwwWWWo......",
    ".....LL........RR.......",
    ".....LL........RR.......",
    ".....LL........RR.......",
  ],
};

const ANIMALS = [
  {
    fileName: "chicken.png",
    legColor: [216, 118, 44, 255],
    hoofColor: [176, 88, 32, 255],
    grids: { down: CHICKEN_DOWN, up: CHICKEN_UP, right: CHICKEN_RIGHT },
  },
  {
    fileName: "cow.png",
    legColor: [232, 226, 214, 255],
    hoofColor: [68, 52, 44, 255],
    grids: { down: COW_DOWN, up: COW_UP, right: COW_RIGHT },
  },
];

// 시트 내 방향 행 순서 — src/assets/easyrpgRtp.ts CHARSET_DIRECTIONS 와 동일해야 한다.
const DIRECTION_ROWS = ["up", "right", "down", "left"];

function validateGrid(name, grid) {
  if (grid.top < 1) throw new Error(`${name}: top 은 1 이상이어야 한다 (걷기 바운스가 위로 1px 올라간다).`);
  if (grid.top + grid.rows.length > FRAME_H) {
    throw new Error(`${name}: 그리드가 프레임 높이 ${FRAME_H} 를 넘습니다.`);
  }
  grid.rows.forEach((row, y) => {
    if (row.length !== FRAME_W) {
      throw new Error(`${name} row ${y}: 길이가 ${FRAME_W} 이어야 하는데 ${row.length} 입니다: "${row}"`);
    }
    for (const char of row) {
      if (char === "L" || char === "R") continue;
      if (!(char in PALETTE)) throw new Error(`${name} row ${y}: 팔레트에 없는 문자 "${char}"`);
    }
  });
}

function mirrorGrid(grid) {
  return {
    top: grid.top,
    rows: grid.rows.map((row) => row.split("").reverse().join("")),
  };
}

// 발 컬럼별 최하단(접지) 픽셀 y 를 구해 hoof 색을 입힌다.
function footBottomByColumn(grid, footChar) {
  const bottoms = new Map();
  grid.rows.forEach((row, y) => {
    for (let x = 0; x < FRAME_W; x += 1) {
      if (row[x] !== footChar) continue;
      bottoms.set(x, Math.max(bottoms.get(x) ?? -1, y));
    }
  });
  return bottoms;
}

// pattern 1 = idle(원본), pattern 0/2 = 몸 전체 1px 위로(바운스) + 디딤발은 접지 유지(1px 연장),
// 반대발은 몸과 함께 들어올려진다. 디딤발: pattern 0 → 왼발(L), pattern 2 → 오른발(R).
function drawFrame(rgba, animal, grid, frameOriginX, frameOriginY, pattern) {
  const bob = pattern === 1 ? 0 : -1;
  const groundedFoot = pattern === 0 ? "L" : pattern === 2 ? "R" : null;
  const leftBottoms = footBottomByColumn(grid, "L");
  const rightBottoms = footBottomByColumn(grid, "R");

  const put = (x, y, color) => {
    if (x < 0 || x >= FRAME_W || y < 0 || y >= FRAME_H) return;
    const offset = ((frameOriginY + y) * SHEET_W + frameOriginX + x) * 4;
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = color[3];
  };

  grid.rows.forEach((row, gy) => {
    const y = grid.top + gy;
    for (let x = 0; x < FRAME_W; x += 1) {
      const char = row[x];
      if (char === ".") continue;
      if (char === "L" || char === "R") {
        const bottoms = char === "L" ? leftBottoms : rightBottoms;
        const isHoof = bottoms.get(x) === gy;
        const color = isHoof ? animal.hoofColor : animal.legColor;
        put(x, y + bob, color);
        // 디딤발은 원래 높이에도 그려 접지를 유지한다 (다리 1px 연장).
        if (groundedFoot === char) put(x, y, color);
        continue;
      }
      put(x, y + bob, PALETTE[char]);
    }
  });
}

function renderSheet(animal) {
  const rgba = Buffer.alloc(SHEET_W * SHEET_H * 4);
  const grids = {
    up: animal.grids.up,
    right: animal.grids.right,
    down: animal.grids.down,
    left: mirrorGrid(animal.grids.right),
  };
  for (const [direction, grid] of Object.entries(grids)) {
    validateGrid(`${animal.fileName} ${direction}`, grid);
  }
  DIRECTION_ROWS.forEach((direction, directionRow) => {
    for (let pattern = 0; pattern < 3; pattern += 1) {
      drawFrame(rgba, animal, grids[direction], pattern * FRAME_W, directionRow * FRAME_H, pattern);
    }
  });
  return writePng(SHEET_W, SHEET_H, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const animal of ANIMALS) {
  const target = path.join(OUT_DIR, animal.fileName);
  writeFileSync(target, renderSheet(animal));
  console.log(`Generated ${target} (${SHEET_W}x${SHEET_H}, 캐릭터 슬롯 0, 3패턴 x 4방향)`);
}
