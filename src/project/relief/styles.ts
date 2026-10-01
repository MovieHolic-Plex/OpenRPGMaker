// 바이옴별 절벽 벽면(relief.style). 손으로 찍은 도트 격자 + 바이옴 색 램프.
//
// 격자 글자: '0'~'5' 벽 램프 명암(0 가장 어두운 외곽선, 5 가장 밝음), 'a'~'f' 윗면 램프 명암 0~5(풀·이끼 드리움),
// 'A'~'F' 강조 램프 명암 0~5(눈·얼음·수정 빛·녹·이끼 빛), '.' 비움(입술: 몸통이 비친다 / 덧그림: 건너뛴다).
// 빛은 북서쪽(왼쪽 위): 덩이마다 왼쪽 위가 밝고 오른쪽 아래가 어둡다. 2화소 이상 덩이, 디더·잡음 없음.
//
// 가족(family)은 벽의 **구조**다 — 흙벽·층리·눈 덮인 바위·다듬은 돌·주상절리·수정. 바이옴은 가족 하나 + 덧그림 + 색 램프를 고른다.
// 렌더(render.ts renderRelief)는 벽 화소마다 입술(윗면 바로 밑 줄) → 몸통(화면 좌표로 이어지는 무늬) → 덧그림(윗단 밑에 매달림) 순서로 고른다.

import type { ReliefRampArt } from "./render";
import rampArt from "./rampArt.json";
export type ReliefWallFamily = "earth" | "strata" | "snow" | "masonry" | "basalt" | "crystal" | "peat";

export interface ReliefWallArt {
  /** 윗면 바로 밑 줄들(16 폭). 바이옴 절벽의 첫인상 — 풀 드리움, 눈 처마, 덮개돌, 다듬은 갓돌 */
  readonly lip: readonly string[];
  /** 몸통 무늬(여러 벌이면 덩이마다 고른다). 화면 y 로 이어 붙이므로 층리·줄눈이 옆 칸과 맞는다 */
  readonly body: readonly (readonly string[])[];
  /** 입술을 칸마다 0~2줄 들쭉날쭉하게(흙·눈) */
  readonly jitter: boolean;
}

// ── 흙벽: 풀이 처마처럼 드리우고, 흙 속에 박힌 돌 ──
const EARTH: ReliefWallArt = {
  jitter: true,
  lip: [
    "eeeeddeeeeeddeee",
    "dddccddddddccddd",
    "cc1ccc11cccc1cc1",
    "1111111111111111",
    "2222112222221122",
  ],
  body: [[
    "3333333333322333",
    "3334443333322333",
    "3345544333333333",
    "3344442133333223",
    "3322221133332222",
    "3331111333332223",
    "3333333333333333",
    "2233333333444333",
    "2223333334554433",
    "3333333334444213",
    "3333223333222213",
    "3332222333311133",
    "3333223333333333",
    "3333333333333322",
    "4433333223333322",
    "5443333222333333",
  ]],
};

// ── 층리: 붉은 사암·황토. 단단한 덮개돌 아래 가로 띠가 옆으로 길게 이어진다 ──
const STRATA: ReliefWallArt = {
  jitter: false,
  lip: [
    "5555555555555555",
    "4444554444444554",
    "3333333333333333",
    "1111111111111111",
  ],
  body: [[
    "44444444444444444444444444444444",
    "44443333333344444433333333444444",
    "33333333333333333333333333333333",
    "33333322333333333333333322233333",
    "22222222222222332222222222222222",
    "11111111111111111111111111111111",
    "22222111222222222221112222222222",
    "33333333334433333333333333333344",
    "33443333333333333333443333333333",
    "33333333333333222333333333333333",
    "22222333322222222222223333222222",
    "22222222222222222222222222222222",
    "11111111111111111111111111111111",
    "55444444445544444444444455444444",
    "44444444444444444444444444444444",
    "33333333333333333333333333333333",
  ]],
};

