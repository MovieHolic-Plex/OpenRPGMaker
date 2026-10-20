// 일본 시골(이나카 여름방학, jp-inaka) 칩셋 카탈로그 및 6대 쇼케이스 장면 조립기.
// R5: 바닥은 이나카 전용 8방 오토타일(시골 풀밭·시골 흙길·시골 개울·시골 물논·시골 여름 논·시골 황금 논)을 fill_region 으로 깐다.
//   풀밭은 가장자리를 그리지 않고, 흙길·개울·논이 자기 칸 안에 풀 테·흙 둑·논두렁을 그린다(맵 밖은 이어진 것으로 본다).
//   jp_city 오토타일(자갈 참배길·생활도로·보도 연석·수로)은 신사 참배길·역 앞·찻길에만 그대로 재사용한다.
// 생울타리·블록담은 jp_city 선(4방향) 오토타일로 긋고, 전봇대(jp-pole-wood)와 전선(jp-wire-N)은 town.mjs 와 같은 규칙으로 4층에 잇는다.

export interface InakaGroundTileSpec {
  readonly id: string;
  readonly groupId: string;
  readonly ko: string;
  readonly passable: boolean;
  readonly surface: "land" | "water" | "paddy";
}

export interface InakaKitSpec {
  readonly id: string;
  readonly jpId: string;
  readonly ko: string;
  readonly w: number;
  readonly h: number;
  readonly allowWet: boolean;
}

export interface InakaRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 바닥 면 채우기. material 은 jp_city fill_region 재료 라벨(잔디·수로…) 또는 inaka-* 단일 타일 그룹 이름. */
export interface InakaGroundFillOp extends InakaRect {
  readonly material: string;
}

/** 2층(upper) 선 오토타일: 생울타리·블록담·철망 울타리. 1칸 폭 직선(가로 또는 세로). */
export interface InakaLineOp extends InakaRect {
  readonly material: "생울타리" | "블록담" | "철망 울타리";
}

/** 전봇대 줄: 발(맨 아래 칸) 행 footY 에 xs 열마다 전봇대를 세우고 이웃 기둥 사이를 jp-wire-<간격> 으로 잇는다(4층). */
export interface InakaPoleRowOp {
  readonly footY: number;
  readonly xs: readonly number[];
  readonly kit?: "jp-pole-wood" | "jp-pole";
}

export interface InakaStampOp {
  readonly kit: string;
  readonly x: number;
  readonly y: number;
  readonly allowWet?: boolean;
  readonly allowOverlap?: boolean;
  readonly layer?: 2 | 3 | 4;
}

export interface InakaShowcaseScene {
  readonly id: string;
  readonly no: 1 | 2 | 3 | 4 | 5 | 6;
  readonly fileName: string;
  readonly titleKo: string;
  readonly subtitleJa: string;
  readonly descriptionKo: string;
  readonly width: number;
  readonly height: number;
  readonly baseGround: string;
  readonly fills: readonly InakaGroundFillOp[];
  readonly lines?: readonly InakaLineOp[];
  readonly stamps: readonly InakaStampOp[];
  readonly poleRows?: readonly InakaPoleRowOp[];
}

export interface InakaComposeStep {
  readonly tool: "fill_region" | "paint_line" | "stamp_object";
  readonly args: Readonly<Record<string, unknown>>;
  readonly note: string;
}

export interface InakaComposePlan {
  readonly sceneId: string;
  readonly steps: readonly InakaComposeStep[];
  readonly stampedCount: number;
  readonly skippedStamps: readonly string[];
}

/** 키트 크기와 2층 그림이 있는 칸(행 우선 w*h). opaque 가 없으면 사각형 전체를 찬 것으로 본다. */
export interface InakaKitShape {
  readonly w: number;
  readonly h: number;
  readonly opaque?: readonly boolean[];
}

export const INAKA_GROUND_TILES: readonly InakaGroundTileSpec[] = [
  { id: "inaka-paddy-water", groupId: "jp:inaka-paddy-water", ko: "논(모내기 물논)", passable: false, surface: "paddy" },
  { id: "inaka-paddy-summer", groupId: "jp:inaka-paddy-summer", ko: "논(푸른 여름 벼)", passable: false, surface: "paddy" },
  { id: "inaka-paddy-golden", groupId: "jp:inaka-paddy-golden", ko: "논(황금 가을 벼)", passable: false, surface: "paddy" },
  { id: "inaka-aze-path", groupId: "jp:inaka-aze-path", ko: "논두렁·시골 흙길", passable: true, surface: "land" },
  { id: "inaka-canal-water", groupId: "jp:inaka-canal-water", ko: "농수로 물", passable: false, surface: "water" },
  { id: "inaka-canal-wall", groupId: "jp:inaka-canal-wall", ko: "농수로 콘크리트·석축 벽", passable: false, surface: "water" },
  { id: "inaka-gravel-road", groupId: "jp:inaka-gravel-road", ko: "시골 자갈 신작로", passable: true, surface: "land" },
  { id: "inaka-river-shallow", groupId: "jp:inaka-river-shallow", ko: "시골 맑은 개울", passable: false, surface: "water" },
  { id: "inaka-meadow-wildflower", groupId: "jp:inaka-meadow-wildflower", ko: "여름 풀밭", passable: true, surface: "land" },
] as const;

