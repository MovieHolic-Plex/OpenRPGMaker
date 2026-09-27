// REFMAP「町の外観」MV/MZ 타일셋 프리셋. 그림은 없다 — 시트 이름·해시·칸 좌표와 사람 말 이름뿐이다.
// 이름은 조수가 재료를 부르는 말이다. 좌표는 원본 시트(48px 칸) 기준.
// 원본은 사용자가 받아 둔 로컬 사본(~/.local/share/oprn/refmap-downloads/_packs/refmap-town-outside)만 쓴다.
// 약관: 게임 제작 무료, 가공 그림 배포 가능, 무가공 재배포·가공품 판매 금지 — 저장소·번들에 원본을 넣지 않는다.

import type { MvPackAutotile, MvPackObject, MvPackPreset } from "../packPreset";

const A1 = "A1_REFMAP_Town_Outside.png";
const A2 = "A2_REFMAP_Town_Outside.png";
const A3 = "A3_REFMAP_Town_Outside.png";
const A4 = "A4_REFMAP_Town_Outside.png";
const B = "B_REFMAP_Town_Outside.png";
const C = "C_REFMAP_Town_Outside.png";
const D2 = "D2_REFMAP_Town_Outside.png";

type Row = readonly [kind: number, name: string, role: MvPackAutotile["role"], description?: string];
const autos = (sheet: string, rows: readonly Row[]): MvPackAutotile[] =>
  rows.map(([kind, name, role, description]) => ({ sheet, kind, name, role, ...(description ? { description } : {}) }));

const AUTOTILES: MvPackAutotile[] = [
  ...autos(A1, [
    [0, "연못 물(풀 둑)", "water", "마을 연못·개울. 둘레가 풀 둑이다"],
    [2, "물가 키 큰 풀", "plant", "물 위·물가에 겹치는 풀"],
    [4, "짙은 돌바닥 물", "water", "수로·깊은 물"],
    [9, "폭포", "water", "절벽 벽 줄에 세로로 건다"],
  ]),
  ...autos(A2, [
    [0, "풀밭", "ground", "기본 바닥"],
    [1, "짙은 풀밭", "ground", "숲 가장자리·그늘"],
    [2, "밝은 얼룩 풀밭", "ground"],
    [3, "흙길", "ground", "풀밭 위 마을 길"],
    [4, "흰 디딤돌", "mark", "길 위에 겹치는 돌 징검다리"],
    [5, "흙 얼룩", "mark"],
    [6, "키 큰 풀", "plant"],
    [7, "나무 울타리", "fence", "1칸 두께 선으로 깐다"],
    [8, "흙바닥", "ground"],
    [12, "잎 덤불", "plant"],
    [15, "침엽 생울타리", "fence"],
    [20, "돌판 바닥", "ground", "광장"],
    [21, "돌벽돌 바닥", "ground"],
  ]),
  ...autos(A3, [
    [0, "붉은 비늘 지붕", "roof"],
    [1, "초록 비늘 지붕", "roof"],
    [2, "밝은 판자 벽", "wall"],
    [8, "흰 회벽", "wall"],
    [9, "흰 회벽(띠)", "wall"],
    [10, "짙은 판자 벽", "wall"],
    [11, "짙은 판자 벽(띠)", "wall"],
  ]),
  ...autos(A4, [
    [2, "풀 언덕 윗면", "ground", "절벽 위 풀밭. 아래 줄에 바위 절벽 벽을 댄다"],
    [10, "바위 절벽 벽", "wall", "풀 언덕 윗면 바로 아래 1~2줄"],
    [4, "흙 언덕 윗면", "ground"],
    [12, "흙 절벽 벽", "wall"],
    [16, "흰 벽돌 윗면", "roof"],
    [17, "숲 수관", "roof", "빽빽한 숲 윗면. 아래 줄에 숲 줄기 벽을 댄다"],
    [25, "숲 줄기 벽", "wall", "숲 수관 바로 아래 1~2줄"],
    [24, "벽돌 벽", "wall"],
  ]),
];

type O = readonly [id: string, sheet: string, x: number, y: number, w: number, h: number, kind: MvPackObject["kind"], name: string, extra?: Partial<MvPackObject>];