// ── 눈 덮인 바위: 두툼한 눈 처마가 흘러내리고, 그 밑은 모난 판으로 쪼개진 찬 바위 ──
const SNOW: ReliefWallArt = {
  jitter: true,
  lip: [
    "FFFFFFFFFFFFFFFF",
    "FFEEFFFFFFEEFFFF",
    "EEEEEEEEEEEEEEEE",
    "DDEEEDDDDEEEEDDD",
    "CDDDC..CDDDDDC..",
    "CC.....CCDC...CC",
    "C.......CC.....C",
  ],
  body: [[
    "4444443333333222",
    "4555443333332222",
    "4544433333322221",
    "4444333333222211",
    "1111111333222111",
    "3333441111111122",
    "3334444333322222",
    "3344554433322222",
    "3344444433222211",
    "3333444333222211",
    "2222111111111111",
    "4433333444433332",
    "4333334455443322",
    "4333334444433322",
    "3333333444333222",
    "1111111111111111",
  ]],
};

// ── 다듬은 돌: 갓돌 한 줄, 그 밑은 엇갈려 쌓은 마름돌(성채·신전·공방 축대) ──
const MASONRY: ReliefWallArt = {
  jitter: false,
  lip: [
    "5555555555555551",
    "4444444444444441",
    "2222222222222221",
    "1111111111111111",
  ],
  body: [[
    "11111111111111111111111111111111",
    "44444444444444214444444444444421",
    "43333333333333214333333333333321",
    "43333333333333214333333333333321",
    "43333333333333214333333333333321",
    "43333333333333214333333333333321",
    "43333333333333214333333333333321",
    "42222222222222214222222222222221",
    "11111111111111111111111111111111",
    "44444421444444444444442144444444",
    "33333321433333333333332143333333",
    "33333321433333333333332143333333",
    "33333321433333333333332143333333",
    "33333321433333333333332143333333",
    "33333321433333333333332143333333",
    "22222221422222222222222142222222",
  ], [
    "11111111111111111111111111111111",
    "44444444444444214444444444444421",
    "43333333333333214333333333333321",
    "43322333333333214333333333333321",
    "43323333333333214333333333333321",
    "43333333333333214333333333333321",
    "43333333333333214333333333333321",
    "42222222222222214222222222222221",
    "11111111111111111111111111111111",
    "44444421444444444444442144444444",
    "33333321433333333333332143333333",
    "33333321433333333333BC2143333333",
    "33333321433333333333CCB143333333",
    "33333321433322333333332143333333",
    "33333321433333333333332143333333",
    "22222221422222222222222142222222",
  ]],
};

// ── 주상절리: 검은 현무암 기둥이 세로로 서고, 기둥마다 다른 높이에서 마디가 끊긴다 ──
const BASALT: ReliefWallArt = {
  jitter: false,
  lip: [
    "5555055555055550",
    "4444044444044440",
    "3332033332033320",
  ],
  body: [[
    "4332043332043320",
    "4332043332043320",
    "4332043332011110",
    "4332043332055530",
    "4332043332043320",
    "1111043332043320",
    "5553043332043320",
    "4332043332043320",
    "4332043332043320",
    "4332043332043320",
    "4332043332043320",
    "4332011111043320",
    "4332055553043320",
    "4332043332043320",
    "4332043332043320",
    "4332043332043320",
  ], [
    "4332043332043320",
    "4332043332043320",
    "4332043332043320",
    "4332011111043320",
    "4332055553043320",
    "4332043332043320",
    "4332043332043320",
    "4332043332043320",
    "4332043332043320",
    "1111043332043320",
    "5553043332043320",
    "4332043332043320",
    "4332043332043320",
    "4332043332011110",
    "4332043332055530",
    "4332043332043320",
  ]],
};

// ── 수정: 마름모 결정면이 엇갈리고, 몇 곳에서 결정 속 빛이 새어 나온다 ──
const CRYSTAL: ReliefWallArt = {
  jitter: false,
  lip: [
    "eeeeddeeeeeddeee",
    "ddccccddddcccddd",
    "11EE11111111FE11",
    "..DE.......ED...",
  ],
  body: [[
    "1133333333333333",
    "1113333223333331",
    "5511332222333311",
    "5441122222233115",
    "4444112222221155",
    "4443311222211554",
    "4433331122113344",
    "4333333111133334",
    "3333333311333333",
    "2333333111133332",
    "2233331155113322",
    "2223311554411222",
    "2222115544441122",
    "2221155444433112",
    "2211334444333311",
    "1113333443333331",
  ], [
    "4112222223311554",
    "4411222222115544",
    "4331122221155444",
    "3333112211334444",
    "3333311113333443",
    "3333331133333333",
    "3333311DE3333223",
    "33331155DD332222",
    "2331155441122222",
    "2211554444112222",
    "2115544443311222",
    "1133444433331122",
    "1333344333333111",
    "3333333333333311",
    "1333322333333111",
    "1133222233331155",
  ]],
};