export const INAKA_KITS: readonly InakaKitSpec[] = [
  { id: "inaka-kominka-thatched", jpId: "jp-inaka-kominka-thatched", ko: "초가 고민가(茅葺き古民家)", w: 6, h: 6, allowWet: false },
  { id: "inaka-kawara-farmhouse", jpId: "jp-inaka-kawara-farmhouse", ko: "시골 기와 농가", w: 6, h: 5, allowWet: false },
  { id: "inaka-kura-storehouse", jpId: "jp-inaka-kura-storehouse", ko: "시골 토장 창고(土蔵)", w: 4, h: 5, allowWet: false },
  { id: "inaka-dagashiya", jpId: "jp-inaka-dagashiya", ko: "시골 막과자 가게(駄菓子屋)", w: 5, h: 6, allowWet: false },
  { id: "inaka-bus-stop-shelter", jpId: "jp-inaka-bus-stop-shelter", ko: "시골 버스 정류장", w: 3, h: 4, allowWet: false },
  { id: "inaka-unmanned-veg-stand", jpId: "jp-inaka-unmanned-veg-stand", ko: "무인 채소 판매대", w: 2, h: 3, allowWet: false },
  { id: "inaka-wooden-station", jpId: "jp-inaka-wooden-station", ko: "시골 목조 간이역", w: 7, h: 6, allowWet: false },
  { id: "inaka-single-car-train", jpId: "jp-inaka-single-car-train", ko: "단량 디젤 동차(キハ40 국철색 8×3)", w: 8, h: 3, allowWet: false },
  { id: "inaka-red-iron-bridge", jpId: "jp-inaka-red-iron-bridge", ko: "시골 붉은 철교", w: 6, h: 3, allowWet: true },
  { id: "inaka-stepping-stones", jpId: "jp-inaka-stepping-stones", ko: "개울 징검다리", w: 4, h: 2, allowWet: true },
  { id: "inaka-fire-watchtower", jpId: "jp-inaka-fire-watchtower", ko: "시골 소방 망루(火の見櫓)", w: 2, h: 4, allowWet: false },
  { id: "inaka-keitora-white", jpId: "jp-inaka-keitora-white", ko: "시골 흰 경트럭(軽トラ 4×3)", w: 4, h: 3, allowWet: false },
  { id: "inaka-red-tractor", jpId: "jp-inaka-red-tractor", ko: "붉은 농기계 트랙터(4×4)", w: 4, h: 4, allowWet: false },
  { id: "inaka-agri-tin-shed", jpId: "jp-inaka-agri-tin-shed", ko: "함석 농기구 헛간", w: 4, h: 5, allowWet: false },
  { id: "inaka-vinyl-greenhouse", jpId: "jp-inaka-vinyl-greenhouse", ko: "비닐하우스(남북으로 긴 터널 4×7)", w: 4, h: 7, allowWet: false },
  { id: "inaka-sunflower-patch", jpId: "jp-inaka-sunflower-patch", ko: "여름 해바라기 군락", w: 3, h: 2, allowWet: false },
  { id: "inaka-hydrangea-hedge", jpId: "jp-inaka-hydrangea-hedge", ko: "수국 꽃덤불", w: 3, h: 2, allowWet: false },
  { id: "inaka-jizo-shrine-row", jpId: "jp-inaka-jizo-shrine-row", ko: "길가 지장보살 사당(3기)", w: 3, h: 3, allowWet: false },
  { id: "inaka-wooden-pole-transformer", jpId: "jp-inaka-wooden-pole-transformer", ko: "시골 나무 전봇대", w: 1, h: 3, allowWet: false },
  { id: "inaka-retro-postbox-vending", jpId: "jp-inaka-retro-postbox-vending", ko: "둥근 붉은 우체통과 자판기", w: 2, h: 2, allowWet: false },
  { id: "inaka-waterwheel-mill", jpId: "jp-inaka-waterwheel-mill", ko: "시골 물레방아간", w: 4, h: 4, allowWet: true },
  { id: "inaka-sluice-gate", jpId: "jp-inaka-sluice-gate", ko: "농수로 철제 수문", w: 2, h: 2, allowWet: true },
  { id: "inaka-rice-rack-hasagi", jpId: "jp-inaka-rice-rack-hasagi", ko: "하사기 볏단 건조대(稲架)", w: 3, h: 2, allowWet: true },
  { id: "inaka-scarecrow-pair", jpId: "jp-inaka-scarecrow-pair", ko: "논두렁 허수아비 한 쌍", w: 2, h: 2, allowWet: true },
  { id: "inaka-bamboo-fence-gate", jpId: "jp-inaka-bamboo-fence-gate", ko: "타케가키 죽담과 사립문", w: 4, h: 2, allowWet: false },
  { id: "inaka-mossy-stone-wall", jpId: "jp-inaka-mossy-stone-wall", ko: "이끼 낀 시골 돌담", w: 4, h: 2, allowWet: false },
  { id: "inaka-mossy-stone-wall-mid", jpId: "jp-inaka-mossy-stone-wall-mid", ko: "이끼 낀 시골 돌담(이음 토막)", w: 4, h: 2, allowWet: false },
  { id: "inaka-roadside-mirror", jpId: "jp-inaka-roadside-mirror", ko: "커브길 볼록거울", w: 1, h: 2, allowWet: false },
  { id: "inaka-bicycle-parked", jpId: "jp-inaka-bicycle-parked", ko: "세워둔 시골 자전거", w: 2, h: 2, allowWet: false },
  { id: "inaka-well-handpump", jpId: "jp-inaka-well-handpump", ko: "작두 우물 펌프", w: 2, h: 2, allowWet: false },
  { id: "inaka-hillside-torii-stairs", jpId: "jp-inaka-hillside-torii-stairs", ko: "언덕 삼나무 돌계단과 도리이", w: 4, h: 5, allowWet: false },
] as const;