const OBJECTS: MvPackObject[] = ([
  // ── 들판 (B) ──
  ["flowers", B, 5, 0, 1, 1, "decal", "들꽃"],
  ["pebbles", B, 6, 0, 1, 1, "decal", "작은 돌"],
  ["pebbles_b", B, 7, 0, 1, 1, "decal", "작은 돌 무더기"],
  ["broadleaf_tree", B, 0, 4, 3, 3, "tall", "큰 활엽수", { description: "3×3. 맨 아랫줄 가운데 줄기만 막힌다", solid: [[1, 2]] }],
  ["small_conifer", B, 4, 4, 1, 2, "tall", "작은 침엽수"],
  ["dead_tree", B, 5, 4, 2, 2, "tall", "마른 나무"],
  ["dry_grass", B, 7, 5, 1, 1, "decal", "마른 풀"],
  ["rock", B, 7, 3, 1, 1, "prop", "바위"],
  ["stone_steps", B, 14, 2, 1, 3, "decal", "돌계단(절벽)", { description: "절벽 벽 줄을 가로질러 윗면과 아랫면을 잇는다" }],
  ["cave_entrance", B, 15, 3, 1, 1, "door", "동굴 입구"],
  ["plank_bridge_v", B, 15, 13, 1, 2, "decal", "나무 다리(세로)", { growth: "vertical" }],
  ["plank_bridge_h", B, 13, 15, 3, 1, "decal", "나무 다리(가로)", { growth: "horizontal" }],
  // ── 마을 소품 (C) ──
  ["signboard", C, 3, 0, 1, 1, "prop", "나무 표지판"],
  ["stump", C, 0, 1, 1, 1, "prop", "그루터기"],
  ["pink_flowers", C, 1, 1, 1, 1, "decal", "분홍 꽃"],
  ["blue_flowers", C, 2, 1, 1, 1, "decal", "파란 꽃"],
  ["mailbox", C, 3, 1, 1, 1, "prop", "우편함"],
  ["woodpile", C, 4, 0, 1, 1, "prop", "장작"],
  ["pail", C, 5, 0, 1, 1, "prop", "양동이"],
  ["barrel", C, 4, 1, 1, 1, "prop", "나무통"],
  ["crate", C, 5, 1, 1, 1, "prop", "나무 상자"],
  ["well", C, 6, 0, 2, 2, "tall", "돌 우물", { description: "광장 한가운데·마을 어귀" }],
  ["big_tree", C, 0, 2, 4, 5, "tall", "큰 둥근 나무", { description: "4×5. 아랫줄 가운데 두 칸이 줄기", solid: [[1, 4], [2, 4]] }],
  ["bush", C, 0, 7, 2, 1, "prop", "덤불"],
  ["tubs", C, 2, 7, 3, 1, "prop", "나무 통 줄"],
  ["window", C, 0, 8, 1, 1, "wallmount", "창문"],
  ["flower_box", C, 1, 8, 1, 2, "wallmount", "창가 꽃상자"],
  ["dark_doorway", C, 2, 8, 2, 2, "door", "어두운 출입구(2칸)"],
  ["laundry_line", C, 5, 7, 3, 3, "tall", "빨랫줄"],
  ["door", C, 0, 10, 1, 2, "door", "나무 문", { description: "벽 맨 아래 줄에서 위로 2칸" }],
  ["sign_inn", C, 0, 12, 1, 1, "wallmount", "여관 간판"],
  ["sign_bar", C, 1, 12, 1, 1, "wallmount", "술집 간판"],
  ["sign_item", C, 0, 13, 1, 1, "wallmount", "도구점 간판"],
  ["stairs", C, 2, 12, 1, 2, "decal", "나무 계단"],
  ["chimney", C, 5, 11, 1, 2, "wallmount", "굴뚝", { description: "지붕 윗줄에 단다" }],
  ["wooden_deck", C, 8, 14, 4, 2, "decal", "나무 마루", { growth: "horizontal" }],
  // ── 장터 (D2) ──
  ["market_stall", D2, 4, 0, 4, 2, "tall", "채소 가판대"],
  ["stall_awning", D2, 0, 1, 4, 2, "overhead", "가판 차양"],
  ["crate_stack", D2, 1, 7, 2, 2, "prop", "상자 더미"],
  ["stained_glass", D2, 8, 0, 1, 2, "wallmount", "스테인드글라스 창"],
  ["forest_trunks", D2, 8, 10, 5, 2, "tall", "숲 줄기 띠", { growth: "horizontal", description: "숲 수관 아래 가장자리" }],
  ["bush_cluster", D2, 8, 12, 4, 4, "tall", "큰 덤불 더미"],
] satisfies O[]).map(([id, sheet, x, y, w, h, kind, name, extra]) => ({ id, sheet, x, y, w, h, kind, name, ...extra }));