// ── 이탄 둑(늪, 2026-09-28): 사초가 처마처럼 늘어진 입술 밑으로 섬유질 이탄 띠가 겹겹이, 가는 뿌리가 띠를 뚫고 내려온다.
// 두 번째 몸통은 무너진 둑 — 떨어져 나간 덩이 자리(어두운 홈)와 박힌 돌. 16px 기둥마다 둘 중 하나.
const PEAT: ReliefWallArt = {
  jitter: true,
  lip: [
    "eeddeeedeeddeeed",
    "dcddcdddcddcdddc",
    "c1cc1cdcc1c1dcc1",
    "1111111111111111",
    "2221122222211222",
  ],
  body: [[
    "33332333333323333333233333332333",
    "32333353233333333233333533333333",
    "22222252222222222222222522222222",
    "11111151111111111111111511111111",
    "44434445444344444443444544434444",
    "43444454344444434444445434444444",
    "33333343333333333333333433333333",
    "23332333332333332333332333332333",
    "22222222222222222222222222222222",
    "11111111111111111111111111111111",
    "33333333334433333333333333333333",
    "33433333345543333334333333333433",
    "33333333334433333333333333333333",
    "22322222222222222322222222232222",
    "22222222222222222222222222222222",
    "11111111111111111111111111111111",
  ], [
    "33332333311111333333233333332333",
    "32333331100001133233333533333333",
    "22222211000000112222222522222222",
    "11111110000000011111111511111111",
    "44434441000000144443444544434444",
    "43444444110011444444445434444444",
    "33333333311113333333333433333333",
    "23332333332333332333332333332333",
    "22222222222222222222222222222222",
    "11111111111111111111111111111111",
    "33333333333333333333334433333333",
    "33433333333333334333345543333433",
    "33333333333333333333334421333333",
    "22322222222222222322222211232222",
    "22222222222222222222222222222222",
    "11111111111111111111111111111111",
  ]],
};

export const RELIEF_WALL_FAMILIES: Readonly<Record<ReliefWallFamily, ReliefWallArt>> = {
  earth: EARTH, strata: STRATA, snow: SNOW, masonry: MASONRY, basalt: BASALT, crystal: CRYSTAL, peat: PEAT,
};

/** 벽에 드문드문 매달리는 덧그림(16 폭, 입술 바로 밑부터). 16px 폭 기둥마다 1/overlayEvery 확률. */
export const RELIEF_WALL_OVERLAYS = {
  roots: [
    "...22.......2...",
    "...12......21...",
    "....1......1....",
    "....12.....1....",
    ".....1.....21...",
    ".....1......1...",
    "....11......1...",
    "....1.......2...",
  ],
  vines: [
    "..cd......dc....",
    "..c.......c.....",
    "..cc......cd....",
    "...c.......c....",
    "..dc.......cc...",
    "..c........c....",
    "..cc............",
    "...c............",
  ],
  icicles: [
    "..FE......EF..F.",
    "..E.......E...E.",
    "..D.......D.....",
    "..........D.....",
  ],
  lichen: [
    "................",
    "..BC........CB..",
    ".BCC........CCB.",
    "..BB.........B..",
  ],
  rust: [
    "....AB......BA..",
    "....AB.......B..",
    "....B........B..",
    "....B...........",
  ],
} as const;
export type ReliefWallOverlay = keyof typeof RELIEF_WALL_OVERLAYS;