// 쇼케이스 장면에서 그대로 재사용하는 기존 jp_city 키트(새로 그리지 않는다).
export const INAKA_REUSED_JP_CITY_KITS: readonly string[] = [
  "jp-bldg-station-small", "jp-bldg-shop-dagashi", "jp-bldg-house-hiraya-gable", "jp-bldg-house-hiraya", "jp-bldg-house-machiya",
  "jp-bldg-shrine-haiden", "jp-bldg-post-office", "jp-bldg-koban", "jp-bldg-shop-greengrocer",
  "jp-train-car-a", "jp-train-car-b", "jp-rail-h", "jp-rail-xing", "jp-rail-xing-bars", "jp-rail-verge", "jp-rail-wire",
  "jp-platform-edge", "jp-prop-catenary-pole", "jp-prop-bus", "jp-prop-car-white", "jp-lot-veg", "jp-pole-wood", "jp-wire-*",
  "jp-prop-tree-sakura", "jp-prop-tree-zelkova", "jp-prop-tree-ginkgo", "jp-prop-stone-lantern", "jp-prop-chozuya", "jp-torii",
  "jp-hokora-jizo", "jp-pots", "jp-rg-sugi", "jp-rg-pine", "jp-rg-maple", "jp-rg-bamboo-grove", "jp-rg-bamboo-grove-b", "jp-rg-bamboo-clump", "jp-rg-sunflower", "jp-rg-ishigaki",
  "jp-rg-hazakake", "jp-rg-kakashi", "jp-rg-doshirube", "jp-rg-moss-buddha", "jp-rg-fishing-boat", "jp-rg-mujin-eki",
] as const;

const WET_MATERIALS: Readonly<Record<string, true>> = {
  "시골 물논": true,
  "시골 여름 논": true,
  "시골 황금 논": true,
  "시골 개울": true,
  "inaka-paddy-water": true,
  "inaka-paddy-summer": true,
  "inaka-paddy-golden": true,
  "inaka-canal-water": true,
  "inaka-canal-wall": true,
  "inaka-river-shallow": true,
  "논(물 댄 모)": true,
  "바다": true,
  "수로": true,
  "연못": true,
};

/** 전봇대 키트 높이를 모를 때 쓰는 jp_city 콘크리트 전봇대(jp-pole, 10칸) 높이. 전선 키트 윗줄(애자 행)은 전봇대 키트 맨 윗칸에 맞춘다. */
const FALLBACK_POLE_HEIGHT = 10;

export function inakaKitId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("jp-")) return trimmed;
  return `jp-${trimmed}`;
}

export function paintInakaGround(
  map: { readonly width: number; readonly height: number; readonly lowerTiles: number[] },
  tileset: { readonly tileGroups?: readonly { readonly id: string; readonly name: string; readonly tileIds: readonly number[] }[] },
  rect: InakaRect,
  material: string,
): boolean {
  const norm = material.startsWith("inaka-ground-") ? `inaka-${material.slice("inaka-ground-".length)}` : material;
  const group = (tileset.tileGroups ?? []).find(
    (g) => (g.id.startsWith("jp:region-") || g.id.startsWith("jp:inaka-")) && (g.name === norm || g.id === `jp:${norm}`) && g.tileIds.length === 1,
  );
  const tileId = group?.tileIds[0];
  if (tileId === undefined) return false;
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(map.width, rect.x + rect.w);
  const y1 = Math.min(map.height, rect.y + rect.h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      map.lowerTiles[y * map.width + x] = tileId;
    }
  }
  return true;
}

const W40 = 40;
const H26 = 26;

