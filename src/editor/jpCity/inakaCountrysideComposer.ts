// 일본 시골(이나카 여름방학, jp-inaka) 칩셋 카탈로그 및 6대 쇼케이스 장면 조립기.
// 9종의 시골 바닥·물·논 타일(inaka-*)과 30종의 3/4 탑뷰 시골 건축·소품 키트(inaka-*)를
// 겹침·부유·물/진흙 오배치 없이 32×22 맵 위에 정밀 시공한다.

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

export interface InakaGroundFillOp {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly material: string;
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
  readonly stamps: readonly InakaStampOp[];
}

export interface InakaComposeStep {
  readonly tool: "fill_region" | "stamp_object";
  readonly args: Readonly<Record<string, unknown>>;
  readonly note: string;
}

export interface InakaComposePlan {
  readonly sceneId: string;
  readonly steps: readonly InakaComposeStep[];
  readonly stampedCount: number;
  readonly skippedStamps: readonly string[];
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
  { id: "inaka-meadow-wildflower", groupId: "jp:inaka-meadow-wildflower", ko: "여름 들꽃 풀밭", passable: true, surface: "land" },
] as const;

export const INAKA_KITS: readonly InakaKitSpec[] = [
  { id: "inaka-kominka-thatched", jpId: "jp-inaka-kominka-thatched", ko: "초가 고민가(茅葺き古民家)", w: 6, h: 5, allowWet: false },
  { id: "inaka-kawara-farmhouse", jpId: "jp-inaka-kawara-farmhouse", ko: "시골 기와 농가", w: 6, h: 5, allowWet: false },
  { id: "inaka-kura-storehouse", jpId: "jp-inaka-kura-storehouse", ko: "시골 토장 창고(土蔵)", w: 4, h: 4, allowWet: false },
  { id: "inaka-dagashiya", jpId: "jp-inaka-dagashiya", ko: "시골 막과자 가게(駄菓子屋)", w: 5, h: 4, allowWet: false },
  { id: "inaka-bus-stop-shelter", jpId: "jp-inaka-bus-stop-shelter", ko: "시골 버스 정류장", w: 3, h: 3, allowWet: false },
  { id: "inaka-unmanned-veg-stand", jpId: "jp-inaka-unmanned-veg-stand", ko: "무인 채소 판매대", w: 2, h: 2, allowWet: false },
  { id: "inaka-wooden-station", jpId: "jp-inaka-wooden-station", ko: "시골 목조 간이역", w: 7, h: 4, allowWet: false },
  { id: "train-car-a", jpId: "jp-train-car-a", ko: "통근 열차 한 량 A·B(기존 jp_city 열차 재사용)", w: 4, h: 3, allowWet: false },
  { id: "inaka-red-iron-bridge", jpId: "jp-inaka-red-iron-bridge", ko: "시골 붉은 철교", w: 6, h: 3, allowWet: true },
  { id: "inaka-stepping-stones", jpId: "jp-inaka-stepping-stones", ko: "개울 징검다리", w: 4, h: 2, allowWet: true },
  { id: "inaka-fire-watchtower", jpId: "jp-inaka-fire-watchtower", ko: "시골 소방 망루(火の見櫓)", w: 2, h: 4, allowWet: false },
  { id: "inaka-keitora-white", jpId: "jp-inaka-keitora-white", ko: "시골 흰 경트럭(軽トラ)", w: 3, h: 2, allowWet: false },
  { id: "inaka-red-tractor", jpId: "jp-inaka-red-tractor", ko: "붉은 농기계 트랙터", w: 3, h: 2, allowWet: false },
  { id: "inaka-agri-tin-shed", jpId: "jp-inaka-agri-tin-shed", ko: "함석 농기구 헛간", w: 4, h: 3, allowWet: false },
  { id: "inaka-vinyl-greenhouse", jpId: "jp-inaka-vinyl-greenhouse", ko: "비닐하우스", w: 5, h: 3, allowWet: false },
  { id: "inaka-sunflower-patch", jpId: "jp-inaka-sunflower-patch", ko: "여름 해바라기 군락", w: 3, h: 2, allowWet: false },
  { id: "inaka-hydrangea-hedge", jpId: "jp-inaka-hydrangea-hedge", ko: "수국 꽃덤불", w: 3, h: 2, allowWet: false },
  { id: "inaka-jizo-shrine-row", jpId: "jp-inaka-jizo-shrine-row", ko: "길가 지장보살 사당(3기)", w: 3, h: 2, allowWet: false },
  { id: "inaka-wooden-pole-transformer", jpId: "jp-inaka-wooden-pole-transformer", ko: "시골 나무 전봇대", w: 1, h: 3, allowWet: false },
  { id: "inaka-retro-postbox-vending", jpId: "jp-inaka-retro-postbox-vending", ko: "둥근 붉은 우체통과 자판기", w: 2, h: 2, allowWet: false },
  { id: "inaka-waterwheel-mill", jpId: "jp-inaka-waterwheel-mill", ko: "시골 물레방아간", w: 4, h: 4, allowWet: true },
  { id: "inaka-sluice-gate", jpId: "jp-inaka-sluice-gate", ko: "농수로 철제 수문", w: 2, h: 2, allowWet: true },
  { id: "inaka-rice-rack-hasagi", jpId: "jp-inaka-rice-rack-hasagi", ko: "하사기 볏단 건조대(稲架)", w: 3, h: 2, allowWet: true },
  { id: "inaka-scarecrow-pair", jpId: "jp-inaka-scarecrow-pair", ko: "논두렁 허수아비 한 쌍", w: 2, h: 2, allowWet: true },
  { id: "inaka-bamboo-fence-gate", jpId: "jp-inaka-bamboo-fence-gate", ko: "타케가키 죽담과 사립문", w: 4, h: 2, allowWet: false },
  { id: "inaka-mossy-stone-wall", jpId: "jp-inaka-mossy-stone-wall", ko: "이끼 낀 시골 돌담", w: 4, h: 2, allowWet: false },
  { id: "inaka-roadside-mirror", jpId: "jp-inaka-roadside-mirror", ko: "커브길 볼록거울", w: 1, h: 2, allowWet: false },
  { id: "inaka-bicycle-parked", jpId: "jp-inaka-bicycle-parked", ko: "세워둔 시골 자전거", w: 2, h: 1, allowWet: false },
  { id: "inaka-well-handpump", jpId: "jp-inaka-well-handpump", ko: "작두 우물 펌프", w: 2, h: 2, allowWet: false },
  { id: "inaka-hillside-torii-stairs", jpId: "jp-inaka-hillside-torii-stairs", ko: "언덕 삼나무 돌계단과 도리이", w: 4, h: 5, allowWet: false },
] as const;