export interface ReliefStyleSpec {
  readonly family: ReliefWallFamily;
  readonly overlay?: ReliefWallOverlay;
  /** 덩이마다 덧그림이 붙을 확률의 분모(기본 4 → 1/4) */
  readonly overlayEvery?: number;
  /** 램프는 어두움 → 밝음 6단. top 은 맵 칩셋의 바탕 흙(칸 240)에서 뽑았다 */
  readonly top: readonly string[];
  readonly wall: readonly string[];
  readonly accent: readonly string[];
  /**
   * 뒤·옆 가장자리 턱(선택, 늪 2026-09-28). 없으면 예전 그대로 1px 외곽선 + 밝은 1줄.
   * side: 동·서 가장자리 바깥(낮은 땅 쪽)에 그리는 옆면 띠 폭(px, 벽 램프). lip: 북쪽 가장자리 안쪽 밝은 턱 줄 수.
   * 1px 선이 울타리·경계선으로 읽힌다는 QA(정글 MISREAD 39건, 늪 1차 133건) 때문에 높이를 면으로 보이게 한다.
   */
  readonly rim?: ReliefRim | false;
  /**
   * 윗단 가장자리 눈 처마 테(선택, 2026-09-28 tundra-snow). 벽이 안 보이는 북·동·서 가장자리가 1px 선뿐이라 단 차이가 읽히지 않는다 —
   * 켜면 외곽선 안쪽에 눈 처마(북: 밝은 2줄, 서: 밝은 1열, 동: 그늘 1열)를 더 긋고 계단 디딤판을 돌색으로 칠한다. 없으면 그림이 예전과 같다.
   * (툰드라 브랜치에서는 `rim: boolean` 이었다 — 늪의 `rim` 옆면 띠와 이름이 겹쳐 합칠 때 `cornice` 로 나눴다)
   */
  readonly cornice?: boolean;
  /**
   * 솟은 윗면 가장자리 안쪽 그늘 띠(선택, 기본 꺼짐 — 툰드라 담당이 켠다, 2026-09-29 렌더러 r2). 윗면과 아랫땅이 같은 눈일 때
   * 북·동·서 가장자리 안쪽 band px 를 윗면 램프 0번 색 반투명(alpha 0~255, 가장자리에서 안쪽으로 옅어짐)으로 덮는다.
   * 이 화소는 타일 위(over) 띠로 간다 — 그 줄 상층 기물 위에도 그려지므로 기물 금지 띠(벼랑 윗단 두 칸) 안에서만 쓴다(band ≤ 6 권장).
   */
  readonly tundraTopShade?: { readonly band: number; readonly alpha: number };
  /**
   * 자동 계단 경사로(칸 표기 5~8)를 계단(디딤판·챌면)이 아니라 매끈한 비탈로 그린다(선택, 2026-09-29 r3). 사용자 「그냥 주변 지형이랑
   * 어울리는 느낌의 경사로면 충분함」 — 설원·지층·현무암 같은 바이옴의 경사로가 돌계단으로 읽혔다. 걷기 규칙은 그대로(walk.ts), 들림도
   * 비탈로 보간한다(reliefSlopes 가 steps 를 떼므로 screen.ts 도 같이). 켠 양식은 rampArt.json 에 주변 땅 재질 비탈 도트를 둔다.
   */
  readonly smoothStairs?: boolean;
  /**
   * 벽면에 판 계단(선택, 2026-09-29 r3, 사막·초원 전용 새 양식만 켠다): 계단 경사로(5~8)를 렌더러가 돌 디딤판·챌면·옆 볼돌로 칠하고
   * (칸의 하층 타일은 그리지 않는다 — screen.ts reliefPaintsCell), 단 차 1 단에 두 계단(가파른 계단)으로 끊는다.
   * log: 완만한 계단(길이 > 오르는 단 수)은 통나무 가로 턱으로 — 디딤판은 윗면 풀, 챌면은 통나무(강조 램프). 없으면 전부 돌.
   */
  readonly carvedStairs?: { readonly log?: boolean; readonly tread?: "top" | "wall" };
}

/**
 * 뒤·옆 가장자리 턱. sides: 동·서(옆) 가장자리 옆면 띠를 어디에 그리나 — "all" 모든 옆 가장자리(늪 1차 그대로),
 * "diag" 북쪽이 함께 트인 대각·모서리 화소만, "none" 옆면 없음(북쪽 뒤 둑·안쪽 턱만). 적지 않으면 "all".
 */
export interface ReliefRim { readonly side: number; readonly lip: number; readonly soft?: boolean; readonly sides?: "all" | "diag" | "none" }

/** rim 을 적지 않은 양식의 기본 옆면 턱(2026-09-29 렌더러 r2: 북·동·서·대각 가장자리가 1px 선으로 읽히던 것을 모든 양식에서 면으로). */
// r3 (2026-09-29, 사용자 「동쪽이랑 서쪽은 없는 게 나은 것 같다」): 기본 턱은 동·서 옆면 띠를 그리지 않는다 — 북쪽 뒤 둑·안쪽 턱만.
export const RELIEF_DEFAULT_RIM: ReliefRim = { side: 4, lip: 2, soft: true, sides: "none" };