export const INAKA_SHOWCASE_SCENES: readonly InakaShowcaseScene[] = [
  {
    id: "01-kominka-summer-village",
    no: 1,
    fileName: "01-kominka-summer-village.png",
    titleKo: "01. 여름방학 초가 고민가와 기와 농가 마을",
    subtitleJa: "茅葺き古民家と瓦農家の夏休み集落",
    descriptionKo:
      "대숲·삼나무 뒷산 아래 자갈 마당을 낀 초가 고민가·토장 창고와 기와 농가·단층 박공집, 죽담 사립문과 이끼 돌담·생울타리로 두른 집터, 흙길을 따라 이어진 나무 전봇대와 전선, 농수로와 여름 논, 텃밭·해바라기·무인 판매대와 町家.",
    width: W40,
    height: H26,
    baseGround: "시골 풀밭",
    fills: [
      { x: 0, y: 14, w: 40, h: 2, material: "시골 흙길" },
      { x: 18, y: 6, w: 3, h: 8, material: "시골 흙길" },
      { x: 12, y: 16, w: 2, h: 10, material: "시골 흙길" },
      { x: 1, y: 9, w: 15, h: 4, material: "시골 흙길" },
      { x: 21, y: 9, w: 17, h: 4, material: "시골 흙길" },
      { x: 0, y: 17, w: 12, h: 2, material: "수로" },
      { x: 0, y: 20, w: 12, h: 6, material: "시골 흙길" },
      { x: 1, y: 21, w: 10, h: 4, material: "시골 여름 논" },
      { x: 30, y: 24, w: 10, h: 2, material: "시골 흙길" },
    ],
    lines: [
      { x: 1, y: 13, w: 6, h: 1, material: "생울타리" },
      { x: 11, y: 13, w: 5, h: 1, material: "생울타리" },
      { x: 33, y: 13, w: 6, h: 1, material: "생울타리" },
    ],
    stamps: [
      // 뒷산 숲(집보다 먼저 찍어 지붕이 숲 앞에 서게 한다)
      { kit: "rg-bamboo-grove", x: 0, y: 0, allowOverlap: true },
      { kit: "rg-sugi", x: 4, y: -3, allowOverlap: true }, // 고민가 용마루(y3) 위로 한 칸 이상 띄운다
      { kit: "rg-sugi", x: 12, y: 0, allowOverlap: true },
      { kit: "rg-bamboo-grove-b", x: 15, y: 0, allowOverlap: true },
      { kit: "rg-sugi", x: 21, y: 0, allowOverlap: true },
      { kit: "rg-bamboo-grove", x: 26, y: 0, allowOverlap: true },
      { kit: "rg-sugi", x: 31, y: 0, allowOverlap: true },
      { kit: "rg-bamboo-clump", x: 37, y: 2, allowOverlap: true },
      // 서쪽 집터: 초가 고민가 + 토장 창고 + 우물 + 경트럭, 죽담 사립문
      { kit: "inaka-kominka-thatched", x: 2, y: 3, allowOverlap: true },
      { kit: "inaka-kura-storehouse", x: 9, y: 4, allowOverlap: true },
      { kit: "inaka-well-handpump", x: 13, y: 9 },
      { kit: "inaka-keitora-white", x: 2, y: 9 },
      { kit: "jp-pots", x: 9, y: 9 },
      { kit: "inaka-bamboo-fence-gate", x: 7, y: 12 },
      { kit: "rg-doshirube", x: 21, y: 7 },
      // 동쪽 집터: 기와 농가 + 단층 박공집, 이끼 돌담
      { kit: "inaka-kawara-farmhouse", x: 22, y: 4, allowOverlap: true },
      { kit: "jp-bldg-house-hiraya-gable", x: 29, y: 4, allowOverlap: true },
      { kit: "inaka-bicycle-parked", x: 31, y: 8, allowOverlap: true }, // 전봇대(28..30열) 기둥 뒤에 숨지 않게
      { kit: "inaka-hydrangea-hedge", x: 34, y: 9 },
      { kit: "inaka-mossy-stone-wall", x: 21, y: 12 },
      { kit: "inaka-mossy-stone-wall-mid", x: 25, y: 12 },
      // 남쪽: 논·농수로·텃밭·町家
      { kit: "rg-kakashi", x: 4, y: 21, allowWet: true },
      { kit: "rg-kakashi", x: 8, y: 22, allowWet: true },
      { kit: "inaka-unmanned-veg-stand", x: 14, y: 15, allowOverlap: true },
      { kit: "jp-lot-veg", x: 15, y: 19 },
      { kit: "jp-lot-veg", x: 15, y: 22 },
      { kit: "jp-rg-sunflower", x: 20, y: 19 },
      { kit: "inaka-sunflower-patch", x: 20, y: 22 },
      { kit: "jp-prop-tree-zelkova", x: 24, y: 17 },
      { kit: "jp-bldg-house-machiya", x: 31, y: 16, allowOverlap: true },
      { kit: "jp-prop-tree-sakura", x: 27, y: 19, allowOverlap: true },
    ],
    poleRows: [{ footY: 16, xs: [1, 15, 28], kit: "jp-pole-wood" }],
  },
  {
    id: "02-dagashiya-and-bus-stop",
    no: 2,
    fileName: "02-dagashiya-and-bus-stop.png",
    titleKo: "02. 시골 삼거리 막과자 가게(다가시야)와 버스 정류장",
    subtitleJa: "三叉路の駄菓子屋と郵便局・交番・バス停",
    descriptionKo:
      "생활도로 삼거리 북쪽에 늘어선 駄菓子屋 두 채와 우체국·파출소, 정류장에 막 들어선 노선버스와 시골 버스 대합실, 볼록거울·둥근 우체통·자전거, 전봇대 전선, 남쪽 논두렁 너머 물논과 푸른 여름 논.",
    width: W40,
    height: H26,
    baseGround: "시골 풀밭",
    fills: [
      { x: 0, y: 12, w: 40, h: 4, material: "생활도로" },
      { x: 18, y: 0, w: 4, h: 12, material: "생활도로" },
      { x: 0, y: 11, w: 18, h: 1, material: "보도 연석" },
      { x: 22, y: 11, w: 18, h: 1, material: "보도 연석" },
      { x: 19, y: 16, w: 2, h: 10, material: "시골 흙길" },
      { x: 0, y: 19, w: 19, h: 7, material: "시골 흙길" },
      { x: 21, y: 19, w: 19, h: 7, material: "시골 흙길" },
      { x: 1, y: 20, w: 17, h: 5, material: "시골 여름 논" },
      { x: 22, y: 20, w: 17, h: 5, material: "시골 물논" },
    ],
    lines: [{ x: 22, y: 18, w: 18, h: 1, material: "생울타리" }],
    stamps: [
      { kit: "rg-sugi", x: 8, y: -1, allowOverlap: true },
      { kit: "jp-prop-tree-zelkova", x: 12, y: -1, allowOverlap: true },
      { kit: "rg-sugi", x: 32, y: -2, allowOverlap: true },
      { kit: "jp-bldg-shop-dagashi", x: 1, y: 2, allowOverlap: true },
      { kit: "inaka-dagashiya", x: 9, y: 5, allowOverlap: true },
      { kit: "inaka-retro-postbox-vending", x: 14, y: 9 },
      { kit: "inaka-bicycle-parked", x: 16, y: 8 },
      { kit: "jp-bldg-post-office", x: 23, y: 3, allowOverlap: true },
      { kit: "jp-bldg-koban", x: 33, y: 5, allowOverlap: true },
      { kit: "jp-prop-bus", x: 2, y: 12 },
      { kit: "inaka-keitora-white", x: 30, y: 12 },
      { kit: "inaka-bus-stop-shelter", x: 6, y: 15, allowOverlap: true },
      { kit: "inaka-hydrangea-hedge", x: 10, y: 16 },
      { kit: "inaka-unmanned-veg-stand", x: 14, y: 15, allowOverlap: true },
      { kit: "inaka-roadside-mirror", x: 22, y: 16 },
      { kit: "jp-prop-tree-sakura", x: 24, y: 13, allowOverlap: true },
      { kit: "inaka-sunflower-patch", x: 34, y: 16 },
      { kit: "rg-kakashi", x: 8, y: 21, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 29, y: 21, allowWet: true },
    ],
    poleRows: [{ footY: 18, xs: [0, 12, 27, 36], kit: "jp-pole-wood" }],
  },
  {
    id: "03-wayside-station-and-railcar",
    no: 3,
    fileName: "03-wayside-station-and-railcar.png",
    titleKo: "03. 목조 간이역·단량 키하 디젤 동차와 시골 역 통근 전철",
    subtitleJa: "木造駅舎のキハ40気動車とさくら駅のローカル電車",
    descriptionKo:
      "서쪽 시골 목조 간이역(木造駅舎) 앞에 정차한 크림·주홍 국철색 단량 키하 40형 디젤 동차(8×3)와 동쪽 벚나무 さくら駅 앞에 선 2량 통근 전철(jp-train-car-a/b), 노란 점자 승강장·전차선·가선 기둥과 건널목, 선로 둔덕 아래 황금 논과 여름 논·트랙터·경트럭.",
    width: W40,
    height: H26,
    baseGround: "시골 풀밭",
    fills: [
      { x: 0, y: 1, w: 6, h: 6, material: "보도 연석" },
      { x: 6, y: 1, w: 12, h: 6, material: "자갈 참배길" },
      { x: 34, y: 0, w: 4, h: 9, material: "생활도로" },
      { x: 34, y: 13, w: 4, h: 13, material: "생활도로" },
      { x: 0, y: 16, w: 33, h: 10, material: "시골 흙길" },
      { x: 1, y: 17, w: 15, h: 8, material: "시골 황금 논" },
      // 여름 논은 x=17..27 까지만 — 동쪽 x=28..32 는 동서 흙길에 이어진 경트럭 주차 자리(경트럭은 동향 옆모습이라 남북 도로를 가로질러 세우지 않는다).
      { x: 17, y: 17, w: 11, h: 8, material: "시골 여름 논" },
    ],
    stamps: [
      { kit: "rg-sugi", x: 5, y: -2, allowOverlap: true },
      { kit: "jp-prop-tree-sakura", x: 14, y: -1, allowOverlap: true },
      { kit: "jp-prop-tree-sakura", x: 30, y: 0, allowOverlap: true },
      { kit: "inaka-bus-stop-shelter", x: 1, y: 0 },
      { kit: "jp-prop-car-white", x: 1, y: 4 },
      { kit: "inaka-wooden-station", x: 7, y: 1, allowOverlap: true },
      { kit: "inaka-retro-postbox-vending", x: 14, y: 5 },
      { kit: "jp-bldg-station-small", x: 18, y: 1, allowOverlap: true },
      { kit: "inaka-bicycle-parked", x: 16, y: 4, allowOverlap: true },
      { kit: "inaka-retro-postbox-vending", x: 38, y: 4 },
      ...Array.from({ length: 28 }, (_, i) => ({ kit: "jp-platform-edge", x: 6 + i, y: 7 })),
      ...Array.from({ length: 6 }, (_, i) => ({ kit: "jp-rail-verge", x: i, y: 7 })),
      ...Array.from({ length: 34 }, (_, i) => ({ kit: "jp-rail-h", x: i, y: 9 })),
      ...[34, 35, 36, 37].map((x) => ({ kit: "jp-rail-xing", x, y: 9 })),
      ...[38, 39].map((x) => ({ kit: "jp-rail-h", x, y: 9 })),
      { kit: "jp-rail-xing-bars", x: 34, y: 9, allowOverlap: true },
      { kit: "jp-rail-xing-bars", x: 37, y: 9, allowOverlap: true },
      ...Array.from({ length: 34 }, (_, i) => ({ kit: "jp-rail-verge", x: i, y: 13 })),
      ...[38, 39].map((x) => ({ kit: "jp-rail-verge", x, y: 13 })),
      // 서쪽: 목조 간이역 앞 단량 키하 40형 디젤 동차(8×3), 동쪽: さくら駅 앞 2량 통근 전철(8×3)
      { kit: "inaka-single-car-train", x: 6, y: 9, allowOverlap: true },
      { kit: "jp-train-car-a", x: 20, y: 9, allowOverlap: true },
      { kit: "jp-train-car-b", x: 24, y: 9, allowOverlap: true },
      ...[16, 20, 24, 28, 32].map((x) => ({ kit: "jp-rail-wire", x, y: 8, allowOverlap: true, layer: 4 as const })),
      ...[16, 24, 32].map((x) => ({ kit: "jp-prop-catenary-pole", x, y: 6, allowOverlap: true, layer: 4 as const })),
      { kit: "jp-rg-hazakake", x: 3, y: 17, allowWet: true },
      { kit: "inaka-rice-rack-hasagi", x: 9, y: 17, allowWet: true },
      { kit: "inaka-red-tractor", x: 12, y: 20, allowWet: true },
      { kit: "rg-kakashi", x: 22, y: 20, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 25, y: 20, allowWet: true },
      { kit: "inaka-keitora-white", x: 28, y: 18 },
    ],
  },
  {
    id: "04-terraced-paddies-and-waterwheel",
    no: 4,
    fileName: "04-terraced-paddies-and-waterwheel.png",
    titleKo: "04. 다랑논(棚田)과 물레방아간·농수로·수문",
    subtitleJa: "棚田と水車小屋・用水路の水門",
    descriptionKo:
      "이끼 돌담 축대로 층층이 쌓은 황금·물논·여름 다랑논(논마다 아래 가장자리에 흙 논두렁 한 줄, 그 아래 돌담), 다랑논 동쪽 끝을 따라 내려가는 흙 농로, 흙 고랑을 사이에 두고 두 줄로 선 남북으로 긴 비닐하우스 다섯 동, 동쪽 농수로에 걸친 물레방아간과 철제 수문, 함석 헛간·트랙터·경트럭, 아랫길의 볏단 걸이와 허수아비·소방 망루.",
    width: W40,
    height: H26,
    baseGround: "시골 풀밭",
    fills: [
      { x: 0, y: 0, w: 33, h: 21, material: "시골 흙길" },
      // 다랑논 3단(16칸 폭): 논 → 흙 논두렁 1줄 → 돌담 축대 2줄 → 아랫단 논. x=16..18 은 흙 농로, x=19..32 는 비닐하우스 밭(맨흙).
      { x: 0, y: 0, w: 16, h: 4, material: "시골 황금 논" },
      { x: 0, y: 7, w: 16, h: 4, material: "시골 물논" },
      { x: 0, y: 14, w: 16, h: 5, material: "시골 여름 논" },
      { x: 33, y: 0, w: 2, h: 26, material: "수로" },
      { x: 0, y: 21, w: 33, h: 2, material: "시골 흙길" },
      { x: 35, y: 9, w: 5, h: 17, material: "시골 흙길" },
    ],
    stamps: [
      { kit: "inaka-mossy-stone-wall", x: 0, y: 5 },
      { kit: "inaka-mossy-stone-wall-mid", x: 4, y: 5 },
      { kit: "inaka-mossy-stone-wall", x: 8, y: 5 },
      { kit: "inaka-mossy-stone-wall-mid", x: 12, y: 5 },
      { kit: "inaka-mossy-stone-wall-mid", x: 0, y: 12 },
      { kit: "inaka-mossy-stone-wall", x: 4, y: 12 },
      { kit: "inaka-mossy-stone-wall-mid", x: 8, y: 12 },
      { kit: "inaka-mossy-stone-wall", x: 12, y: 12 },
      { kit: "inaka-rice-rack-hasagi", x: 4, y: 0, allowWet: true },
      { kit: "jp-rg-hazakake", x: 10, y: 1, allowWet: true },
      { kit: "rg-kakashi", x: 6, y: 10, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 12, y: 15, allowWet: true },
      // 비닐하우스는 남북으로 긴 터널(4×7) — 흙 고랑 1칸을 사이에 두고 줄지어 세운다(윗줄 세 동, 아랫줄 두 동).
      { kit: "inaka-vinyl-greenhouse", x: 19, y: 0 },
      { kit: "inaka-vinyl-greenhouse", x: 24, y: 0 },
      { kit: "inaka-vinyl-greenhouse", x: 29, y: 0 },
      { kit: "inaka-vinyl-greenhouse", x: 19, y: 8 },
      { kit: "inaka-vinyl-greenhouse", x: 24, y: 8 },
      { kit: "inaka-agri-tin-shed", x: 35, y: 0 },
      { kit: "inaka-waterwheel-mill", x: 30, y: 8, allowWet: true },
      { kit: "inaka-red-tractor", x: 28, y: 14 },
      { kit: "inaka-sluice-gate", x: 33, y: 16, allowWet: true },
      { kit: "inaka-keitora-white", x: 23, y: 16 },
      { kit: "inaka-fire-watchtower", x: 38, y: 13 },
      { kit: "inaka-rice-rack-hasagi", x: 2, y: 23 },
      { kit: "jp-rg-hazakake", x: 7, y: 23 },
      { kit: "jp-rg-sunflower", x: 13, y: 23 },
      { kit: "jp-rg-kakashi", x: 17, y: 23 },
      { kit: "inaka-kura-storehouse", x: 20, y: 21, allowOverlap: true },
      { kit: "jp-rg-pine", x: 25, y: 21, allowOverlap: true },
    ],
    poleRows: [{ footY: 25, xs: [27, 36], kit: "jp-pole-wood" }],
  },
  {
    id: "05-river-stepping-stones-and-iron-bridge",
    no: 5,
    fileName: "05-river-stepping-stones-and-iron-bridge.png",
    titleKo: "05. 산골 개울의 붉은 철교와 징검다리",
    subtitleJa: "山あいの清流・赤い鉄橋と飛び石",
    descriptionKo:
      "돌 테 두른 개울이 한두 칸씩 굽이치며 흐르는 산골, 윗길을 잇는 붉은 철교와 아랫길 징검다리, 물가에 걸친 물레방아간, 강가의 초가 고민가·기와 농가·토장 창고, 단풍과 삼나무·대숲.",
    width: W40,
    height: H26,
    baseGround: "시골 풀밭",
    fills: [
      // 개울: 2줄마다 1칸씩 기슭이 비키는 4~7칸 폭 물길(큰 사각 웅덩이를 이어 붙인 계단 운하가 되지 않게).
      { x: 14, y: 0, w: 5, h: 2, material: "시골 개울" },
      { x: 15, y: 2, w: 5, h: 2, material: "시골 개울" },
      { x: 15, y: 4, w: 5, h: 2, material: "시골 개울" },
      { x: 15, y: 6, w: 4, h: 5, material: "시골 개울" },
      { x: 14, y: 11, w: 5, h: 2, material: "시골 개울" },
      { x: 12, y: 13, w: 7, h: 2, material: "시골 개울" },
      { x: 13, y: 15, w: 6, h: 2, material: "시골 개울" },
      { x: 14, y: 17, w: 5, h: 2, material: "시골 개울" },
      { x: 14, y: 19, w: 4, h: 3, material: "시골 개울" },
      // 징검다리 아래: 한 방향으로만 1칸씩 비키면 계단 운하가 되므로 좌우로 굽이친다. 띠는 2줄 이상(1줄 띠는 연못 테가 삼킨다).
      { x: 14, y: 22, w: 6, h: 2, material: "시골 개울" },
      { x: 15, y: 24, w: 6, h: 2, material: "시골 개울" },
      { x: 14, y: 26, w: 6, h: 2, material: "시골 개울" },
      { x: 0, y: 8, w: 14, h: 3, material: "생활도로" },
      { x: 20, y: 8, w: 20, h: 3, material: "생활도로" },
      { x: 3, y: 20, w: 11, h: 2, material: "시골 흙길" },
      { x: 18, y: 20, w: 12, h: 2, material: "시골 흙길" },
      { x: 1, y: 6, w: 13, h: 2, material: "시골 흙길" },
      { x: 23, y: 6, w: 15, h: 2, material: "시골 흙길" },
    ],
    stamps: [
      { kit: "rg-sugi", x: 9, y: -2, allowOverlap: true },
      { kit: "rg-maple", x: 20, y: -1, allowOverlap: true },
      { kit: "inaka-kominka-thatched", x: 1, y: 1, allowOverlap: true },
      { kit: "inaka-kura-storehouse", x: 8, y: 2, allowOverlap: true },
      { kit: "inaka-kawara-farmhouse", x: 24, y: 2, allowOverlap: true },
      { kit: "rg-bamboo-grove", x: 31, y: -2, allowOverlap: true },
      { kit: "jp-pots", x: 30, y: 6 },
      { kit: "inaka-red-iron-bridge", x: 14, y: 8, allowWet: true, allowOverlap: true },
      { kit: "inaka-keitora-white", x: 29, y: 8 },
      { kit: "inaka-waterwheel-mill", x: 9, y: 12, allowWet: true },
      { kit: "rg-maple", x: 2, y: 12, allowOverlap: true },
      { kit: "rg-sugi", x: 6, y: 14, allowOverlap: true },
      { kit: "rg-sugi", x: 22, y: 12, allowOverlap: true },
      { kit: "rg-maple", x: 26, y: 13, allowOverlap: true },
      { kit: "rg-bamboo-grove-b", x: 33, y: 11, allowOverlap: true },
      { kit: "inaka-stepping-stones", x: 14, y: 20, allowWet: true },
      { kit: "rg-doshirube", x: 4, y: 18 },
      { kit: "inaka-hydrangea-hedge", x: 7, y: 22 },
      { kit: "rg-moss-buddha", x: 24, y: 22 },
      { kit: "rg-pine", x: 1, y: 20, allowOverlap: true },
      { kit: "rg-sugi", x: 27, y: 19, allowOverlap: true },
      { kit: "rg-maple", x: 32, y: 21, allowOverlap: true },
      { kit: "rg-sugi", x: 36, y: 20, allowOverlap: true },
    ],
    poleRows: [{ footY: 11, xs: [1, 21, 35], kit: "jp-pole-wood" }],
  },
  {
    id: "06-hillside-shrine-and-jizo-pass",
    no: 6,
    fileName: "06-hillside-shrine-and-jizo-pass.png",
    titleKo: "06. 石垣 축대 위 언덕 신사와 지장보살 고갯길",
    subtitleJa: "石垣の上の鎮守の社とお地蔵様の峠道",
    descriptionKo:
      "石垣 축대 위 자갈 경내의 拝殿과 오미즈야·석등·도리이·토장 보물고, 가운데 이끼 돌계단 도리이로 오르는 참배길, 양옆 대숲과 삼나무 숲, 산기슭 고갯길의 지장보살 사당·이정표·이끼 석불·버스 대합실.",
    width: W40,
    height: H26,
    baseGround: "시골 풀밭",
    fills: [
      { x: 10, y: 0, w: 20, h: 11, material: "자갈 참배길" },
      { x: 18, y: 16, w: 4, h: 2, material: "자갈 참배길" },
      { x: 0, y: 18, w: 40, h: 3, material: "시골 흙길" },
    ],
    stamps: [
      // 양옆 진수의 숲: 발 행 순서로 찍고, 위아래로 이웃한 나무는 종류를 바꾸고 1~2칸 비켜 세로 기둥 줄이 생기지 않게 한다.
      { kit: "rg-bamboo-grove", x: 0, y: -2, allowOverlap: true },
      { kit: "rg-sugi", x: 4, y: -1, allowOverlap: true },
      { kit: "rg-sugi", x: 7, y: 1, allowOverlap: true },
      { kit: "rg-sugi", x: 1, y: 3, allowOverlap: true },
      { kit: "rg-bamboo-clump", x: 6, y: 7, allowOverlap: true },
      { kit: "rg-sugi", x: 7, y: 9, allowOverlap: true },
      { kit: "rg-bamboo-grove", x: 1, y: 10, allowOverlap: true },
      { kit: "rg-sugi", x: 4, y: 12, allowOverlap: true },
      { kit: "rg-bamboo-grove", x: 33, y: -2, allowOverlap: true },
      { kit: "rg-sugi", x: 30, y: -1, allowOverlap: true },
      { kit: "rg-sugi", x: 37, y: 0, allowOverlap: true },
      { kit: "rg-bamboo-grove", x: 31, y: 5, allowOverlap: true },
      { kit: "rg-sugi", x: 36, y: 6, allowOverlap: true },
      { kit: "rg-sugi", x: 37, y: 9, allowOverlap: true },
      { kit: "rg-sugi", x: 30, y: 10, allowOverlap: true },
      { kit: "rg-bamboo-grove-b", x: 34, y: 11, allowOverlap: true },
      // 경내
      { kit: "jp-bldg-shrine-haiden", x: 16, y: 1, allowOverlap: true },
      { kit: "jp-prop-chozuya", x: 10, y: 4, allowOverlap: true },
      { kit: "inaka-kura-storehouse", x: 25, y: 2, allowOverlap: true },
      { kit: "jp-torii", x: 18, y: 8 },
      { kit: "jp-prop-stone-lantern", x: 16, y: 8 },
      { kit: "jp-prop-stone-lantern", x: 23, y: 8 },
      { kit: "jp-hokora-jizo", x: 27, y: 8 },
      { kit: "jp-pots", x: 11, y: 9 },
      // 石垣 축대 + 가운데 돌계단 도리이
      { kit: "rg-ishigaki", x: 10, y: 11 },
      { kit: "inaka-hillside-torii-stairs", x: 18, y: 11 },
      { kit: "rg-ishigaki", x: 22, y: 11 },
      // 산기슭 고갯길
      { kit: "inaka-jizo-shrine-row", x: 3, y: 20 },
      { kit: "rg-doshirube", x: 7, y: 21 },
      { kit: "rg-moss-buddha", x: 9, y: 21 },
      { kit: "inaka-hydrangea-hedge", x: 13, y: 21 },
      { kit: "jp-prop-stone-lantern", x: 17, y: 16 },
      { kit: "jp-prop-stone-lantern", x: 22, y: 16 },
      { kit: "inaka-bus-stop-shelter", x: 28, y: 20 },
      { kit: "inaka-mossy-stone-wall", x: 32, y: 22 },
      { kit: "rg-maple", x: 22, y: 21, allowOverlap: true },
      { kit: "rg-sugi", x: 37, y: 20, allowOverlap: true },
    ],
    // 전봇대는 石垣 축대(11..14행) 앞을 가리지 않게 윗칸이 15행에 오도록 고갯길 남쪽 풀밭에 세운다.
    poleRows: [{ footY: 23, xs: [11, 25], kit: "jp-pole-wood" }],
  },
] as const;

