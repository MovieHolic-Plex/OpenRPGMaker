// 정수리 이모트 시트 렌더러 — 16x16 프레임을 가로로 이어붙인 PNG 한 장을 만든다.
//
// 왜 코드로 그리는가: 저작자가 고르는 이모트는 엔진이 보장하는 어휘이고(EMOTE_KINDS),
// 손으로 딴 PNG 는 목록과 어긋나도 아무도 모른다. 여기서 그리면 목록 ↔ 그림 드리프트를
// gen-emote-sheet.mjs --check 와 test/emoteSheet.test.ts 가 기계적으로 잡는다.
//
// 그림 방식: 도형만 칠하고 윤곽선은 자동으로 두른다(outlinePass). 타일 색이 무엇이든
// 1px 어두운 테두리가 있으면 읽힌다 — RM 풍선 아이콘이 쓰는 것과 같은 이유다.
import { writePng } from "../pixelPng.mjs";

export const FRAME_SIZE = 16;

/** src/project/emotes.ts 의 EMOTE_KINDS 와 순서까지 같아야 한다(test/emoteSheet.test.ts 가 대조). */
export const EMOTE_SLUGS = [
  "heart",
  "heartBroken",
  "smile",
  "exclamation",
  "question",
  "music",
  "sweat",
  "anger",
  "ellipsis",
  "sleep",
  "sparkle",
  "idea",
];

const OUTLINE = [32, 24, 34, 255];
const WHITE = [255, 255, 255, 255];

const PALETTE = {
  red: [226, 68, 92, 255],
  redDark: [162, 42, 63, 255],
  yellow: [252, 214, 88, 255],
  yellowDark: [214, 156, 40, 255],
  blue: [104, 196, 244, 255],
  blueDark: [52, 132, 196, 255],
  violet: [186, 132, 236, 255],
  grey: [226, 226, 234, 255],
};

class Frame {
  constructor(size = FRAME_SIZE) {
    this.size = size;
    this.pixels = new Array(size * size).fill(null);
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.pixels[y * this.size + x] = color;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return null;
    return this.pixels[y * this.size + x];
  }

  rect(x0, y0, x1, y1, color) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) this.set(x, y, color);
  }

  disc(cx, cy, r, color) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, color);
      }
    }
  }

  /** 문자 그리드(공백=투명)를 좌상단 기준으로 찍는다. 글리프 모양에 쓴다. */
  stamp(rows, x0, y0, colors) {
    rows.forEach((row, dy) => {
      [...row].forEach((mark, dx) => {
        const color = colors[mark];
        if (color) this.set(x0 + dx, y0 + dy, color);
      });
    });
  }

  /** 칠해진 픽셀에 닿은 투명 픽셀을 윤곽선으로 채운다(대각 포함). */
  outlinePass(color = OUTLINE) {
    const additions = [];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.get(x, y)) continue;
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const neighbour = this.get(x + dx, y + dy);
            if (neighbour && neighbour !== color) {
              touches = true;
              break;
            }
          }
        }
        if (touches) additions.push([x, y]);
      }
    }
    for (const [x, y] of additions) this.set(x, y, color);
  }
}

// 하트는 좌우 대칭이 생명이다. 수식으로 뽑으니 16px 에서 단밀가 무너지며 네모난 덩어리가
// 나왔다(실측: 확대 preview). 가운데 열(index 6) 기준으로 짝이 맞는 문자 그리드를 그대로 박는다.
const HEART_ROWS = [
  ".XXX.....XXX.",
  "XXXXX...XXXXX",
  "XXXXXX.XXXXXX",
  "XXXXXXXXXXXXX",
  "XXXXXXXXXXXXX",
  ".XXXXXXXXXXX.",
  "..xxxxxxxxx..",
  "...xxxxxxx...",
  "....xxxxx....",
  ".....xxx.....",
  "......x......",
];

function heartShape(frame, fill, shade) {
  frame.stamp(HEART_ROWS, 1, 3, { X: fill, x: shade });
  frame.set(3, 4, WHITE);
  frame.set(3, 5, WHITE);
  frame.set(4, 5, WHITE);
}