const GUIDE = `# REFMAP 마을 외관 조립법

작가(REFMAP)의 판타지 마을 외관 팩. 칸 48px. 바닥은 A2 풀밭, 길은 흙길, 집은 A3 지붕 + 벽.

## 1. 바닥
- 전체를 \`"풀밭"\` 으로 깔고 숲 쪽·그늘에 \`"짙은 풀밭"\` 덩이를 섞는다.
- 길은 \`"흙길"\` 2~3칸 폭. 집 문 앞에서 큰길로 잇는다. 광장은 \`"돌판 바닥"\`.
- 높낮이: \`"풀 언덕 윗면"\` 아래에 \`"바위 절벽 벽"\` 1~2줄. 계단은 \`stone_steps\`.
- 숲: \`"숲 수관"\` 덩이 아래 가장자리에 \`"숲 줄기 벽"\` 1~2줄.
- 물: \`"연못 물(풀 둑)"\`. 절벽을 지나는 물줄기는 벽 줄에 \`"폭포"\`. 건너는 곳은 \`plank_bridge_h\`·\`plank_bridge_v\`.

## 2. 집
- 지붕(\`"붉은 비늘 지붕"\`·\`"초록 비늘 지붕"\`) 2~3줄 + 벽(\`"흰 회벽"\`·\`"밝은 판자 벽"\`·\`"짙은 판자 벽"\`) 2줄. 집마다 색을 바꾼다.
- 문(\`door\`)은 벽 맨 아래 줄, 옆에 \`window\`·\`flower_box\`. 여관·술집·도구점은 문 위 벽에 간판.
- 굴뚝(\`chimney\`)은 지붕에 0~1개.

## 3. 물체
- 나무는 \`big_tree\`·\`broadleaf_tree\`·\`small_conifer\` 를 섞어 마을 둘레에 덩이로.
- 집 곁에 \`barrel\`·\`crate\`·\`woodpile\`·\`laundry_line\` 을 집마다 다르게 1~3개.
- 광장에 \`well\` 하나, 장터에 \`market_stall\`·\`crate_stack\`.
- 들꽃·작은 돌은 풀밭 빈 곳에 드문드문.
`;

export const REFMAP_TOWN_OUTSIDE: MvPackPreset = {
  id: "refmap-town-outside",
  version: 1,
  name: "REFMAP · 마을 외관",
  pack: "REFMAP Town Outside",
  author: "REFMAP (unegoro-looseleaf)",
  url: "https://refmap-l.blog.jp/",
  credit: "Tileset: REFMAP (https://refmap-l.blog.jp/, @refmap_fsm)",
  license: "게임 제작에 무료. 가공한 그림은 배포 가능, 무가공 재배포·가공품 판매 금지. 작가 @refmap_fsm 의 규약을 따른다.",
  sheets: [
    { file: A1, folder: "refmap-town-outside", sha256: "7c0d05c6bb1f798fdc48861f7fddb370e8aca5fb2dda646e4261cf134544b1d3" },
    { file: A2, folder: "refmap-town-outside", sha256: "618894da9f1490fac444d25376106cf4c1dcc0fca363b9f81e318e2d2fbec5b5" },
    { file: A3, folder: "refmap-town-outside", sha256: "72385bc37fe3822cfc16eb0e62b3fa5a1acd37eccff5292a7416c4deededed23" },
    { file: A4, folder: "refmap-town-outside", sha256: "1daeef1c919dccfce0431679ea7b77fa908fa3587404ed995522177ca4f51419" },
    { file: B, folder: "refmap-town-outside", sha256: "ff7542a5b6c340d3cd2baaa0fa655bbd870bbfc9a4bf46bb8e31cf120b1475e1" },
    { file: C, folder: "refmap-town-outside", sha256: "916fb2ebe87a4354ffdc5e1f72f00beff76bc75b683e35fc85a98bfe76c1ea3a" },
    { file: D2, folder: "refmap-town-outside", sha256: "8bfc8dcc87646d7495bbde6918e6c30b378e682d6c00c81b64deb46d3c4151da" },
  ],
  autotiles: AUTOTILES,
  flats: [],
  objects: OBJECTS,
  guide: GUIDE,
};