const WET_MATERIALS: Readonly<Record<string, true>> = {
  "inaka-paddy-water": true,
  "inaka-paddy-summer": true,
  "inaka-paddy-golden": true,
  "inaka-canal-water": true,
  "inaka-canal-wall": true,
  "inaka-river-shallow": true,
  "논(물 댄 모)": true,
  "바다": true,
  "수로": true,
};

export function inakaKitId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.startsWith("jp-")) return trimmed;
  return `jp-${trimmed}`;
}

export function paintInakaGround(
  map: { readonly width: number; readonly height: number; readonly lowerTiles: number[] },
  tileset: { readonly tileGroups?: readonly { readonly id: string; readonly name: string; readonly tileIds: readonly number[] }[] },
  rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
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

export const INAKA_SHOWCASE_SCENES: readonly InakaShowcaseScene[] = [
  {
    id: "01-kominka-summer-village",
    no: 1,
    fileName: "01-kominka-summer-village.png",
    titleKo: "01. 여름방학 초가 고민가와 기와 농가 마을",
    subtitleJa: "茅葺き古民家と瓦農家の夏休み集落",
    descriptionKo: "대숲·삼나무 뒷산 아래 다져진 흙마당의 초가 고민가와 기와 농가, 토장 창고, 텃밭, 수국 돌담, 해바라기 밭, 작두 우물, 흰 경트럭이 어우러진 여름 시골 마을.",
    width: 32,
    height: 22,
    baseGround: "inaka-meadow-wildflower",
    fills: [
      { x: 4, y: 4, w: 10, h: 6, material: "inaka-aze-path" },
      { x: 18, y: 4, w: 10, h: 6, material: "inaka-aze-path" },
      { x: 6, y: 10, w: 2, h: 2, material: "inaka-aze-path" },
      { x: 22, y: 10, w: 2, h: 2, material: "inaka-aze-path" },
      { x: 15, y: 5, w: 2, h: 17, material: "inaka-aze-path" },
      { x: 0, y: 12, w: 32, h: 3, material: "inaka-gravel-road" },
      { x: 1, y: 15, w: 14, h: 7, material: "inaka-aze-path" },
      { x: 2, y: 16, w: 12, h: 5, material: "inaka-paddy-summer" },
      { x: 18, y: 15, w: 14, h: 1, material: "inaka-canal-wall" },
      { x: 18, y: 16, w: 14, h: 1, material: "inaka-canal-water" },
      { x: 18, y: 17, w: 13, h: 5, material: "inaka-aze-path" },
    ],
    stamps: [
      { kit: "rg-bamboo-grove", x: 0, y: 0 },
      { kit: "inaka-kominka-thatched", x: 4, y: 2 },
      { kit: "inaka-kura-storehouse", x: 10, y: 3 },
      { kit: "rg-sugi", x: 14, y: 0 },
      { kit: "inaka-kawara-farmhouse", x: 18, y: 2 },
      { kit: "inaka-agri-tin-shed", x: 24, y: 3 },
      { kit: "rg-bamboo-grove", x: 28, y: 0 },
      { kit: "inaka-unmanned-veg-stand", x: 1, y: 7 },
      { kit: "inaka-bicycle-parked", x: 4, y: 7 },
      { kit: "inaka-well-handpump", x: 10, y: 7 },
      { kit: "jp-lot-veg", x: 24, y: 6 },
      { kit: "inaka-well-handpump", x: 29, y: 7 },
      { kit: "inaka-bamboo-fence-gate", x: 2, y: 10 },
      { kit: "inaka-hydrangea-hedge", x: 6, y: 10 },
      { kit: "inaka-mossy-stone-wall", x: 9, y: 10 },
      { kit: "inaka-wooden-pole-transformer", x: 14, y: 9 },
      { kit: "inaka-roadside-mirror", x: 17, y: 10 },
      { kit: "inaka-bamboo-fence-gate", x: 18, y: 10 },
      { kit: "inaka-mossy-stone-wall", x: 22, y: 10 },
      { kit: "inaka-hydrangea-hedge", x: 26, y: 10 },
      { kit: "inaka-wooden-pole-transformer", x: 30, y: 9 },
      { kit: "inaka-keitora-white", x: 11, y: 12 },
      { kit: "inaka-scarecrow-pair", x: 5, y: 15, allowWet: true },
      { kit: "inaka-rice-rack-hasagi", x: 9, y: 15, allowWet: true },
      { kit: "inaka-sluice-gate", x: 18, y: 15, allowWet: true },
      { kit: "inaka-sunflower-patch", x: 19, y: 17 },
      { kit: "inaka-sunflower-patch", x: 23, y: 17 },
      { kit: "inaka-sunflower-patch", x: 27, y: 17 },
      { kit: "inaka-sunflower-patch", x: 19, y: 19 },
      { kit: "inaka-sunflower-patch", x: 23, y: 19 },
      { kit: "inaka-jizo-shrine-row", x: 27, y: 19 },
    ],
  },
  {
    id: "02-dagashiya-and-bus-stop",
    no: 2,
    fileName: "02-dagashiya-and-bus-stop.png",
    titleKo: "02. 시골 삼거리 막과자 가게(다가시야)와 양철 버스 정류장",
    subtitleJa: "三叉路の駄菓子屋とトタン屋根のバス停",
    descriptionKo: "유리 과자병·가챠·아이스크림 냉동고가 놓인 시골 막과자 가게, 수국 핀 양철 버스 정류장, 무인 채소 가판대, 둥근 우체통과 비닐하우스 농장.",
    width: 32,
    height: 22,
    baseGround: "inaka-meadow-wildflower",
    fills: [
      { x: 3, y: 4, w: 6, h: 5, material: "inaka-aze-path" },
      { x: 10, y: 5, w: 18, h: 4, material: "inaka-aze-path" },
      { x: 0, y: 9, w: 32, h: 1, material: "inaka-aze-path" },
      { x: 0, y: 10, w: 32, h: 4, material: "inaka-gravel-road" },
      { x: 13, y: 14, w: 5, h: 8, material: "inaka-gravel-road" },
      { x: 0, y: 14, w: 13, h: 1, material: "inaka-aze-path" },
      { x: 18, y: 14, w: 14, h: 1, material: "inaka-aze-path" },
      { x: 1, y: 15, w: 11, h: 6, material: "inaka-aze-path" },
      { x: 19, y: 15, w: 12, h: 1, material: "inaka-canal-wall" },
      { x: 19, y: 16, w: 12, h: 1, material: "inaka-canal-water" },
      { x: 19, y: 17, w: 12, h: 4, material: "inaka-aze-path" },
      { x: 20, y: 18, w: 10, h: 3, material: "inaka-paddy-water" },
    ],
    stamps: [
      { kit: "rg-sugi", x: 0, y: 0 },
      { kit: "inaka-kawara-farmhouse", x: 3, y: 2 },
      { kit: "rg-sugi", x: 9, y: 0 },
      { kit: "inaka-dagashiya", x: 12, y: 4 },
      { kit: "inaka-retro-postbox-vending", x: 17, y: 6 },
      { kit: "rg-sugi", x: 19, y: 0 },
      { kit: "inaka-bus-stop-shelter", x: 20, y: 6 },
      { kit: "inaka-hydrangea-hedge", x: 23, y: 7 },
      { kit: "inaka-unmanned-veg-stand", x: 26, y: 7 },
      { kit: "rg-bamboo-grove", x: 28, y: 0 },
      { kit: "inaka-bamboo-fence-gate", x: 3, y: 7 },
      { kit: "inaka-well-handpump", x: 7, y: 7 },
      { kit: "inaka-wooden-pole-transformer", x: 10, y: 6 },
      { kit: "inaka-wooden-pole-transformer", x: 28, y: 6 },
      { kit: "inaka-bicycle-parked", x: 11, y: 8 },
      { kit: "inaka-bicycle-parked", x: 14, y: 8 },
      { kit: "inaka-keitora-white", x: 4, y: 11 },
      { kit: "inaka-red-tractor", x: 23, y: 11 },
      { kit: "inaka-roadside-mirror", x: 12, y: 14 },
      { kit: "inaka-roadside-mirror", x: 18, y: 14 },
      { kit: "inaka-vinyl-greenhouse", x: 1, y: 15 },
      { kit: "inaka-agri-tin-shed", x: 7, y: 15 },
      { kit: "inaka-sunflower-patch", x: 1, y: 19 },
      { kit: "inaka-sunflower-patch", x: 5, y: 19 },
      { kit: "inaka-unmanned-veg-stand", x: 9, y: 19 },
      { kit: "inaka-sluice-gate", x: 19, y: 15, allowWet: true },
      { kit: "inaka-jizo-shrine-row", x: 22, y: 17, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 27, y: 17, allowWet: true },
    ],
  },
  {
    id: "03-wayside-station-and-railcar",
    no: 3,
    fileName: "03-wayside-station-and-railcar.png",
    titleKo: "03. 여름 논밭 사이 목조 간이역과 통근 전철(기존 jp_city 열차·선로 재사용)",
    subtitleJa: "夏水田を走るローカル電車と木造無人駅",
    descriptionKo: "모내기 물논과 푸른 여름 논 사이를 가로지르는 지상 선로(jp-rail-h), 민트색 목조 간이역 승강장에 정차한 기존 jp_city 통근 열차(jp-train-car-a/b)와 건널목(jp-rail-xing)·가선 기둥(jp-prop-catenary-pole).",
    width: 32,
    height: 22,
    baseGround: "inaka-meadow-wildflower",
    fills: [
      { x: 4, y: 0, w: 6, h: 5, material: "inaka-aze-path" },
      { x: 4, y: 1, w: 5, h: 3, material: "inaka-paddy-water" },
      { x: 9, y: 0, w: 11, h: 7, material: "inaka-aze-path" },
      { x: 23, y: 0, w: 6, h: 6, material: "inaka-aze-path" },
      { x: 20, y: 0, w: 3, h: 22, material: "inaka-gravel-road" },
      { x: 0, y: 7, w: 32, h: 4, material: "inaka-gravel-road" },
      { x: 0, y: 11, w: 20, h: 2, material: "inaka-aze-path" },
      { x: 23, y: 11, w: 9, h: 2, material: "inaka-aze-path" },
      { x: 0, y: 13, w: 32, h: 2, material: "inaka-gravel-road" },
      { x: 0, y: 15, w: 20, h: 7, material: "inaka-aze-path" },
      { x: 23, y: 15, w: 9, h: 7, material: "inaka-aze-path" },
      { x: 1, y: 16, w: 8, h: 5, material: "inaka-paddy-water" },
      { x: 10, y: 16, w: 9, h: 5, material: "inaka-paddy-summer" },
      { x: 24, y: 16, w: 7, h: 5, material: "inaka-paddy-golden" },
    ],
    stamps: [
      // North rural backdrop & wooden wayside station (station platform row y=6 aligns with jp-platform-edge y=5..6)
      { kit: "rg-bamboo-grove", x: 0, y: 0 },
      { kit: "inaka-scarecrow-pair", x: 5, y: 1, allowWet: true },
      { kit: "inaka-bicycle-parked", x: 11, y: 1 },
      { kit: "inaka-bicycle-parked", x: 14, y: 1 },
      { kit: "inaka-wooden-pole-transformer", x: 9, y: 2 },
      { kit: "inaka-wooden-station", x: 10, y: 3 },
      { kit: "inaka-retro-postbox-vending", x: 17, y: 3 },
      { kit: "inaka-wooden-pole-transformer", x: 19, y: 2 },
      { kit: "inaka-bus-stop-shelter", x: 23, y: 2 },
      { kit: "inaka-hydrangea-hedge", x: 26, y: 3 },
      { kit: "rg-sugi", x: 29, y: 0 },
      // North railway embankment verge & station tactile platform edge (existing jp_city rail kits)
      { kit: "jp-rail-verge", x: 4, y: 5 },
      { kit: "jp-rail-verge", x: 5, y: 5 },
      { kit: "jp-platform-edge", x: 6, y: 5 },
      { kit: "jp-platform-edge", x: 7, y: 5 },
      { kit: "jp-platform-edge", x: 8, y: 5 },
      { kit: "jp-platform-edge", x: 9, y: 5 },
      { kit: "jp-platform-edge", x: 17, y: 5 },
      { kit: "jp-platform-edge", x: 18, y: 5 },
      { kit: "jp-platform-edge", x: 19, y: 5 },
      { kit: "jp-rail-verge", x: 23, y: 5 },
      { kit: "jp-rail-verge", x: 24, y: 5 },
      { kit: "jp-rail-verge", x: 25, y: 5 },
      { kit: "jp-rail-verge", x: 26, y: 5 },
      { kit: "jp-rail-verge", x: 27, y: 5 },
      { kit: "jp-rail-verge", x: 28, y: 5 },
      // Main horizontal railway track (existing jp-rail-h & jp-rail-xing + jp-rail-xing-bars)
      { kit: "jp-rail-h", x: 0, y: 7 },
      { kit: "jp-rail-h", x: 1, y: 7 },
      { kit: "jp-rail-h", x: 2, y: 7 },
      { kit: "jp-rail-h", x: 3, y: 7 },
      { kit: "jp-rail-h", x: 4, y: 7 },
      { kit: "jp-rail-h", x: 5, y: 7 },
      { kit: "jp-rail-h", x: 6, y: 7 },
      { kit: "jp-rail-h", x: 7, y: 7 },
      { kit: "jp-rail-h", x: 8, y: 7 },
      { kit: "jp-rail-h", x: 9, y: 7 },
      { kit: "jp-rail-h", x: 10, y: 7 },
      { kit: "jp-rail-h", x: 11, y: 7 },
      { kit: "jp-rail-h", x: 12, y: 7 },
      { kit: "jp-rail-h", x: 13, y: 7 },
      { kit: "jp-rail-h", x: 14, y: 7 },
      { kit: "jp-rail-h", x: 15, y: 7 },
      { kit: "jp-rail-h", x: 16, y: 7 },
      { kit: "jp-rail-h", x: 17, y: 7 },
      { kit: "jp-rail-h", x: 18, y: 7 },
      { kit: "jp-rail-h", x: 19, y: 7 },
      { kit: "jp-rail-xing", x: 20, y: 7 },
      { kit: "jp-rail-xing", x: 21, y: 7 },
      { kit: "jp-rail-xing", x: 22, y: 7 },
      { kit: "jp-rail-xing-bars", x: 20, y: 7, allowOverlap: true },
      { kit: "jp-rail-xing-bars", x: 22, y: 7, allowOverlap: true },
      { kit: "jp-rail-h", x: 23, y: 7 },
      { kit: "jp-rail-h", x: 24, y: 7 },
      { kit: "jp-rail-h", x: 25, y: 7 },
      { kit: "jp-rail-h", x: 26, y: 7 },
      { kit: "jp-rail-h", x: 27, y: 7 },
      { kit: "jp-rail-h", x: 28, y: 7 },
      { kit: "jp-rail-h", x: 29, y: 7 },
      { kit: "jp-rail-h", x: 30, y: 7 },
      { kit: "jp-rail-h", x: 31, y: 7 },
      // Reused existing jp_city commuter train cars (2-car local formation stopped at station platform)
      { kit: "jp-train-car-a", x: 8, y: 7, allowOverlap: true },
      { kit: "jp-train-car-b", x: 12, y: 7, allowOverlap: true },
      // Overhead catenary wires & poles on Layer 4 (aligned at y=5 so wires hang between pole crossarms)
      { kit: "jp-rail-wire", x: 2, y: 5, allowOverlap: true, layer: 4 },
      { kit: "jp-rail-wire", x: 25, y: 5, allowOverlap: true, layer: 4 },
      { kit: "jp-prop-catenary-pole", x: 1, y: 5, allowOverlap: true, layer: 4 },
      { kit: "jp-prop-catenary-pole", x: 6, y: 5, allowOverlap: true, layer: 4 },
      { kit: "jp-prop-catenary-pole", x: 18, y: 5, allowOverlap: true, layer: 4 },
      { kit: "jp-prop-catenary-pole", x: 24, y: 5, allowOverlap: true, layer: 4 },
      { kit: "jp-prop-catenary-pole", x: 29, y: 5, allowOverlap: true, layer: 4 },
      // South railway verge, level crossing mirrors, country road, and rice paddies
      { kit: "jp-rail-verge", x: 0, y: 11 },
      { kit: "jp-rail-verge", x: 1, y: 11 },
      { kit: "jp-rail-verge", x: 2, y: 11 },
      { kit: "jp-rail-verge", x: 3, y: 11 },
      { kit: "jp-rail-verge", x: 4, y: 11 },
      { kit: "jp-rail-verge", x: 5, y: 11 },
      { kit: "jp-rail-verge", x: 6, y: 11 },
      { kit: "jp-rail-verge", x: 7, y: 11 },
      { kit: "inaka-hydrangea-hedge", x: 8, y: 11 },
      { kit: "inaka-jizo-shrine-row", x: 12, y: 11 },
      { kit: "inaka-unmanned-veg-stand", x: 16, y: 11 },
      { kit: "inaka-roadside-mirror", x: 19, y: 11 },
      { kit: "inaka-roadside-mirror", x: 23, y: 11 },
      { kit: "jp-rail-verge", x: 25, y: 11 },
      { kit: "jp-rail-verge", x: 26, y: 11 },
      { kit: "jp-rail-verge", x: 27, y: 11 },
      { kit: "jp-rail-verge", x: 28, y: 11 },
      { kit: "jp-rail-verge", x: 29, y: 11 },
      { kit: "jp-rail-verge", x: 30, y: 11 },
      { kit: "jp-rail-verge", x: 31, y: 11 },
      { kit: "inaka-keitora-white", x: 20, y: 13 },
      { kit: "inaka-sunflower-patch", x: 1, y: 15, allowWet: true },
      { kit: "inaka-sunflower-patch", x: 5, y: 15, allowWet: true },
      { kit: "inaka-rice-rack-hasagi", x: 24, y: 15, allowWet: true },
      { kit: "inaka-rice-rack-hasagi", x: 28, y: 15, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 4, y: 18, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 13, y: 18, allowWet: true },
    ],
  },
  {
    id: "04-terraced-paddies-and-waterwheel",
    no: 4,
    fileName: "04-terraced-paddies-and-waterwheel.png",
    titleKo: "04. 다랑논 세 계절 들판과 물레방아간·농수로·소방 망루",
    subtitleJa: "棚田の四季・水車小屋と用水路・火の見櫓",
    descriptionKo: "물 비치는 봄 모내기 논, 한여름 푸른 논, 가을 황금 들판과 하사기 볏단 건조대, 돌축대 아래로 흐르는 농수로와 물레방아간, 수문, 붉은 트랙터와 소방 망루.",
    width: 32,
    height: 22,
    baseGround: "inaka-aze-path",
    fills: [
      { x: 1, y: 1, w: 9, h: 5, material: "inaka-paddy-water" },
      { x: 11, y: 1, w: 9, h: 5, material: "inaka-paddy-summer" },
      { x: 21, y: 1, w: 10, h: 7, material: "inaka-meadow-wildflower" },
      { x: 0, y: 8, w: 32, h: 1, material: "inaka-canal-wall" },
      { x: 0, y: 9, w: 32, h: 1, material: "inaka-canal-water" },
      { x: 1, y: 11, w: 9, h: 4, material: "inaka-paddy-summer" },
      { x: 11, y: 11, w: 10, h: 4, material: "inaka-paddy-golden" },
      { x: 22, y: 10, w: 9, h: 5, material: "inaka-aze-path" },
      { x: 0, y: 15, w: 32, h: 2, material: "inaka-gravel-road" },
      { x: 1, y: 18, w: 11, h: 3, material: "inaka-paddy-golden" },
      { x: 13, y: 18, w: 9, h: 3, material: "inaka-paddy-water" },
      { x: 23, y: 18, w: 8, h: 3, material: "inaka-meadow-wildflower" },
    ],
    stamps: [
      { kit: "inaka-scarecrow-pair", x: 4, y: 2, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 14, y: 2, allowWet: true },
      { kit: "rg-sugi", x: 20, y: 0 },
      { kit: "inaka-waterwheel-mill", x: 23, y: 4, allowWet: true },
      { kit: "inaka-fire-watchtower", x: 28, y: 2 },
      { kit: "inaka-mossy-stone-wall", x: 1, y: 6 },
      { kit: "inaka-mossy-stone-wall", x: 5, y: 6 },
      { kit: "inaka-mossy-stone-wall", x: 11, y: 6 },
      { kit: "inaka-mossy-stone-wall", x: 15, y: 6 },
      { kit: "inaka-sluice-gate", x: 9, y: 8, allowWet: true },
      { kit: "inaka-sluice-gate", x: 19, y: 8, allowWet: true },
      { kit: "inaka-rice-rack-hasagi", x: 11, y: 10, allowWet: true },
      { kit: "inaka-rice-rack-hasagi", x: 15, y: 10, allowWet: true },
      { kit: "inaka-agri-tin-shed", x: 22, y: 10 },
      { kit: "inaka-vinyl-greenhouse", x: 26, y: 10 },
      { kit: "inaka-wooden-pole-transformer", x: 0, y: 12 },
      { kit: "inaka-wooden-pole-transformer", x: 21, y: 12 },
      { kit: "inaka-red-tractor", x: 6, y: 15 },
      { kit: "inaka-keitora-white", x: 14, y: 15 },
      { kit: "inaka-unmanned-veg-stand", x: 22, y: 15 },
      { kit: "inaka-roadside-mirror", x: 30, y: 14 },
      { kit: "inaka-rice-rack-hasagi", x: 2, y: 17, allowWet: true },
      { kit: "inaka-rice-rack-hasagi", x: 7, y: 17, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 16, y: 17, allowWet: true },
      { kit: "inaka-sunflower-patch", x: 23, y: 18 },
      { kit: "inaka-sunflower-patch", x: 27, y: 18 },
    ],
  },
  {
    id: "05-river-stepping-stones-and-iron-bridge",
    no: 5,
    fileName: "05-river-stepping-stones-and-iron-bridge.png",
    titleKo: "05. 맑은 시골 개울 징검다리와 붉은 트러스 철교",
    subtitleJa: "清流の飛び石と赤いトラス鉄橋",
    descriptionKo: "강자갈이 비치는 시골 개울 위 납작한 징검다리와 리벳 붉은 강철 트러스 철교, 강변 들꽃 제방 산책로와 물레방아·초가 농가.",
    width: 32,
    height: 22,
    baseGround: "inaka-meadow-wildflower",
    fills: [
      { x: 3, y: 1, w: 9, h: 4, material: "inaka-aze-path" },
      { x: 19, y: 1, w: 10, h: 4, material: "inaka-aze-path" },
      { x: 0, y: 5, w: 32, h: 2, material: "inaka-gravel-road" },
      { x: 0, y: 13, w: 32, h: 2, material: "inaka-aze-path" },
      { x: 13, y: 0, w: 6, h: 22, material: "inaka-aze-path" },
      { x: 14, y: 0, w: 4, h: 22, material: "inaka-river-shallow" },
      { x: 1, y: 15, w: 12, h: 1, material: "inaka-canal-wall" },
      { x: 1, y: 16, w: 12, h: 1, material: "inaka-canal-water" },
      { x: 1, y: 17, w: 12, h: 4, material: "inaka-aze-path" },
      { x: 2, y: 18, w: 10, h: 3, material: "inaka-paddy-water" },
    ],
    stamps: [
      { kit: "rg-sugi", x: 0, y: 0 },
      { kit: "inaka-kominka-thatched", x: 3, y: 0 },
      { kit: "inaka-well-handpump", x: 9, y: 2 },
      { kit: "inaka-kawara-farmhouse", x: 19, y: 0 },
      { kit: "inaka-kura-storehouse", x: 25, y: 0 },
      { kit: "rg-sugi", x: 29, y: 0 },
      { kit: "inaka-wooden-pole-transformer", x: 11, y: 4 },
      { kit: "inaka-roadside-mirror", x: 12, y: 5 },
      { kit: "inaka-red-iron-bridge", x: 13, y: 5, allowWet: true },
      { kit: "inaka-keitora-white", x: 4, y: 5 },
      { kit: "inaka-waterwheel-mill", x: 9, y: 8, allowWet: true },
      { kit: "inaka-hydrangea-hedge", x: 2, y: 9 },
      { kit: "inaka-hydrangea-hedge", x: 5, y: 9 },
      { kit: "inaka-bus-stop-shelter", x: 20, y: 9 },
      { kit: "inaka-jizo-shrine-row", x: 24, y: 10 },
      { kit: "inaka-hydrangea-hedge", x: 28, y: 10 },
      { kit: "inaka-stepping-stones", x: 14, y: 13, allowWet: true },
      { kit: "inaka-bicycle-parked", x: 6, y: 13 },
      { kit: "inaka-sluice-gate", x: 2, y: 15, allowWet: true },
      { kit: "inaka-scarecrow-pair", x: 5, y: 17, allowWet: true },
      { kit: "inaka-unmanned-veg-stand", x: 20, y: 16 },
      { kit: "inaka-sunflower-patch", x: 24, y: 16 },
      { kit: "inaka-sunflower-patch", x: 28, y: 16 },
      { kit: "inaka-sunflower-patch", x: 24, y: 19 },
      { kit: "inaka-sunflower-patch", x: 28, y: 19 },
    ],
  },
  {
    id: "06-hillside-shrine-and-jizo-pass",
    no: 6,
    fileName: "06-hillside-shrine-and-jizo-pass.png",
    titleKo: "06. 삼나무 숲길 이끼 돌계단·언덕 도리이 신사와 지장보살 고개",
    subtitleJa: "鎮守の杉並木・苔石段の鳥居とお地蔵様峠",
    descriptionKo: "울창한 삼나무·대나무 숲 사이로 이어지는 이끼 낀 돌계단과 주홍 도리이, 산정 초가 신사와 보물고, 고갯길 지장보살 사당과 개울 징검다리.",
    width: 32,
    height: 22,
    baseGround: "숲 바닥(이끼·낙엽)",
    fills: [
      { x: 8, y: 0, w: 16, h: 6, material: "inaka-aze-path" },
      { x: 14, y: 6, w: 4, h: 10, material: "온천가 돌길(이시다타미)" },
      { x: 0, y: 16, w: 32, h: 2, material: "inaka-aze-path" },
      { x: 0, y: 18, w: 32, h: 4, material: "inaka-meadow-wildflower" },
      { x: 0, y: 19, w: 13, h: 2, material: "inaka-river-shallow" },
    ],
    stamps: [
      { kit: "rg-bamboo-grove", x: 0, y: 0 },
      { kit: "rg-bamboo-grove", x: 4, y: 0 },
      { kit: "inaka-kura-storehouse", x: 9, y: 1 },
      { kit: "inaka-kominka-thatched", x: 13, y: 0 },
      { kit: "inaka-well-handpump", x: 19, y: 2 },
      { kit: "inaka-fire-watchtower", x: 22, y: 1 },
      { kit: "rg-bamboo-grove", x: 24, y: 0 },
      { kit: "rg-bamboo-grove", x: 28, y: 0 },
      { kit: "inaka-mossy-stone-wall", x: 8, y: 5 },
      { kit: "inaka-mossy-stone-wall", x: 19, y: 5 },
      { kit: "rg-sugi", x: 1, y: 6 },
      { kit: "rg-sugi", x: 5, y: 6 },
      { kit: "inaka-hillside-torii-stairs", x: 14, y: 6 },
      { kit: "inaka-hydrangea-hedge", x: 10, y: 8 },
      { kit: "inaka-hydrangea-hedge", x: 19, y: 8 },
      { kit: "rg-sugi", x: 24, y: 6 },
      { kit: "rg-sugi", x: 28, y: 6 },
      { kit: "inaka-hillside-torii-stairs", x: 14, y: 11 },
      { kit: "inaka-hydrangea-hedge", x: 10, y: 11 },
      { kit: "inaka-hydrangea-hedge", x: 19, y: 11 },
      { kit: "inaka-jizo-shrine-row", x: 5, y: 14 },
      { kit: "inaka-jizo-shrine-row", x: 23, y: 14 },
      { kit: "inaka-wooden-pole-transformer", x: 26, y: 13 },
      { kit: "inaka-bus-stop-shelter", x: 27, y: 13 },
      { kit: "inaka-roadside-mirror", x: 13, y: 15 },
      { kit: "inaka-stepping-stones", x: 4, y: 19, allowWet: true },
      { kit: "inaka-bicycle-parked", x: 15, y: 18 },
      { kit: "inaka-unmanned-veg-stand", x: 19, y: 18 },
      { kit: "inaka-sunflower-patch", x: 22, y: 18 },
      { kit: "inaka-sunflower-patch", x: 26, y: 18 },
    ],
  },
] as const;

export function planInakaShowcaseScene(input: {
  readonly scene: InakaShowcaseScene;
  readonly mapId: string;
  readonly kitSize: (kitId: string) => { readonly w: number; readonly h: number } | undefined;
}): InakaComposePlan {
  const { scene, mapId, kitSize } = input;
  const W = scene.width;
  const H = scene.height;
  const wet = new Uint8Array(W * H);
  const used = new Uint8Array(W * H);
  const steps: InakaComposeStep[] = [];
  const skippedStamps: string[] = [];
  let stampedCount = 0;

  const applyFill = (x: number, y: number, w: number, h: number, material: string): void => {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const cw = Math.min(W - x0, w);
    const ch = Math.min(H - y0, h);
    if (cw <= 0 || ch <= 0) return;
    steps.push({
      tool: "fill_region",
      args: { mapId, rect: { x: x0, y: y0, w: cw, h: ch }, material },
      note: `ground:${material}`,
    });
    const isWet = WET_MATERIALS[material] === true;
    for (let yy = y0; yy < y0 + ch; yy++) {
      for (let xx = x0; xx < x0 + cw; xx++) {
        wet[yy * W + xx] = isWet ? 1 : 0;
      }
    }
  };

  applyFill(0, 0, W, H, scene.baseGround);
  for (const f of scene.fills) {
    applyFill(f.x, f.y, f.w, f.h, f.material);
  }

  for (const st of scene.stamps) {
    const kitId = inakaKitId(st.kit);
    const sz = kitSize(kitId);
    if (!sz) {
      skippedStamps.push(`${kitId}:missing-kit`);
      continue;
    }
    if (st.x < 0 || st.y < 0 || st.x + sz.w > W || st.y + sz.h > H) {
      skippedStamps.push(`${kitId}@(${st.x},${st.y}):out-of-bounds`);
      continue;
    }
    let collision = false;
    let wetConflict = false;
    for (let yy = st.y; yy < st.y + sz.h; yy++) {
      for (let xx = st.x; xx < st.x + sz.w; xx++) {
        const idx = yy * W + xx;
        if (used[idx]) collision = true;
        if (wet[idx] && st.allowWet !== true) wetConflict = true;
      }
    }
    if ((collision && st.allowOverlap !== true) || wetConflict) {
      skippedStamps.push(`${kitId}@(${st.x},${st.y}):${collision && st.allowOverlap !== true ? "overlap" : "wet-conflict"}`);
      continue;
    }
    for (let yy = st.y; yy < st.y + sz.h; yy++) {
      for (let xx = st.x; xx < st.x + sz.w; xx++) {
        used[yy * W + xx] = 1;
      }
    }
    steps.push({
      tool: "stamp_object",
      args: {
        objectId: `kit:jp_city/${kitId}`,
        mapId,
        x: st.x,
        y: st.y,
        ...(st.layer !== undefined ? { layer: st.layer } : {}),
      },
      note: kitId,
    });
    stampedCount++;
  }

  return { sceneId: scene.id, steps, stampedCount, skippedStamps };
}