const MOSS = ["#223319", "#304726", "#415f32", "#56793f", "#6e944f", "#8db266"];
const SNOW_WHITE = ["#6f8aa8", "#93aecb", "#b7cde3", "#d6e4f1", "#ecf3fa", "#ffffff"];

/** 바이옴(칩셋 atlas_biome_<id> 의 id) → 절벽 모양. 새 바이옴은 여기 한 줄을 더한다. */
export const RELIEF_STYLES: Readonly<Record<string, ReliefStyleSpec>> = {
  // jungle: ramps sampled from the jungle chipset itself (lawn 240, grass rim 619, rock face 651-683) so the drawn cliffs sit
  // in the chipset's colours — the earlier hand-picked browns were redder and the greens more saturated than the tiles
  jungle: { family: "earth", overlay: "vines", overlayEvery: 2, top: ["#2d531e", "#41792d", "#4c9632", "#579f35", "#62a939", "#73b83e"], wall: ["#1a1615", "#372624", "#4e3324", "#614026", "#6b4e2a", "#8b6a39"], accent: MOSS },
  tropical: { family: "earth", overlay: "vines", overlayEvery: 3, top: ["#325220", "#47762e", "#5e9d3e", "#76c44d", "#85dd57", "#99ff64"], wall: ["#3b2d1a", "#543f25", "#6c5130", "#84633a", "#9c7544", "#b68950"], accent: MOSS },
  skyisle: { family: "earth", overlay: "roots", overlayEvery: 2, top: ["#345126", "#4a7437", "#639a49", "#7cc15b", "#8cda67", "#a1fb76"], wall: ["#2d251d", "#3f3529", "#514434", "#635340", "#75624c", "#897358"], accent: MOSS },
  swamp: { family: "earth", overlay: "roots", overlayEvery: 2, top: ["#373b1f", "#4e542c", "#68703b", "#828c4a", "#939e54", "#a9b660"], wall: ["#241d13", "#34291b", "#423422", "#51402a", "#604c32", "#70583a"], accent: MOSS },
  // swamp relief set (2026-09-28, scripts/content/lib/swamp-plans.mjs th.reliefStyle): peat banks for the marsh fields, and the
  // dead marshes' darker, lichen-grey crumbling banks. New keys — the "swamp" style above (fantasy-500 swamp fields) is unchanged.
  "swamp-peat": { family: "peat", overlay: "roots", overlayEvery: 3, rim: { side: 6, lip: 2 }, top: ["#373b1f", "#4e542c", "#68703b", "#828c4a", "#939e54", "#a9b660"], wall: ["#1a1510", "#2a2118", "#3a2d1f", "#4a3a27", "#5b4930", "#6e5a3c"], accent: MOSS },
  "swamp-dead": { family: "peat", overlay: "lichen", overlayEvery: 2, rim: { side: 6, lip: 2 }, top: ["#2c3022", "#3c412e", "#4f553b", "#626a48", "#707852", "#838c60"], wall: ["#121112", "#1d1b1a", "#2a2623", "#37322d", "#453f38", "#554e45"], accent: ["#27351f", "#36492b", "#4b6338", "#627f46", "#7c9b58", "#9bb86e"] },
  plague: { family: "earth", overlay: "roots", overlayEvery: 3, top: ["#343321", "#4a492f", "#62623e", "#7b7a4e", "#8b8a58", "#a09f65"], wall: ["#201c12", "#2d2819", "#393320", "#463e27", "#53492e", "#615636"], accent: MOSS },
  mushroom: { family: "earth", overlay: "lichen", overlayEvery: 2, top: ["#2a3245", "#3d4762", "#515f83", "#6577a4", "#7286b9", "#839bd5"], wall: ["#1f1b2a", "#2c263c", "#39314d", "#453c5e", "#51476f", "#5f5382"], accent: ["#1d4a4f", "#236a70", "#2b8d92", "#3fb3b0", "#6fd6cc", "#b6f2e6"] },
  savanna: { family: "strata", top: ["#554928", "#7a683a", "#a28b4d", "#cbae60", "#e5c56c", "#ffe27d"], wall: ["#3c2814", "#55381d", "#6d4825", "#85582d", "#9d6835", "#b8793e"], accent: MOSS },
  badlands: { family: "strata", smoothStairs: true, top: ["#523221", "#76482f", "#9d603e", "#c4784e", "#dd8858", "#ff9c65"], wall: ["#4c2615", "#6d361e", "#8b4527", "#aa542f", "#c96337", "#eb7441"], accent: MOSS },
  // saltflat: top from the salt lawn (240) and salt ramp, wall the travertine of the cliff face (2683)
  saltflat: { family: "strata", top: ["#8c8194", "#b3a9ae", "#d8d0c5", "#e0d9ce", "#ece6dc", "#faf6ee"], wall: ["#5f4e3f", "#7c6854", "#947c64", "#b69f84", "#d4bfa3", "#ece0cc"], accent: ["#6c2610", "#a44216", "#d06a22", "#e89a40", "#e4cc40", "#fcf8c4"] },
  desert: { family: "strata", top: ["#5b4d35", "#826e4c", "#ae9366", "#d9b87f", "#f5d090", "#ffefa5"], wall: ["#5a3e22", "#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282"], accent: MOSS },
  // desert relief rework (2026-09-28, agent/r3-relief-stairs 브랜치의 openwiki/biome-desert.md): sandstone = the desert walls with the stone-stair ramp
  // art (rampArt.json "sandstone": every road climb one flight of cut steps); dune = the lee faces of the giant dune / dune
  // ridge fields in shaded sand (lib/desert bp 'sand') with the sand-slope ramp art; the pyramid's risers are wall decor
  sandstone: { family: "strata", top: ["#5b4d35", "#826e4c", "#ae9366", "#d9b87f", "#f5d090", "#ffefa5"], wall: ["#5a3e22", "#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282"], accent: MOSS },
  dune: { family: "strata", top: ["#946234", "#bc8a4e", "#d8aa6a", "#ecc88c", "#f0d49e", "#f8e2b2"], wall: ["#3e2412", "#6a4222", "#946234", "#b07e46", "#c89c62", "#dcb47a"], accent: ["#6a4222", "#946234", "#bc8a4e", "#d8aa6a", "#ecc88c", "#f8e2b2"] },
  // desert r3 (2026-09-29, 사용자 「사막맵 계단이랑 경사로를 너무 못만들었는데」): the same sandstone / dune walls, but every climb is a
  // stair cut into the wall face (carvedStairs: stone treads, risers, cheek stones — no ramp art, the stair cells' tiles are not
  // drawn) and the fields' levels are doubled (lib/relief-carve.mjs) so a cliff is a two-cell face, not a line
  "desert-cut": { family: "strata", carvedStairs: {}, top: ["#5b4d35", "#826e4c", "#ae9366", "#d9b87f", "#f5d090", "#ffefa5"], wall: ["#5a3e22", "#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282"], accent: MOSS },
  "dune-cut": { family: "strata", carvedStairs: {}, top: ["#946234", "#bc8a4e", "#d8aa6a", "#ecc88c", "#f0d49e", "#f8e2b2"], wall: ["#3e2412", "#6a4222", "#946234", "#b07e46", "#c89c62", "#dcb47a"], accent: ["#6a4222", "#946234", "#bc8a4e", "#d8aa6a", "#ecc88c", "#f8e2b2"] },
  // grassland high meadow (r3 2026-09-29, agent/r3-relief-stairs 브랜치의 openwiki/biome-grassland.md, reference tiledata/city-refs/grassland): two-to-three-cell
  // earth faces under a lawn lip (top = the pilgrim-meadow sheet's lawn 240), vines on some columns, stairs cut into the faces
  // (stone) and log steps across the gentler climbs (carvedStairs.log: risers in the accent ramp = log wood)
  "grass-cliff": { family: "earth", overlay: "vines", overlayEvery: 4, carvedStairs: { log: true, tread: "wall" }, top: ["#1a4c22", "#276d2d", "#3d8d43", "#5fa84a", "#87c464", "#b4e08a"], wall: ["#24170b", "#432c16", "#634223", "#825a30", "#a2753f", "#c29552"], accent: ["#2e1a0a", "#4a2c12", "#6e4520", "#94632f", "#b98648", "#d8a866"] },
  tundra: { family: "snow", overlay: "icicles", overlayEvery: 2, top: ["#444335", "#625f4c", "#827f66", "#a39f7f", "#b8b490", "#d4cfa5"], wall: ["#2a3040", "#3c4658", "#566479", "#71819a", "#93a3bb", "#b9c6d8"], accent: SNOW_WHITE },
  // tundra-snow (설원·툰드라 relief fields 2026-09-28, agent/r3-relief-stairs 브랜치의 openwiki/biome-tundra.md): the rebuilt sheet's snow field (cell 240) as the
  // top ramp — the "tundra" row above keeps the old moss-steppe olive for the fantasy-500 fields that already use it
  "tundra-snow": { family: "snow", smoothStairs: true, overlay: "icicles", overlayEvery: 2, cornice: true, top: ["#6a7f9e", "#93a9c6", "#b9cce0", "#d6e3ef", "#e9f1f8", "#ffffff"], wall: ["#2a3040", "#3c4658", "#566479", "#71819a", "#93a3bb", "#b9c6d8"], accent: SNOW_WHITE },
  taiga: { family: "snow", overlay: "icicles", overlayEvery: 4, top: ["#29352e", "#3b4c42", "#4e6658", "#627f6e", "#6f907c", "#7fa58f"], wall: ["#23262b", "#33383f", "#454c55", "#5a626c", "#727b86", "#8d97a2"], accent: SNOW_WHITE },
  elf: { family: "masonry", overlay: "vines", overlayEvery: 3, top: ["#2b4c34", "#3d6d4a", "#529262", "#66b67b", "#73ce8b", "#85eda0"], wall: ["#2e3a36", "#44544e", "#607269", "#7e9187", "#9fb1a6", "#c6d5cb"], accent: MOSS },
  gothic: { family: "masonry", smoothStairs: true, overlay: "lichen", overlayEvery: 3, top: ["#20241d", "#2e3329", "#3e4437", "#4d5545", "#57604e", "#646e5a"], wall: ["#181614", "#221f1c", "#2b2724", "#35302c", "#3f3934", "#49423d"], accent: ["#27351f", "#36492b", "#4b6338", "#627f46", "#7c9b58", "#9bb86e"] },
  holy: { family: "masonry", smoothStairs: true, top: ["#39522a", "#51763c", "#6c9d50", "#87c464", "#99dd71", "#b0ff82"], wall: ["#4a4238", "#6b6153", "#8c8170", "#aca08b", "#c9bea7", "#e6dcc6"], accent: MOSS },
  steampunk: { family: "masonry", smoothStairs: true, overlay: "rust", overlayEvery: 2, top: ["#353228", "#4c4739", "#655e4c", "#7e765f", "#8e856b", "#a4997c"], wall: ["#2a1d17", "#3d2a20", "#55392a", "#6d4a36", "#865d44", "#a27456"], accent: ["#4a2412", "#6e3518", "#96491f", "#bd6127", "#d98237", "#f0a54f"] },
  dwarf: { family: "basalt", smoothStairs: true, overlay: "rust", overlayEvery: 4, top: ["#37352f", "#4e4c43", "#68655a", "#827e70", "#938e7f", "#a9a492"], wall: ["#1b1a1e", "#27262c", "#35343c", "#45444e", "#595863", "#71707d"], accent: ["#4a2412", "#6e3518", "#96491f", "#bd6127", "#d98237", "#f0a54f"] },
  blight: { family: "basalt", overlay: "lichen", overlayEvery: 3, top: ["#29212d", "#3a2f40", "#4e3f56", "#614f6b", "#6e5979", "#7e678b"], wall: ["#1a141d", "#241c2a", "#2f2435", "#392c41", "#43344d", "#4f3d5a"], accent: ["#3b1846", "#56226a", "#74308f", "#9446b2", "#b56ad0", "#d9a0ea"] },
  crystal: { family: "crystal", smoothStairs: true, top: ["#464450", "#646272", "#868298", "#a7a3be", "#bdb8d7", "#d9d4f7"], wall: ["#2b2939", "#3d3b51", "#4f4b67", "#605c7e", "#716d95", "#847fae"], accent: ["#3d5f8a", "#4f82b8", "#6aa8de", "#8fcaf5", "#bfe6ff", "#effaff"] },
};