export function planInakaShowcaseScene(input: {
  readonly scene: InakaShowcaseScene;
  readonly mapId: string;
  readonly kitSize: (kitId: string) => InakaKitShape | undefined;
}): InakaComposePlan {
  const { scene, mapId, kitSize } = input;
  const W = scene.width;
  const H = scene.height;
  const wet = new Uint8Array(W * H);
  const used3 = new Uint8Array(W * H);
  const used4 = new Uint8Array(W * H);
  const steps: InakaComposeStep[] = [];
  const skippedStamps: string[] = [];
  let stampedCount = 0;

  const clip = (r: InakaRect): InakaRect | null => {
    const x0 = Math.max(0, r.x);
    const y0 = Math.max(0, r.y);
    const w = Math.min(W, r.x + r.w) - x0;
    const h = Math.min(H, r.y + r.h) - y0;
    return w > 0 && h > 0 ? { x: x0, y: y0, w, h } : null;
  };

  const applyFill = (f: InakaGroundFillOp): void => {
    const rect = clip(f);
    if (!rect) return;
    steps.push({ tool: "fill_region", args: { mapId, rect, material: f.material, clearUpper: false }, note: `ground:${f.material}` });
    const isWet = WET_MATERIALS[f.material] === true;
    for (let yy = rect.y; yy < rect.y + rect.h; yy++) {
      for (let xx = rect.x; xx < rect.x + rect.w; xx++) wet[yy * W + xx] = isWet ? 1 : 0;
    }
  };

  applyFill({ x: 0, y: 0, w: W, h: H, material: scene.baseGround });
  for (const f of scene.fills) applyFill(f);

  for (const ln of scene.lines ?? []) {
    const rect = clip(ln);
    if (!rect) continue;
    steps.push({ tool: "paint_line", args: { mapId, rect, material: ln.material }, note: `line:${ln.material}` });
    for (let yy = rect.y; yy < rect.y + rect.h; yy++) {
      for (let xx = rect.x; xx < rect.x + rect.w; xx++) used3[yy * W + xx] = 1;
    }
  }

  // 키트 사각형이 맵 밖으로 조금 나가는 것(숲 나무 윗동)은 허용하고, 맵 안의 그림 칸만 겹침·젖은 땅을 따진다.
  const place = (st: InakaStampOp): void => {
    const kitId = inakaKitId(st.kit);
    const sz = kitSize(kitId);
    if (!sz) {
      skippedStamps.push(`${kitId}:missing-kit`);
      return;
    }
    const footY = st.y + sz.h - 1;
    if (st.x < 0 || st.x + sz.w > W || footY < 0 || footY >= H) {
      skippedStamps.push(`${kitId}@(${st.x},${st.y}):out-of-bounds`);
      return;
    }
    const layer = st.layer ?? 3;
    const used = layer === 4 ? used4 : used3;
    const cells: number[] = [];
    let collision = false;
    let wetConflict = false;
    for (let r = 0; r < sz.h; r++) {
      const yy = st.y + r;
      if (yy < 0) continue;
      for (let c = 0; c < sz.w; c++) {
        if (sz.opaque && sz.opaque[r * sz.w + c] !== true) continue;
        const idx = yy * W + st.x + c;
        cells.push(idx);
        if (used[idx]) collision = true;
        if (wet[idx] && st.allowWet !== true && layer !== 4) wetConflict = true;
      }
    }
    if ((collision && st.allowOverlap !== true) || wetConflict) {
      skippedStamps.push(`${kitId}@(${st.x},${st.y}):${collision && st.allowOverlap !== true ? "overlap" : "wet-conflict"}`);
      return;
    }
    for (const idx of cells) used[idx] = 1;
    steps.push({
      tool: "stamp_object",
      args: { objectId: `kit:jp_city/${kitId}`, mapId, x: st.x, y: st.y, ...(st.layer !== undefined ? { layer: st.layer } : {}) },
      note: kitId,
    });
    stampedCount++;
  };

  for (const st of scene.stamps) place(st);

  for (const row of scene.poleRows ?? []) {
    const poleKit = row.kit ?? "jp-pole-wood";
    const poleH = kitSize(poleKit)?.h ?? FALLBACK_POLE_HEIGHT;
    const top = row.footY - poleH + 1;
    for (const x of row.xs) place({ kit: poleKit, x, y: top, layer: 4, allowOverlap: true });
    // 전선 윗줄은 쓰는 전봇대 키트의 윗칸에 건다(나무 전봇대 9칸에 콘크리트 10칸 높이를 쓰면 전선이 꼭대기 위 허공에 뜬다).
    for (let i = 0; i + 1 < row.xs.length; i++) {
      const span = row.xs[i + 1]! - row.xs[i]!;
      place({ kit: `jp-wire-${span}`, x: row.xs[i]! + 3, y: top, layer: 4, allowOverlap: true });
    }
  }

  return { sceneId: scene.id, steps, stampedCount, skippedStamps };
}