const PAINTERS = {
  heart(frame) {
    heartShape(frame, PALETTE.red, PALETTE.redDark);
  },

  heartBroken(frame) {
    heartShape(frame, PALETTE.red, PALETTE.redDark);
    // 지그재그 균열 — 하트 위에서 아래로 투명하게 깎아낸다.
    const crack = [
      [7, 3], [7, 4], [6, 5], [7, 6], [6, 7], [7, 8], [7, 9], [7, 10], [7, 11], [7, 12],
    ];
    for (const [x, y] of crack) frame.set(x, y, null);
  },

  smile(frame) {
    frame.disc(7.5, 7.5, 6.2, PALETTE.yellow);
    frame.disc(7.5, 10, 5.4, PALETTE.yellowDark);
    frame.disc(7.5, 6.6, 5.4, PALETTE.yellow);
    frame.rect(5, 5, 5, 7, OUTLINE);
    frame.rect(10, 5, 10, 7, OUTLINE);
    const mouth = [[4, 9], [5, 10], [6, 11], [7, 11], [8, 11], [9, 11], [10, 10], [11, 9]];
    for (const [x, y] of mouth) frame.set(x, y, OUTLINE);
  },

  exclamation(frame) {
    frame.stamp(
      [
        " XX ",
        " XX ",
        " XX ",
        " XX ",
        " xx ",
        "    ",
        " XX ",
        " XX ",
      ],
      6,
      3,
      { X: PALETTE.yellow, x: PALETTE.yellowDark },
    );
  },

  question(frame) {
    frame.stamp(
      [
        " XXX  ",
        "X   X ",
        "    X ",
        "   XX ",
        "  XX  ",
        "  xx  ",
        "      ",
        "  XX  ",
        "  XX  ",
      ],
      5,
      3,
      { X: PALETTE.blue, x: PALETTE.blueDark },
    );
  },

  music(frame) {
    frame.stamp(
      [
        "    XXX",
        "   XX X",
        "  XX  X",
        " XX   X",
        " X    X",
        " X   XX",
        "XXX XXX",
        "XXX XXX",
        " X   X ",
      ],
      4,
      3,
      { X: PALETTE.violet },
    );
  },

  sweat(frame) {
    // 물방울: 아래는 둥글고 위는 뾰족하다.
    frame.disc(7.5, 9.5, 4.2, PALETTE.blue);
    frame.rect(7, 3, 8, 5, PALETTE.blue);
    frame.rect(6, 5, 9, 6, PALETTE.blue);
    frame.disc(6, 10.5, 1.6, WHITE);
  },

  anger(frame) {
    // 만화식 분노 표지(💢). 사방 폭발보다 이 모양이 16px 에서 훨씬 잘 읽힌다.
    frame.stamp(
      [
        "..X.....X..",
        ".XXX...XXX.",
        "XXXXX.XXXXX",
        ".XXXXXXXXX.",
        "..XXX.XXX..",
        ".XXXXXXXXX.",
        "XXXXX.XXXXX",
        ".XXX...XXX.",
        "..X.....X..",
      ],
      3,
      4,
      { X: PALETTE.red },
    );
    frame.rect(7, 8, 8, 8, PALETTE.redDark);
  },

  ellipsis(frame) {
    // 점 사이 간격은 3px 이상이어야 한다 — 그보다 좁으면 자동 윤곽선이 서로 붙어 막대가 된다(실측).
    for (const x of [2, 7, 12]) frame.rect(x, 8, x + 1, 9, PALETTE.grey);
  },

  sleep(frame) {
    frame.stamp(
      [
        "XXXX",
        "  XX",
        " XX ",
        "XX  ",
        "XXXX",
      ],
      3,
      3,
      { X: PALETTE.blue },
    );
    frame.stamp(
      [
        "XXX",
        " XX",
        "XX ",
        "XXX",
      ],
      9,
      8,
      { X: PALETTE.blueDark },
    );
  },

  sparkle(frame) {
    const star = [
      "   X   ",
      "   X   ",
      "  XXX  ",
      "XXXXXXX",
      "  XXX  ",
      "   X   ",
      "   X   ",
    ];
    frame.stamp(star, 2, 2, { X: PALETTE.yellow });
    frame.stamp([".X.", "XXX", ".X."], 11, 10, { X: PALETTE.yellowDark });
  },

  idea(frame) {
    frame.disc(7.5, 6.5, 4.2, PALETTE.yellow);
    frame.disc(6, 5.5, 1.8, WHITE);
    frame.rect(6, 10, 9, 11, PALETTE.yellowDark);
    frame.rect(6, 12, 9, 12, PALETTE.grey);
    frame.rect(7, 13, 8, 13, PALETTE.grey);
  },
};

export function paintedEmoteSlugs() {
  return Object.keys(PAINTERS);
}

function renderFrame(slug) {
  const painter = PAINTERS[slug];
  if (!painter) throw new Error(`이모트 페인터가 없다: ${slug}`);
  const frame = new Frame();
  painter(frame);
  frame.outlinePass();
  return frame;
}

/** 전체 시트를 flat RGBA 로. 폭 = 이모트 수 × 16. */
export function renderEmoteSheetRgba(slugs = EMOTE_SLUGS) {
  const width = slugs.length * FRAME_SIZE;
  const rgba = Buffer.alloc(width * FRAME_SIZE * 4);
  slugs.forEach((slug, index) => {
    const frame = renderFrame(slug);
    for (let y = 0; y < FRAME_SIZE; y += 1) {
      for (let x = 0; x < FRAME_SIZE; x += 1) {
        const color = frame.get(x, y);
        if (!color) continue;
        const target = (y * width + index * FRAME_SIZE + x) * 4;
        rgba[target] = color[0];
        rgba[target + 1] = color[1];
        rgba[target + 2] = color[2];
        rgba[target + 3] = color[3];
      }
    }
  });
  return { width, height: FRAME_SIZE, rgba };
}

export function renderEmoteSheetPng(slugs = EMOTE_SLUGS) {
  const { width, height, rgba } = renderEmoteSheetRgba(slugs);
  return writePng(width, height, rgba);
}