/** 칩셋 id(atlas_biome_<biome>) → relief.style. 모르는 칩셋이면 undefined(기본 흙벽 그림). */
export function reliefStyleForTileset(tilesetId: string | undefined): string | undefined {
  const id = tilesetId?.replace(/^atlas_biome_/, "");
  return id && RELIEF_STYLES[id] ? id : undefined;
}

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** 렌더가 쓰는 꼴: 글자 → 팔레트 번호(윗면 0~5, 벽 6~11, 강조 12~17, 비움 -1). */
export interface ReliefWallStyle {
  readonly family: ReliefWallFamily;
  readonly ramps: [number[][], number[][], number[][]];
  readonly lip: { readonly w: number; readonly rows: Int8Array[] };
  readonly body: { readonly w: number; readonly h: number; readonly rows: Int8Array[] }[];
  readonly jitter: boolean;
  readonly overlay: { readonly w: number; readonly rows: Int8Array[]; readonly every: number } | null;
  readonly rim: ReliefRim | null;
  readonly cornice: boolean;
  readonly smoothStairs: boolean;
  readonly carvedStairs: { readonly log: boolean; readonly tread: "top" | "wall" } | null;
  readonly topShade: { readonly band: number; readonly alpha: number } | null;
}

const code = (ch: string): number => {
  if (ch >= "0" && ch <= "5") return 6 + ch.charCodeAt(0) - 48;
  if (ch >= "a" && ch <= "f") return ch.charCodeAt(0) - 97;
  if (ch >= "A" && ch <= "F") return 12 + ch.charCodeAt(0) - 65;
  return -1;
};
const grid = (rows: readonly string[]) => rows.map((r) => Int8Array.from(r, code));

const compiled = new Map<string, ReliefWallStyle>();
/** relief.style → 렌더 꼴. 모르는 이름이면 null(기본 그림). */
export function compileReliefStyle(style: string | undefined): ReliefWallStyle | null {
  if (!style) return null;
  const hit = compiled.get(style);
  if (hit) return hit;
  const spec = RELIEF_STYLES[style];
  if (!spec) return null;
  const art = RELIEF_WALL_FAMILIES[spec.family];
  const over = spec.overlay ? RELIEF_WALL_OVERLAYS[spec.overlay] : null;
  const out: ReliefWallStyle = {
    family: spec.family,
    ramps: [spec.top.map(rgb), spec.wall.map(rgb), spec.accent.map(rgb)],
    lip: { w: art.lip[0]!.length, rows: grid(art.lip) },
    body: art.body.map((b) => ({ w: b[0]!.length, h: b.length, rows: grid(b) })),
    jitter: art.jitter,
    overlay: over ? { w: over[0]!.length, rows: grid(over), every: spec.overlayEvery ?? 4 } : null,
    rim: spec.rim === false ? null : spec.rim ?? RELIEF_DEFAULT_RIM,
    cornice: !!spec.cornice,
    topShade: spec.tundraTopShade ?? null,
    smoothStairs: !!spec.smoothStairs,
    carvedStairs: spec.carvedStairs ? { log: !!spec.carvedStairs.log, tread: spec.carvedStairs.tread ?? "top" } : null,
  };
  compiled.set(style, out);
  return out;
}

/** 바이옴 경사로 도트(tiledata/relief-art/<style>-ramp.ase → scripts/content/build-relief-ramp-art.mjs → rampArt.json). 없으면 undefined. */
export function reliefRampArt(style: string | undefined): ReliefRampArt | undefined {
  return style ? (rampArt as Record<string, ReliefRampArt>)[style] : undefined;
}

/** 자동 계단 경사로를 비탈로 그리는 양식인가(ReliefStyleSpec.smoothStairs). */
export const reliefSmoothStairs = (style: string | undefined): boolean => !!(style && RELIEF_STYLES[style]?.smoothStairs);
/** 벽면에 판 계단을 칠하는 양식이면 그 설정({ log }), 아니면 null(ReliefStyleSpec.carvedStairs). */
export const reliefCarvedStairs = (style: string | undefined): { readonly log: boolean } | null =>
  (style && RELIEF_STYLES[style]?.carvedStairs) ? { log: !!RELIEF_STYLES[style]!.carvedStairs!.log } : null;
