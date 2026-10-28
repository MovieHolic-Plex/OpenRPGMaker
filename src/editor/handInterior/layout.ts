// 방 구성 → 배치 후보. 조수(모델)는 방 종류만 고르고, 방 사각형 배치는 여기서 짠다(2026-10-08: 모델에게 평면을 맡기면
// 「예제 통째로 베끼기」 아니면 「보고 있는 맵 크기의 큰 네모 하나」로 끝났다).
//
//  크기: 방마다 같은 종류의 방 견본(templates.ts, 제작자 예제에서 자른 것) 크기를 목표로 한다. 견본이 없으면 종류별 기본 크기.
//  배치: 안쪽 사각형을 재귀로 둘로 가르는 slicing — 칸막이 1칸을 빼고 면적 비례로 가른다. 출구 방은 늘 맨 아래 줄에 닿게 한다.
//  점수: 목표 크기와의 차이 · 너무 길쭉한 방 · 원하는 이웃(prefer)을 못 붙인 수 · 통과용이 아닌 방(화장실·욕실·침실)을 지나야 하는 수.
//  문: 출구 방에서 넓게 퍼지는 나무 — 복도·거실 같은 중심 방을 먼저 거친다. 현관↔복도·부엌↔거실처럼 트인 쌍은 칸막이를 걷는다.
// 결과는 rooms.ts 의 rooms·connect·exit 그대로다.
import type { HandInteriorSpec } from "./builder";
import type { HandInteriorConnect, HandInteriorNotch, HandInteriorRoom } from "./rooms";
import { programKinds, roomPrograms, roomTemplates, templatesOfKind, templateStyle, type InteriorRoomTemplate, type InteriorStyleVariant } from "./templates";
import { HALL_DRESS, HALL_H, HALL_KIND, type HallDress } from "./archHall";
import { contrastPair } from "./wallContrast";
import { MODERN_PROGRAM_VARIATION, type ModernProgramVariation } from "./modernPresets";
import { VENUE_SCALE_CONTRACT } from "./venueScale";

type Pair = readonly [string, string] | { readonly a: string; readonly b: string };
/** template: 이 방에 쓸 견본 id(빌더 내부) — 같은 게임에 같은 용도 방이 또 있으면 다른 견본 변형을 돌려 쓰게 조수 v2 빌더가 정한다. */
export interface LayoutRoomRequest { readonly id?: string; readonly kind: string; readonly w?: number; readonly h?: number; readonly floor?: string; readonly wall?: string; readonly template?: string }
export interface LayoutRequest {
  /** 예제 맵 key(house-1f·bakery…) 또는 건물 id(jp_house·tavern…) — 그 예제의 방 종류 목록을 쓴다. */
  readonly program?: string;
  readonly rooms?: readonly LayoutRoomRequest[];
  /** 출구 방 id(생략하면 genkan·entrance·hall·가게 순으로 찾는다). */
  readonly entrance?: string;
  /** 문으로 바로 잇고 싶은 방 쌍(id 또는 종류). */
  readonly prefer?: readonly Pair[];
  /** 칸막이 없이 트고 싶은 방 쌍. */
  readonly open?: readonly Pair[];
  readonly seed?: number;
  readonly styleVariant?: InteriorStyleVariant;
  readonly maxWidth?: number; readonly maxHeight?: number;
}
export interface LayoutRoom extends HandInteriorRoom { readonly kind: string; readonly template?: string; readonly dress?: HallDress }
export interface LayoutCandidate {
  readonly width: number; readonly height: number; readonly score: number;
  readonly rooms: LayoutRoom[]; readonly connect: HandInteriorConnect[]; readonly exit: { readonly room: string; readonly x?: number; readonly width?: number };
  readonly notes: string[];
  readonly styleVariant?: InteriorStyleVariant;
}

const DEFAULT_SIZE: Record<string, [number, number]> = {
  genkan: [4, 3], entrance: [5, 4], hall: [6, 4], corridor: [8, 4], toilet: [3, 4], bath: [3, 5], unitbath: [3, 4], dressing: [3, 5],
  bathroom: [4, 5], storeroom: [5, 5], pantry: [4, 5], kitchen: [6, 5], bedroom: [6, 5], kids: [6, 5], washitsu: [6, 5], study: [6, 5],
  living: [8, 6], ldk: [8, 7], dining: [7, 6], great_hall: [12, 8], tavern: [10, 7], shop: [9, 6],
};
/** 지나다니는 방 — 문 나무의 가지가 여기서 뻗는다. 나머지(화장실·욕실·침실…)는 끝방이 되도록 점수를 준다. */
const HUB = /^(genkan|entrance|hall|corridor|ldk|living|great_hall|tavern|dining|waiting_room|.*_shop|shop|konbini|supermarket|chapel|throne_room|engine_hall|casino|theater|common|museum_lobby|museum_gallery|ship_crew|ship_gundeck|arena_floor|arena_stands|shoegenkan|lobby|elevatorhall|open-?office|concourse|postlobby|hosp-lobby|hosp-corridor|annexcorridor|towerlobby|freeoffice|dept-atrium|dept-vip-hall|mart-sales-hall|subway-platform|subway-concourse|cinema-lobby|rest-dining-hall|gallery-lobby|gallery-paintings|karaoke-hall|sento-changing|hotel-lobby|bank-hall|bank-teller|clinic-waiting|civic-hall|civic-counter|lib-lobby|lib-stacks|elem-corridor|elem-genkan)$/u;
// 손님이 드는 방(가게·주점·대청)이 복도보다 먼저 — 여관이 복도로 들어가 주점을 거치게 짜였다(2026-10-09).
// jp_city 시설(2026-10-14): 학교 昇降口·사무 빌딩 로비·병원 외래 대기실이 거리 문 쪽 방.
// 박물관은 매표 홀, 배는 선원 칸(위 갑판)·화물칸(아래 갑판), 투기장은 무기고(선수 입구)로 든다.
const ENTRANCE_ORDER = [/^genkan$/u, /^entrance$/u, /^(shoegenkan|lobby|hosp-lobby|postlobby|concourse|towerlobby|annexcorridor|dept-atrium|mart-sales-hall|subway-platform|waiting_room|cinema-lobby|rest-dining-hall|gallery-lobby|bank-hall|clinic-waiting|civic-hall|lib-lobby|elem-genkan)$/u, /_shop$|^shop$|^tavern$|^great_hall$|^konbini$|^supermarket$|^common$/u,
  /^museum_lobby$|^ship_crew$|^ship_cargo$|^arena_armory$/u, /^hall$/u, /^corridor$/u, HUB];
/** 기본으로 트는 쌍(종류). */
const OPEN_DEFAULT: [string, string][] = [
  ["genkan", "hall"], ["genkan", "ldk"], ["genkan", "entrance"], ["kitchen", "ldk"], ["kitchen", "dining"], ["arena_stands", "arena_floor"],
  ["dept-vip-hall", "dept-atrium"],
  ["mart-fresh-bakery", "mart-sales-hall"], ["mart-produce", "mart-sales-hall"], ["mart-butcher", "mart-sales-hall"], ["mart-sales-hall", "mart-checkout"],
  ["subway-concourse", "subway-platform"],
  ["house-living", "house-kitchen"], ["espresso-bar", "cafe-hall"],
  ["cinema-arcade-zone", "cinema-lobby"],
  ["rest-kitchen-bar", "rest-dining-hall"], ["rest-bar-lounge", "rest-dining-hall"], ["rest-live-stage", "rest-dining-hall"],
  ["gallery-paintings", "gallery-lobby"],
  ["library-hall", "library-lobby"], ["konbini-floor", "konbini-backroom"], ["book-floor", "manga-cafe"],
  ["izakaya-kitchen", "izakaya-hall"], ["game-crane", "game-floor"], ["karaoke-room", "karaoke-hall"],
  ["hotel-lounge", "hotel-lobby"], ["shrine-haiden", "shrine-genkan"], ["sento-rotenburo", "sento-bathhall"], ["sento-bathhall", "sento-changing"],
  ["open-office", "lobby"], ["lobby", "pantry"], ["studio-floor", "studio-control"], ["hosp-nurse-core", "waiting_room"],
  ["school-corridor", "school-genkan"], ["uni-lecture", "uni-foyer"], ["gym-court", "gym-lobby"],
  ["band-room", "council-room"], ["roof-garden", "rooftop-deck"], ["otel-room", "otel-kitchen"],
  ["aud-hall", "aud-foyer"], ["koban-rest", "koban-office"], ["court-room", "court-lobby"],
  ["parking-lobby", "parking-deck"], ["elev-stair-core", "elev-hall"],
  ["bank-teller", "bank-hall"], ["bank-hall", "bank-atm"],
  ["clinic-waiting", "clinic-pharmacy"],
  ["civic-counter", "civic-hall"], ["civic-hall", "civic-welfare"],
  ["lib-stacks", "lib-lobby"],
  ["elem-corridor", "elem-genkan"], ["shoegenkan", "corridor"],
];
/** 위·아래가 정해진 쌍(종류) — 앞 방이 뒷 방 바로 위(북쪽)에 붙어야 한다. 관중석은 모래 마당을 내려다본다(2026-10-14 조수 시험: 관중석이 마당 아래 딴 방으로 떨어졌다). */
const ABOVE_DEFAULT: [string, string][] = [
  ["arena_stands", "arena_floor"],
  ["elevatorhall", "lobby"],
  ["lounge", "lobby"],
  ["open-office", "hall"],
  ["meeting", "hall"],
  ["lecture", "corridor"],
  ["seminar", "corridor"],
  ["classroom", "corridor"],
  ["council", "corridor"],
  ["dept-vip-hall", "dept-cosmetics"],
  ["dept-vip-hall", "dept-atrium"],
  ["dept-vip-hall", "dept-fashion"],
  ["mart-fresh-bakery", "mart-sales-hall"],
  ["mart-storage", "mart-sales-hall"],
  ["subway-concourse", "subway-platform"],
  ["subway-kiosk", "subway-platform"],
  ["ward-inpatient", "waiting_room"],
  ["ward-exam-1", "waiting_room"],
  ["ward-inpatient", "ward-exam-2"],
  ["cinema-theater", "cinema-lobby"],
  ["cinema-arcade-zone", "cinema-lobby"],
  ["rest-kitchen-bar", "rest-dining-hall"],
  ["rest-live-stage", "rest-dining-hall"],
  ["gallery-paintings", "gallery-lobby"],
  ["gallery-sculpture", "gallery-lobby"],
  ["gallery-sculpture", "gallery-shop"],
  ["bank-teller", "bank-hall"],
  ["bank-vault", "bank-atm"],
  ["clinic-exam", "clinic-waiting"],
  ["clinic-treatment", "clinic-pharmacy"],
  ["civic-counter", "civic-hall"],
  ["civic-records", "civic-welfare"],
  ["lib-stacks", "lib-lobby"],
  ["lib-study", "lib-media"],
  ["elem-class-1", "elem-corridor"],
  ["elem-class-2", "elem-corridor"],
  ["elem-music", "elem-corridor"],
  ["elem-nurse", "elem-genkan"],
];
/** 왼·오른이 정해진 쌍(종류) — 앞 방이 뒷 방 바로 왼쪽(서쪽)에 붙어야 한다. */
const LEFT_DEFAULT: [string, string][] = [
  ["open-office", "meeting"],
  ["pantry", "hall"],
  ["elevatorhall", "lounge"],
  ["dept-cosmetics", "dept-atrium"],
  ["dept-atrium", "dept-fashion"],
  ["mart-fresh-bakery", "mart-storage"],
  ["subway-concourse", "subway-kiosk"],
  ["ward-inpatient", "ward-exam-1"],
  ["ward-exam-2", "waiting_room"],
  ["cinema-theater", "cinema-arcade-zone"],
  ["rest-kitchen-bar", "rest-live-stage"],
  ["gallery-paintings", "gallery-sculpture"],
  ["gallery-lobby", "gallery-shop"],
  ["lecture", "seminar"],
  ["bank-teller", "bank-vault"],
  ["bank-hall", "bank-atm"],
  ["clinic-exam", "clinic-treatment"],
  ["clinic-waiting", "clinic-pharmacy"],
  ["civic-counter", "civic-records"],
  ["civic-hall", "civic-welfare"],
  ["lib-stacks", "lib-study"],
  ["lib-lobby", "lib-media"],
  ["elem-class-1", "elem-class-2"],
  ["elem-class-2", "elem-music"],
  ["elem-corridor", "elem-genkan"],
];
/** 이웃이면 문으로 함께 잇는 쌍(순환 동선). */
const PREFER_DEFAULT: [string, string][] = [
  ["dept-cosmetics", "dept-atrium"],
  ["dept-atrium", "dept-fashion"],
  ["subway-concourse", "subway-kiosk"],
  ["ward-exam-2", "waiting_room"],
  ["hosp-ward-west", "hosp-nurse-core"],
  ["hosp-nurse-core", "hosp-ward-east"],
  ["gallery-paintings", "gallery-sculpture"],
  ["gallery-lobby", "gallery-shop"],
];
/** 일본 집·현대 도시·캠퍼스 문 기물(사양에 있을 때만). */
const DOOR_OF: Record<string, { h?: string; v?: string }> = {
  toilet: { h: "door-open-toilet", v: "door-side-western" }, washitsu: { h: "fusuma-open", v: "door-side-sliding" },
  bath: { v: "door-side-sliding" }, dressing: { v: "door-side-sliding" }, unitbath: { h: "door-open-toilet", v: "door-side-western" },
  // modern_city(도쿄풍 현대 도시) 실내 — 병동·대기 복도는 병원 미닫이, 뒷방·창고는 철문, 회의실·로비·오피스는 유리문/나무문.
  ward: { h: "mci-door-hospital" }, "ward-inpatient": { h: "mci-door-hospital" }, "ward-exam-1": { h: "mci-door-hospital" }, "ward-exam-2": { h: "mci-door-hospital" },
  "hosp-or-1": { h: "mci-door-hospital" }, "hosp-or-2": { h: "mci-door-hospital" }, "hosp-icu": { h: "mci-door-hospital" }, "hosp-imaging": { h: "mci-door-hospital" },
  "hosp-ward-west": { h: "mci-door-hospital" }, "hosp-ward-east": { h: "mci-door-hospital" }, "hosp-vip-ward": { h: "mci-door-hospital" },
  "hosp-nurse-core": { h: "mci-door-glass" }, "hosp-pharmacy": { h: "mci-door-hospital" }, "hosp-er": { h: "mci-door-hospital" },
  "elev-cabin-1": { h: "elev-car-door" }, "elev-cabin-2": { h: "elev-car-door" }, "elev-stair-core": { h: "mci-door-steel" },
  waiting_room: { h: "mci-door-hospital" }, backroom: { h: "mci-door-steel" }, "mart-storage": { h: "mci-door-steel" },
  "school-infirmary": { h: "mci-door-hospital" }, "roof-machine": { h: "mci-door-steel" }, "council-storage": { h: "mci-door-steel" },
  meeting: { h: "mci-door-glass" }, "open-office": { h: "mci-door-glass" }, elevatorhall: { h: "mci-door-glass" }, lounge: { h: "mci-door-glass" }, pantry: { h: "mci-door-wood" },
  "cinema-theater": { h: "mci-door-glass" }, "gallery-sculpture": { h: "mci-door-glass" },
  // modern_campus(현대 학교·캠퍼스) 실내 — 강의실·세미나실·교실·학생회실은 교실 미닫이문.
  lecture: { h: "sc-classroom-door" }, seminar: { h: "sc-classroom-door" }, classroom: { h: "sc-classroom-door" }, council: { h: "sc-classroom-door" },
  staffroom: { h: "sc-classroom-door", v: "door-side-sliding" }, infirmary: { h: "sc-classroom-door", v: "door-side-sliding" }, schooltoilet: { h: "door-open-toilet", v: "door-side-western" },
  musicroom: { h: "sc-classroom-door", v: "door-side-sliding" }, library: { h: "sc-classroom-door", v: "door-side-sliding" }, sciencelab: { h: "sc-classroom-door", v: "door-side-sliding" },
  "bank-vault": { h: "of-fire-door", v: "door-side-western" },
  "clinic-exam": { h: "door-open-western", v: "door-side-sliding" }, "clinic-treatment": { h: "door-open-western", v: "door-side-sliding" },
  "civic-records": { h: "of-glass-door", v: "door-side-western" },
  "lib-study": { h: "sc-classroom-door", v: "door-side-sliding" }, "lib-media": { h: "of-glass-door", v: "door-side-sliding" },
  "elem-class-1": { h: "mci-door-wood" }, "elem-class-2": { h: "mci-door-wood" }, "elem-music": { h: "mci-door-wood" }, "elem-nurse": { h: "mci-door-hospital" },
};


const STYLE_PALETTES: Readonly<Record<string, Readonly<Record<Exclude<InteriorStyleVariant, "A">, { readonly floors: Readonly<Record<string, string>>; readonly walls: Readonly<Record<string, string>> }>>>> = {
  jp_city: {
    B: {
      floors: {
        flooring: "flooring-dark",
        "flooring-dark": "flooring",
        "of-lobby-stone": "po-floor",
        "of-carpet-tile": "flooring-dark",
        "po-floor": "of-lobby-stone",
        "hs-floor-sheet": "pb-linoleum",
        "sc-classroom-wood": "flooring-dark",
        "sc-corridor": "sc-classroom-wood",
      },
      walls: {
        cloth: "cloth-beige",
        "cloth-beige": "cloth",
        "of-lobby-wall": "po-wall",
        "of-wall": "cloth-beige",
        "po-wall": "of-lobby-wall",
        "hs-wall": "hs-wall-room",
        "sc-wall": "sc-wall-tile",
      },
    },
    C: {
      floors: {
        flooring: "carpet",
        "flooring-dark": "carpet",
        "of-lobby-stone": "st-concourse",
        "of-carpet-tile": "of-lobby-stone",
        "po-floor": "of-carpet-tile",
        "hs-floor-sheet": "hs-floor-ward",
        "sc-classroom-wood": "sc-corridor",
        "sc-corridor": "of-lobby-stone",
      },
      walls: {
        cloth: "juraku",
        "cloth-beige": "juraku",
        "of-lobby-wall": "of-glass-wall",
        "of-wall": "of-lobby-wall",
        "po-wall": "of-wall",
        "hs-wall": "sc-wall-tile",
        "sc-wall": "cloth-beige",
      },
    },
    D: {
      floors: {
        flooring: "flooring-dark",
        "flooring-dark": "tatami",
        "of-lobby-stone": "ht-lobby-floor",
        "of-carpet-tile": "ht-corridor-carpet",
        "po-floor": "flooring-dark",
        "hs-floor-sheet": "of-pantry-tile",
        "sc-classroom-wood": "flooring",
        "sc-corridor": "flooring-dark",
      },
      walls: {
        cloth: "fd-wood-wall",
        "cloth-beige": "fd-wood-wall",
        "of-lobby-wall": "ht-hotel-wall",
        "of-wall": "fd-wood-wall",
        "po-wall": "cloth-beige",
        "hs-wall": "cloth-beige",
        "sc-wall": "fd-wood-wall",
      },
    },
  },
  modern_city: {
    B: {
      floors: {
        "mci-stone-lobby": "mci-wood-oak",
        "mci-carpet-office": "mci-wood-oak",
        "mci-vinyl-store": "mci-stone-lobby",
        "mci-wood-oak": "mci-wood-dark",
        "mci-wood-dark": "mci-stone-lobby",
        "mci-tile-concourse": "mci-stone-lobby",
        "mci-vinyl-hospital": "mci-stone-lobby",
        "mci-tile-small": "mci-vinyl-store",
        "mci-concrete": "mci-tile-concourse",
      },
      walls: {
        "mci-wall-lobby": "mci-wall-home",
        "mci-wall-office": "mci-wall-home",
        "mci-wall-store": "mci-wall-brick",
        "mci-wall-brick": "mci-wall-lobby",
        "mci-wall-tile": "mci-wall-lobby",
        "mci-wall-hospital": "mci-wall-home",
        "mci-wall-home": "mci-wall-brick",
      },
    },
    C: {
      floors: {
        "mci-stone-lobby": "mci-tile-concourse",
        "mci-carpet-office": "mci-tile-concourse",
        "mci-vinyl-store": "mci-tile-concourse",
        "mci-wood-oak": "mci-carpet-office",
        "mci-wood-dark": "mci-tile-concourse",
        "mci-tile-concourse": "mci-concrete",
        "mci-vinyl-hospital": "mci-tile-small",
        "mci-tile-small": "mci-tile-concourse",
      },
      walls: {
        "mci-wall-lobby": "mci-wall-tile",
        "mci-wall-office": "mci-wall-lobby",
        "mci-wall-store": "mci-wall-tile",
        "mci-wall-brick": "mci-wall-metal",
        "mci-wall-tile": "mci-wall-metal",
        "mci-wall-hospital": "mci-wall-tile",
        "mci-wall-home": "mci-wall-office",
      },
    },
    D: {
      floors: {
        "mci-stone-lobby": "mci-wood-dark",
        "mci-carpet-office": "mci-wood-dark",
        "mci-vinyl-store": "mci-wood-oak",
        "mci-wood-oak": "mci-stone-lobby",
        "mci-wood-dark": "mci-carpet-office",
        "mci-tile-concourse": "mci-wood-dark",
        "mci-vinyl-hospital": "mci-vinyl-store",
        "mci-tile-small": "mci-stone-lobby",
      },
      walls: {
        "mci-wall-lobby": "mci-wall-brick",
        "mci-wall-office": "mci-wall-brick",
        "mci-wall-store": "mci-wall-home",
        "mci-wall-brick": "mci-wall-home",
        "mci-wall-tile": "mci-wall-lobby",
        "mci-wall-hospital": "mci-wall-office",
        "mci-wall-home": "mci-wall-lobby",
      },
    },
  },
  modern_campus: {
    B: {
      floors: { "mc-floor-lino": "mc-floor-parquet", "mc-floor-corridor": "mc-floor-lino", "mc-floor-parquet": "mc-floor-dorm" },
      walls: { "mc-wall-class": "mc-wall-dorm", "mc-wall-corridor": "mc-wall-class", "mc-wall-dorm": "mc-wall-cafe" },
    },
    C: {
      floors: { "mc-floor-lino": "mc-floor-corridor", "mc-floor-corridor": "mc-floor-cafe", "mc-floor-parquet": "mc-floor-lino" },
      walls: { "mc-wall-class": "mc-wall-corridor", "mc-wall-corridor": "mc-wall-tile", "mc-wall-dorm": "mc-wall-corridor" },
    },
    D: {
      floors: { "mc-floor-lino": "mc-floor-dorm", "mc-floor-corridor": "mc-floor-parquet", "mc-floor-parquet": "mc-floor-cafe" },
      walls: { "mc-wall-class": "mc-wall-cafe", "mc-wall-corridor": "mc-wall-dorm", "mc-wall-dorm": "mc-wall-class" },
    },
  },
  atlas_biome_interior: {
    B: {
      floors: { plank: "dplank", boards: "dplank", dplank: "plank", marble: "check", flag: "cobble", earth: "flag" },
      walls: { plaster: "log", stone: "logdark", marblewall: "goldwood", log: "plaster" },
    },
    C: {
      floors: { plank: "marble", boards: "flag", dplank: "check", marble: "dwarf", flag: "marble", earth: "cobble" },
      walls: { plaster: "stone", stone: "marblewall", marblewall: "velvet", log: "stone" },
    },
    D: {
      floors: { plank: "terra", boards: "plank", dplank: "boards", marble: "terra", flag: "dwarf", earth: "terra" },
      walls: { plaster: "goldwood", stone: "plaster", marblewall: "gallery", log: "logdark" },
    },
  },
  sengoku_edo: {
    B: {
      floors: { "se-floor-wood": "se-floor-tatami", "se-floor-tatami": "se-floor-tatami-gold", "se-floor-doma": "se-floor-wood" },
      walls: { "se-wall-board": "se-wall-plaster", "se-wall-fusuma": "se-wall-shoji", "se-wall-plaster": "se-wall-fusuma" },
    },
    C: {
      floors: { "se-floor-wood": "se-floor-tatami-gold", "se-floor-tatami": "se-floor-wood", "se-floor-doma": "se-floor-tatami" },
      walls: { "se-wall-board": "se-wall-shoji", "se-wall-fusuma": "se-wall-fusuma-gold", "se-wall-plaster": "se-wall-board" },
    },
    D: {
      floors: { "se-floor-wood": "se-floor-tatami", "se-floor-tatami": "se-floor-wood", "se-floor-tatami-gold": "se-floor-tatami" },
      walls: { "se-wall-board": "se-wall-fusuma", "se-wall-fusuma": "se-wall-plaster", "se-wall-shoji": "se-wall-fusuma-gold" },
    },
  },
};

function remapMaterial(
  tilesetId: string,
  kind: "floors" | "walls",
  id: string | undefined,
  styleVariant: InteriorStyleVariant,
  S: HandInteriorSpec,
): string | undefined {
  if (!id || styleVariant === "A") return id;
  const next = STYLE_PALETTES[tilesetId]?.[styleVariant]?.[kind][id];
  const table = kind === "floors" ? S.floors : S.walls;
  return next && table[next] ? next : id;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** program 은 건물 id(mc_office)나 그 건물의 맵 key(office-floor — 도구가 맵 이름 「오피스」에서 고른 값) 둘 다 온다 → 건물 id. */
function programBuilding(tilesetId: string, program: string | undefined): string | undefined {
  if (!program) return undefined;
  const byBuilding = roomPrograms(tilesetId);
  return byBuilding[program] ? program : Object.entries(byBuilding).find(([, maps]) => maps.some((m) => m.map === program))?.[0];
}

/** program 변주(modernPresets.ts MODERN_PROGRAM_VARIATION) — seed 1 은 견본 그대로, 그 뒤로 동↔서 뒤집기·바닥 벽면 묶음·큰 방 넓히기. */
function programVariation(tilesetId: string, req: LayoutRequest): { v: ModernProgramVariation; k: number; flip: boolean; palette?: Readonly<Record<string, readonly [string, string]>> } | undefined {
  const building = programBuilding(tilesetId, req.program);
  const v = (req.program ? MODERN_PROGRAM_VARIATION[tilesetId]?.[req.program] : undefined)
    ?? (building ? MODERN_PROGRAM_VARIATION[tilesetId]?.[building] : undefined);
  if (!v) return undefined;
  const k = Math.max(0, Math.floor(req.seed ?? 1) - 1);
  const p = k % (v.palettes.length + 1);
  return { v, k, flip: k % 2 === 1, ...(p ? { palette: v.palettes[p - 1] } : {}) };
}

/** bw·bh 는 seed 변주로 넓히기 전 견본 크기 - 줄 배치(rows)는 이 합으로 규모 규격 크기를 지키고, 넓힌 만큼은 칸막이 자리만 옮긴다. */
interface Want { id: string; kind: string; tw: number; th: number; bw: number; bh: number; minW: number; minH: number; floor?: string; wall?: string; template?: InteriorRoomTemplate; dress?: HallDress }
interface Rect { x: number; y: number; w: number; h: number }

/** 바깥 출구 틈을 내지 않는 방 — 전철 차내는 남쪽 벽이 좌석·문 그림이라 틈이 좌석 사이에 났다(J45). 드나들기는 벽면의 차 문(st-car-door) 앞 칸이다. */
const NO_EXTERIOR_EXIT_KINDS: ReadonlySet<string> = new Set(["traincar"]);

export class LayoutError extends Error { constructor(message: string) { super(message); this.name = "LayoutError"; } }

/** 요청 → 방 목록(목표 크기·견본). */
export function layoutWants(tilesetId: string, req: LayoutRequest): Want[] {
  let rooms: LayoutRoomRequest[] = [...(req.rooms ?? [])];
  if (!rooms.length && req.program) {
    const p = programKinds(tilesetId, req.program);
    if (!p) throw new LayoutError(`방 구성 "${req.program}" 이 없다 — list_interior_programs 로 찾거나 rooms 로 방 종류를 직접 준다`);
    rooms = p.kinds.map((kind) => ({ kind }));
  }
  if (!rooms.length) throw new LayoutError("program 또는 rooms(방 종류 목록)를 준다");
  const seen = new Map<string, number>();
  const r = rng((req.seed ?? 1) * 7919);
  const vary = programVariation(tilesetId, req);
  const jr = rng((req.seed ?? 1) * 104729);
  // 화풍: program 이면 그 예제 맵의 묶음, 아니면 방 종류들이 가장 많이 나오는 묶음.
  const P = req.program ? programKinds(tilesetId, req.program) : undefined;
  let style = P ? templateStyle({ map: P.map }) : undefined;
  const programBuilding = P ? roomTemplates(tilesetId).find((t) => t.map === P.map)?.building : undefined;
  if (!style) {
    const votes = new Map<string, number>();
    for (const q of rooms) for (const t of roomTemplates(tilesetId)) if (t.kind === q.kind) votes.set(templateStyle(t), (votes.get(templateStyle(t)) ?? 0) + 1);
    style = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  return rooms.map((q) => {
    const n = (seen.get(q.kind) ?? 0) + 1; seen.set(q.kind, n);
    const id = q.id ?? (n === 1 ? q.kind : `${q.kind}${n}`);
    const near = q.w && q.h ? { w: q.w, h: q.h } : undefined;
    const all = templatesOfKind(tilesetId, q.kind, near, style);
    // 화풍 묶음이 없는 칩셋(jp_city 등)에서 program 이면 그 예제 맵 → 같은 건물의 견본을 먼저 쓴다
    // (2026-10-14: 사옥 자유석 층 program 의 엘리베이터 홀에 호텔 붉은 카펫·금빛 문, 학교 1층 복도에 다른 건물 나무 복도가 들어왔다).
    const ownMap = P && style === "any" ? all.filter((t) => t.map === P.map) : [];
    const ownBuilding = P && style === "any" && !ownMap.length ? all.filter((t) => t.building === programBuilding) : [];
    const pool = ownMap.length ? ownMap : ownBuilding.length ? ownBuilding : all;
    // 크기를 주지 않았으면 같은 종류 견본 중 하나를 고른다(seed 마다 다른 견본 — 같은 집이 반복되지 않게).
    const forced = q.template ? roomTemplates(tilesetId).find((t) => t.id === q.template && t.kind === q.kind) : undefined;
    const template = forced ?? (near ? pool[0] : pool[Math.floor(r() * pool.length)]);
    const [dw, dh] = DEFAULT_SIZE[q.kind] ?? (/_shop$/u.test(q.kind) ? DEFAULT_SIZE.shop! : [6, 5]);
    // 변주 seed 면 큰 방을 조금 넓혀 가구 간격을 바꾼다(견본보다 작아지지는 않는다).
    const grow = vary && vary.k > 0 && !near && !vary.v.fixed?.includes(q.kind);
    const tw0 = q.w ?? template?.w ?? dw, th0 = q.h ?? template?.h ?? dh;
    const tw = tw0 + (grow && tw0 >= 10 ? Math.floor(jr() * 4) : 0), th = th0 + (grow && th0 >= 8 ? Math.floor(jr() * 2) : 0);
    const pal = vary?.palette?.[q.kind];
    // 세로는 벽면 두 줄 + 걸을 바닥 — 작은 방(복도·현관·화장실·욕실)은 바닥 2줄, 나머지는 3줄 이상(2026-10-08: 바닥 2줄짜리 여관 방이 납작했다).
    // 단, 2×2 내려가는 계단통(stairwell)이 든 복도·홀은 남쪽에 착지 통로 1줄이 더 필요하므로 최소 높이 5칸(바닥 3줄)을 확보한다.
    const hasStairwell = Boolean(template?.items.some((it) => it.t === "o" && /stairwell/u.test(it.id)));
    const small = !hasStairwell && /^(hall|corridor|genkan|toilet|bath|unitbath|dressing|cell)$/u.test(q.kind);
    const minH = Math.max(small ? 4 : 5, Math.min(th, small ? 4 : 5));
    // 견본 폭을 가로지르는 띠(선로·물길 같은 넓이 키트 't' 가 x 0 에서 견본 폭 끝까지)가 든 방은 견본보다 좁아지면 띠가 통째로 빠진다
    // (2026-10-25 J45: 승강장이 15칸으로 잘려 16칸 선로·승강장 끝 줄·승차 표시가 모두 빠졌다) — 그 방의 최소 폭은 견본 폭이다.
    const spansWidth = Boolean(template?.items.some((it) => it.t === "t" && it.x === 0 && (it.w ?? 0) >= template.w));
    return { id, kind: q.kind, tw, th: Math.max(th, minH), bw: tw0, bh: Math.max(th0, minH), minW: spansWidth ? tw : Math.max(2, Math.min(tw, 3) - (tw <= 2 ? 1 : 0)), minH,
      floor: q.floor ?? pal?.[0] ?? template?.floor, wall: q.wall ?? pal?.[1] ?? template?.wall, template };
  });
}

function pickEntrance(wants: Want[], req: LayoutRequest): string {
  if (req.entrance) {
    const hit = wants.find((w) => w.id === req.entrance) ?? wants.find((w) => w.kind === req.entrance);
    if (!hit) throw new LayoutError(`entrance "${req.entrance}" 이 방 목록에 없다`);
    return hit.id;
  }
  for (const re of ENTRANCE_ORDER) { const hit = wants.find((w) => re.test(w.kind)); if (hit) return hit.id; }
  return wants[0]!.id;
}

/** 사각형을 방 묶음으로 재귀 분할. 출구 방이 든 쪽은 늘 아래(가로로 가를 때). */
function slice(rect: Rect, list: Want[], entrance: string, r: () => number): Map<string, Rect> | null {
  if (list.length === 1) {
    const w = list[0]!;
    return rect.w >= w.minW && rect.h >= w.minH ? new Map([[w.id, rect]]) : null;
  }
  const area = (ws: Want[]) => ws.reduce((s, w) => s + w.tw * w.th, 0);
  const total = area(list);
  const vertical = rect.w > rect.h * (0.9 + r() * 0.6);
  const options: { k: number; dev: number }[] = [];
  for (let k = 1; k < list.length; k++) options.push({ k, dev: Math.abs(area(list.slice(0, k)) / total - 0.5) + r() * 0.15 });
  options.sort((a, b) => a.dev - b.dev);
  for (const { k } of options.slice(0, 3)) {
    let A = list.slice(0, k), B = list.slice(k);
    if (vertical) {
      const wA = Math.round((rect.w - 1) * area(A) / total), wB = rect.w - 1 - wA;
      if (wA < Math.max(...A.map((w) => w.minW)) || wB < Math.max(...B.map((w) => w.minW))) continue;
      const a = slice({ x: rect.x, y: rect.y, w: wA, h: rect.h }, A, entrance, r), b = a && slice({ x: rect.x + wA + 1, y: rect.y, w: wB, h: rect.h }, B, entrance, r);
      if (a && b) return new Map([...a, ...b]);
    } else {
      if (A.some((w) => w.id === entrance)) [A, B] = [B, A];             // 출구 방 쪽이 아래
      const hA = Math.round((rect.h - 1) * area(A) / total), hB = rect.h - 1 - hA;
      if (hA < Math.max(...A.map((w) => w.minH)) || hB < Math.max(...B.map((w) => w.minH))) continue;
      const a = slice({ x: rect.x, y: rect.y, w: rect.w, h: hA }, A, entrance, r), b = a && slice({ x: rect.x, y: rect.y + hA + 1, w: rect.w, h: hB }, B, entrance, r);
      if (a && b) return new Map([...a, ...b]);
    }
  }
  return null;
}

/**
 * 아래에서 위로 짜는 분할(2026-10-09) — 방마다 목표 크기(견본 크기)를 먼저 정하고, 둘씩 묶을 때 가로면 너비를 더하고(+칸막이 1)
 * 높이는 큰 쪽, 세로면 그 반대로 바깥 크기를 정한다. 그래서 어떤 방도 견본보다 작아지지 않는다(작아지면 가구가 빠지거나 엉킨다).
 * 작은 쪽은 남는 만큼 늘어나고, 건물 바깥에 닿은 남는 부분은 trimToTarget 이 깎아 ㄱ·ㄷ자 외곽이 된다.
 */
interface Tree { w: number; h: number; leaf?: Want; vertical?: boolean; a?: Tree; b?: Tree }
function buildTree(list: Want[], entrance: string, r: () => number): Tree {
  if (list.length === 1) return { w: list[0]!.tw, h: list[0]!.th, leaf: list[0]! };
  const area = (ws: Want[]) => ws.reduce((s, w) => s + w.tw * w.th, 0);
  const total = area(list);
  const options: { k: number; dev: number }[] = [];
  for (let k = 1; k < list.length; k++) options.push({ k, dev: Math.abs(area(list.slice(0, k)) / total - 0.5) + r() * 0.2 });
  options.sort((x, y) => x.dev - y.dev);
  const k = options[Math.min(options.length - 1, Math.floor(r() * Math.min(2, options.length)))]!.k;
  let A = list.slice(0, k), B = list.slice(k);
  const ta0 = buildTree(A, entrance, r), tb0 = buildTree(B, entrance, r);
  // 가로로 붙일지 세로로 쌓을지: 바깥 상자가 덜 길쭉하고 덜 비는 쪽(조금 무작위)
  const cost = (w: number, h: number) => w * h - (ta0.w * ta0.h + tb0.w * tb0.h) + Math.max(w / h, h / w) * 6 + r() * 6;
  const vw = ta0.w + 1 + tb0.w, vh = Math.max(ta0.h, tb0.h), hw = Math.max(ta0.w, tb0.w), hh = ta0.h + 1 + tb0.h;
  const vertical = cost(vw, vh) < cost(hw, hh);
  let ta = ta0, tb = tb0;
  if (!vertical && A.some((w) => w.id === entrance)) { [A, B] = [B, A]; [ta, tb] = [tb, ta]; }   // 출구 방 쪽이 아래
  return vertical ? { w: vw, h: vh, vertical, a: ta, b: tb } : { w: hw, h: hh, vertical, a: ta, b: tb };
}
function placeTree(t: Tree, rect: Rect, out: Map<string, Rect>, r: () => number) {
  if (t.leaf) { out.set(t.leaf.id, rect); return; }
  const extra = t.vertical ? rect.w - t.w : rect.h - t.h;
  const toA = Math.round(extra * r());
  if (t.vertical) {
    const wA = t.a!.w + toA;
    placeTree(t.a!, { x: rect.x, y: rect.y, w: wA, h: rect.h }, out, r);
    placeTree(t.b!, { x: rect.x + wA + 1, y: rect.y, w: rect.w - wA - 1, h: rect.h }, out, r);
  } else {
    const hA = t.a!.h + toA;
    placeTree(t.a!, { x: rect.x, y: rect.y, w: rect.w, h: hA }, out, r);
    placeTree(t.b!, { x: rect.x, y: rect.y + hA + 1, w: rect.w, h: rect.h - hA - 1 }, out, r);
  }
}

/**
 * 가른 칸이 목표보다 크면 건물 바깥에 닿은 변(위·왼쪽·오른쪽, 출구 방이 아니면 아래도)을 목표 크기까지 깎는다 —
 * 깎인 자리는 건물 밖이 되어 바깥 모양이 ㄱ·ㄷ자로 꺾인다. 큰 방이 텅 비는 것(2026-10-08 시험: 복도 11×7)을 막는다.
 */
function trimToTarget(rects: Map<string, Rect>, wants: Want[], entrance: string, W: number, H: number) {
  for (const w of wants) {
    const rc = rects.get(w.id)!;
    let extraW = rc.w - w.tw, extraH = rc.h - w.th;
    if (extraW >= 2) {
      const left = rc.x === 1, right = rc.x + rc.w - 1 === W;
      if (right) { const cut = left ? Math.ceil(extraW / 2) : extraW; rc.w -= cut; extraW -= cut; }
      if (left && extraW >= 1) { rc.x += extraW; rc.w -= extraW; }
    }
    if (extraH >= 2) {
      const top = rc.y === 1, bottom = rc.y + rc.h - 1 === H && w.id !== entrance;
      if (top) { const cut = bottom ? Math.ceil(extraH / 2) : extraH; rc.y += cut; rc.h -= cut; extraH -= cut; }
      if (bottom && extraH >= 1) rc.h -= extraH;
    }
  }
}

/**
 * 바깥 변을 깎고도 목표보다 2칸 넘게 큰 방은 안쪽 변(다른 방과 맞댄 변)도 깎는다 — 이웃과의 맞닿음(문을 낼 수 있는 이웃 쌍)이 그대로일 때만.
 * 깎인 띠는 두꺼운 벽(2칸 이상 틈)이 된다. 왜(2026-10-28 interior 장부 56·57 후속): 나무 배치는 형제 방을 같은 폭으로 늘려
 * 견본 6×6 입학 홀이 8×8 로 늘고 맨바닥 52% 가 됐다 — 바깥에 안 닿은 방은 trimToTarget 이 못 깎았다.
 */
function trimInner(rects: Map<string, Rect>, wants: Want[], entrance: string) {
  const sig = (m: Map<string, Rect>, id: string) => adjacency(m).filter((e) => e.a === id || e.b === id).map((e) => `${[e.a, e.b].sort().join("|")}:${e.kind}`).sort().join(",");
  for (const w of wants) {
    const rc = rects.get(w.id)!;
    const before = sig(rects, w.id);
    const tryCut = (next: Rect) => {
      const trial = new Map(rects); trial.set(w.id, next);
      if (sig(trial, w.id) !== before) return false;
      rects.set(w.id, next); return true;
    };
    for (let extra = rc.w - w.tw; extra >= 2; extra = rects.get(w.id)!.w - w.tw) {
      const r = rects.get(w.id)!;
      if (!tryCut({ ...r, w: r.w - extra }) && !tryCut({ ...r, x: r.x + extra, w: r.w - extra }) && !tryCut({ ...r, w: r.w - Math.ceil(extra / 2) }) && !tryCut({ ...r, x: r.x + Math.ceil(extra / 2), w: r.w - Math.ceil(extra / 2) })) break;
    }
    for (let extra = rects.get(w.id)!.h - w.th; extra >= 2; extra = rects.get(w.id)!.h - w.th) {
      const r = rects.get(w.id)!;
      const down = w.id !== entrance;   // 출구 방은 아래 변(출구)을 지킨다
      if (!tryCut({ ...r, y: r.y + extra, h: r.h - extra }) && !(down && tryCut({ ...r, h: r.h - extra })) && !tryCut({ ...r, y: r.y + Math.ceil(extra / 2), h: r.h - Math.ceil(extra / 2) }) && !(down && tryCut({ ...r, h: r.h - Math.ceil(extra / 2) }))) break;
    }
  }
}

interface Edge { a: string; b: string; kind: "h" | "v" }
function adjacency(rects: Map<string, Rect>): Edge[] {
  const out: Edge[] = [];
  const ids = [...rects.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = rects.get(ids[i]!)!, B = rects.get(ids[j]!)!;
    const [top, bot] = A.y + A.h + 1 === B.y ? [A, B] : B.y + B.h + 1 === A.y ? [B, A] : [];
    if (top && bot && Math.min(top.x + top.w, bot.x + bot.w) - Math.max(top.x, bot.x) >= 1) { out.push({ a: ids[i]!, b: ids[j]!, kind: "h" }); continue; }
    const [lft, rgt] = A.x + A.w + 1 === B.x ? [A, B] : B.x + B.w + 1 === A.x ? [B, A] : [];
    if (lft && rgt && Math.min(lft.y + lft.h, rgt.y + rgt.h) - Math.max(lft.y, rgt.y) >= 3) out.push({ a: ids[i]!, b: ids[j]!, kind: "v" });
  }
  return out;
}

const matches = (w: Want, key: string) => w.id === key || w.kind === key;

/**
 * 줄 배치 → 방 사각형. 줄마다 방을 왼쪽부터 칸막이 한 칸씩 띄워 놓고, 줄 높이는 그 줄 견본 높이(bh) 중 가장 큰 값, 줄 너비는 견본 너비(bw)로 가장 넓은 줄에 맞춘다 -
 * 견본 크기 합이 규모 규격(venueScale.ts)이라 seed 가 바뀌어도 맵 크기는 규격 그대로다. seed 변주로 넓힌 너비(tw - bw)는 그 줄의 남는 너비 안에서만
 * 앞 방부터 받고 나머지는 견본이 가장 넓은 방이 받는다 - 칸막이 자리가 seed 마다 옮겨 가구 간격이 바뀐다. 줄에 없는 방이 있거나 없는 방 종류를 부르면 undefined.
 * `void:N` 칸은 방 없이 N칸(칸막이 포함)을 건물 밖으로 남긴다, ragged 면 방이 줄 높이로 늘지 않는다, trim 은 방 종류별로 높이를 줄인다(줄 끝 방의 아래가 건물 밖) - 모두 네모가 아닌 외곽(ㄱ·ㄷ·ㅗ자·계단형)을 만든다.
 */
function rowRects(rows: readonly (readonly string[])[], wants: readonly Want[], ragged = false, trim: Readonly<Record<string, number>> = {}): Map<string, Rect> | undefined {
  type Cell = Want | { gap: number };
  const isGap = (c: Cell): c is { gap: number } => "gap" in c;
  const pool = [...wants];
  const grid: Cell[][] = [];
  for (const row of rows) {
    const line: Cell[] = [];
    for (const key of row) {
      const gap = /^void:(\d+)$/u.exec(key);
      if (gap) { line.push({ gap: Number(gap[1]) }); continue; }
      const i = pool.findIndex((w) => matches(w, key));
      if (i < 0) return undefined;
      line.push(pool.splice(i, 1)[0]!);
    }
    if (!line.some((c) => !isGap(c))) return undefined;
    grid.push(line);
  }
  if (pool.length) return undefined;
  const baseWidth = (line: readonly Cell[]) => line.reduce((s, c) => s + (isGap(c) ? c.gap : c.bw + 1), -1);
  const W = Math.max(...grid.map(baseWidth));
  const out = new Map<string, Rect>();
  let y = 1;
  for (let rowIdx = 0; rowIdx < grid.length; rowIdx++) {
    const cells = grid[rowIdx]!;
    const line = cells.filter((c): c is Want => !isGap(c));
    const h = Math.max(...line.map((w) => w.bh));
    const widest = line.reduce((a, w) => (w.bw > a.bw ? w : a), line[0]!);
    // 가장 넓은 방(15칸 이상)은 3칸까지 내어 준다 - 규격 너비를 꽉 채운 줄에서도 칸막이가 옮겨 간다(14칸 레스토랑 주방은 11칸이면 가구 하나가 빠졌다).
    let budget = W - baseWidth(cells) + (line.length > 1 && widest.bw >= 15 ? 3 : 0);
    const widths = new Map(line.map((w) => {
      const g = w === widest ? 0 : Math.min(Math.max(0, w.tw - w.bw), budget);
      budget -= g;
      return [w, w.bw + g] as const;
    }));
    widths.set(widest, widest.bw + W - baseWidth(cells) - line.reduce((s, w) => s + (w === widest ? 0 : widths.get(w)! - w.bw), 0));
    let x = 1;
    const isLastRow = rowIdx === grid.length - 1;
    for (const c of cells) {
      if (isGap(c)) { x += c.gap; continue; }
      const ww = widths.get(c)!;
      const ch = Math.min(trim[c.kind] ?? Infinity, isLastRow && ragged ? c.bh : h);
      const ry = rowIdx === 0 && grid.length > 1 ? y + (h - ch) : y;
      out.set(c.id, { x, y: ry, w: ww, h: ch });
      x += ww + 1;
    }
    y += h + 1;
  }
  return out;
}

/** 배치 후보를 점수 순으로(낮을수록 좋다). */
function buildCandidatesForVariant(
  tilesetId: string,
  req: LayoutRequest,
  S: HandInteriorSpec,
  styleVariant: InteriorStyleVariant,
  limit: number,
): LayoutCandidate[] {
  const vary0 = programVariation(tilesetId, req);
  const hallWants: Want[] = vary0?.v.hall && vary0.v.rows?.some((row) => row.includes(HALL_KIND))
    ? [{ id: HALL_KIND, kind: HALL_KIND, tw: 8, th: HALL_H, bw: 8, bh: HALL_H, minW: 3, minH: HALL_H, floor: HALL_DRESS[vary0.v.hall].floor, wall: HALL_DRESS[vary0.v.hall].wall, dress: vary0.v.hall }]
    : [];
  const baseWants = [...layoutWants(tilesetId, req), ...hallWants];
  const vary = programVariation(tilesetId, req);
  const entrance = pickEntrance(baseWants, req.entrance || !vary?.v.entrance ? req : { ...req, entrance: vary.v.entrance });
  const keepKinds = new Set(vary?.v.keepMaterials ?? []);
  const keptIds = baseWants.filter((w) => keepKinds.has(w.kind)).map((w) => w.id);
  const explicitFloorIds = new Set([...(req.rooms ?? []).filter((q) => q.floor).map((q) => q.id ?? q.kind), ...keptIds]);
  const explicitWallIds = new Set([...(req.rooms ?? []).filter((q) => q.wall).map((q) => q.id ?? q.kind), ...keptIds]);
  const wants: Want[] = baseWants.map((w, idx) => {
    const isEnt = w.id === entrance;
    const fixed = Boolean(vary?.v.fixed?.includes(w.kind));
    const addW = fixed ? 0 : styleVariant === "C" ? (isEnt ? 4 : idx % 2 === 0 ? 2 : 0) : styleVariant === "D" ? (isEnt ? 2 : idx % 2 === 1 ? 2 : 0) : 0;
    const addH = fixed ? 0 : styleVariant === "C" ? (!isEnt && idx === 0 ? 2 : 0) : styleVariant === "D" ? (isEnt ? 2 : idx === 0 ? 1 : 0) : 0;
    const floor0 = explicitFloorIds.has(w.id) ? w.floor : remapMaterial(tilesetId, "floors", w.floor, styleVariant, S);
    const wall0 = explicitWallIds.has(w.id) ? w.wall : remapMaterial(tilesetId, "walls", w.wall, styleVariant, S);
    // 벽면 두 줄이 바닥과 같은 색이면 구분이 안 된다(R20) - 방이 직접 지정한 재질이 아니면 대비가 모자란 쌍을 가장 가까운 재질로 바꾼다.
    const pair = tilesetId === "modern_city" && !explicitFloorIds.has(w.id) && !explicitWallIds.has(w.id) ? contrastPair(floor0, wall0) : { floor: floor0, wall: wall0 };
    return { ...w, tw: w.tw + addW, th: w.th + addH, floor: pair.floor, wall: pair.wall };
  });
  // program 이 위아래를 뒤집는 쌍은 기본 표의 반대 쌍을 뺀다(지하철역: 승강장이 대합실 위). program 만의 쌍은 기본 표보다 무겁게 본다.
  const aboveRules: Pair[] = vary?.v.above
    ? ABOVE_DEFAULT.filter(([p, q]) => !vary.v.above!.some(([a, b]) => a === q && b === p))
    : ABOVE_DEFAULT;
  const isHub = (kind: string) => HUB.test(kind) || Boolean(vary?.v.hubs?.includes(kind));
  const byId = new Map(wants.map((w) => [w.id, w]));
  const pairTuple = (x: Pair): readonly [string, string] => ("a" in x ? [x.a, x.b] : x);
  const pairOf = (list: readonly Pair[] | undefined) => (list ?? []).map(pairTuple).flatMap(([p, q]) =>
    wants.filter((w) => matches(w, p)).flatMap((a) => wants.filter((w) => w !== a && matches(w, q)).map((b) => [a.id, b.id] as [string, string])));
  const programOpen = pairOf(vary?.v.open);
  const sealedPairs = pairOf(vary?.v.sealed);
  const prefer = [...pairOf(req.prefer), ...pairOf(PREFER_DEFAULT)];
  const openPairs = [...pairOf(req.open), ...programOpen, ...pairOf(OPEN_DEFAULT)];
  const isOpen = (a: string, b: string) => openPairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  const mirrorHorizontal = req.styleVariant ? (styleVariant === "B" || styleVariant === "D") : (styleVariant === "B" || styleVariant === "D" || Boolean(vary?.flip));
  const leftRules: Pair[] = vary?.v.left
    ? LEFT_DEFAULT.filter(([p, q]) => !vary.v.left!.some(([a, b]) => a === p || b === q || (a === q && b === p)))
    : LEFT_DEFAULT;
  const leftPairs = pairOf(leftRules);
  const programAbove = pairOf(vary?.v.above), programLeft = pairOf(vary?.v.left);
  const total = wants.reduce((s, w) => s + w.tw * w.th, 0);
  const scaleKey = tilesetId === "modern_city" ? programBuilding(tilesetId, req.program) : undefined;
  const scale = scaleKey ? VENUE_SCALE_CONTRACT[scaleKey] : undefined;
  const variantSeedOffset = styleVariant === "A" ? 0 : styleVariant === "B" ? 101 : styleVariant === "C" ? 202 : 303;
  const r = rng((req.seed ?? 1) + variantSeedOffset);
  const found = new Map<string, LayoutCandidate>();
  // program 이 줄 배치(rows)를 주면 첫 시도는 그 줄 배치 그대로다 — 견본 방 크기 합이 규모 규격이라 seed 1 이 규격 크기로 선다. 나머지 시도는 다른 배치 후보(variant 1·2…).
  const rowPlan = vary?.v.rows ? rowRects(vary.v.rows, wants, vary.v.ragged, vary.v.trim) : undefined;
  let rowKey: string | undefined;
  for (let trial = 0; trial < 600 && found.size < 60; trial++) {
    const order = [...wants];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
    const ar = styleVariant === "C" ? 1.35 + r() * 0.55 : styleVariant === "D" ? 0.95 + r() * 0.45 : 1.05 + r() * 0.75;
    const slack = 1 + order.length * 0.06;
    let W = Math.max(...wants.map((w) => w.minW), Math.round(Math.sqrt(total * slack * ar)));
    let H = Math.max(...wants.map((w) => w.minH), Math.ceil(total * slack / W));
    if (req.maxWidth) W = Math.min(W, req.maxWidth - 2);
    if (req.maxHeight) H = Math.min(H, req.maxHeight - 2);
    let rects: Map<string, Rect> | null;
    const fromRows = trial === 0 && rowPlan !== undefined;
    if (trial === 0 && rowPlan) rects = new Map([...rowPlan].map(([id, q]) => [id, { ...q }]));
    else if (trial % 2 === 0) {
      const tree = buildTree(order, entrance, r);
      if ((req.maxWidth && tree.w > req.maxWidth - 2) || (req.maxHeight && tree.h > req.maxHeight - 2)) continue;
      rects = new Map(); placeTree(tree, { x: 1, y: 1, w: tree.w, h: tree.h }, rects, r);
      W = tree.w; H = tree.h;
    } else rects = slice({ x: 1, y: 1, w: W, h: H }, order, entrance, r);
    if (!rects) continue;
    if (!fromRows) { trimToTarget(rects, wants, entrance, W, H); trimInner(rects, wants, entrance); }
    {
      const mx = Math.min(...[...rects.values()].map((q) => q.x)) - 1, my = Math.min(...[...rects.values()].map((q) => q.y)) - 1;
      for (const q of rects.values()) { q.x -= mx; q.y -= my; }
    }
    const BW = Math.max(...[...rects.values()].map((q) => q.x + q.w)) + 1, BH = Math.max(...[...rects.values()].map((q) => q.y + q.h)) + 1;
    // program 이 막은 쌍(sealed)은 이웃이어도 문을 내지 않는다 — 남탕↔여탕·로비↔목욕 홀(2026-10-25 센토 남녀 분리).
    const edges = adjacency(rects).filter((e) => !sealedPairs.some(([p, q]) => (p === e.a && q === e.b) || (p === e.b && q === e.a)));
    const prio = (e: Edge, from: string) => {
      const to = e.a === from ? e.b : e.a;
      return (prefer.some(([p, q]) => (p === from && q === to) || (p === to && q === from)) ? 0 : 4) + (isOpen(from, to) ? 0 : 1) + (isHub(byId.get(to)!.kind) ? 0 : 2);
    };
    const reached = new Set([entrance]); const tree: Edge[] = [];
    for (const allowLeafPass of [false, true]) {
      let frontier = [...reached];
      while (frontier.length) {
        const next: string[] = [];
        for (const from of frontier) {
          if (!allowLeafPass && from !== entrance && !isHub(byId.get(from)!.kind)) continue;
          const out = edges.filter((e) => (e.a === from || e.b === from) && !reached.has(e.a === from ? e.b : e.a)).sort((x, y) => prio(x, from) - prio(y, from));
          for (const e of out) { const to = e.a === from ? e.b : e.a; if (reached.has(to)) continue; reached.add(to); tree.push(e); next.push(to); }
        }
        frontier = next;
      }
      if (reached.size === wants.length) break;
    }
    if (reached.size !== wants.length) continue;
    const deg: Record<string, number> = {}; for (const e of tree) { deg[e.a] = (deg[e.a] ?? 0) + 1; deg[e.b] = (deg[e.b] ?? 0) + 1; }
    for (const [p, q] of [...prefer, ...programOpen]) {
      const e = edges.find((x) => (x.a === p && x.b === q) || (x.a === q && x.b === p));
      if (e && !tree.includes(e)) tree.push(e);
    }
    let score = 0;
    const notes: string[] = [];
    for (const w of wants) {
      const rc = rects.get(w.id)!;
      const short = Math.max(0, w.tw - rc.w) + Math.max(0, w.th - rc.h), extra = Math.max(0, rc.w - w.tw) + Math.max(0, rc.h - w.th);
      score += (short * 3 + extra * 1.5) / (w.tw + w.th) * 4;
      const asp = Math.max(rc.w / rc.h, rc.h / rc.w), maxAsp = Math.max(2.6, w.tw / w.th, w.th / w.tw);
      if (asp > maxAsp && !/hall|corridor/u.test(w.kind)) score += (asp - maxAsp) * 2;
      // 견본에 벽 속으로 오르는 계단·에스컬레이터가 있는 방은 건물 맨 북쪽 줄에 — 아래 줄이면 칸막이 속으로 올라 옆방으로 들어간다(2026-10-18 병원 seed 4·8 입원 병동).
      if ([...rects.values()].some((q) => q !== rc && q.y < rc.y && q.x < rc.x + rc.w && rc.x < q.x + q.w) && w.template?.items.some((it) => it.t === "o" && S.objects[it.id]?.kind === "wall" && S.objects[it.id]?.stairs)) { score += 12; notes.push(`${w.id} 의 벽 속 계단이 칸막이에 박힌다 — 맨 북쪽 줄이 아니다`); }
    }
    {
      const roomArea = [...rects.values()].reduce((a, q) => a + q.w * q.h, 0);
      score += Math.max(0, (BW - 2) * (BH - 2) - roomArea * 1.25) / total * 6;
      const basp = Math.max(BW / BH, BH / BW);
      if (basp > 1.7) score += (basp - 1.7) * 3;
      // 규모 규격이 있는 program 은 그 크기에 맞춘 배치를 고른다 - 견본 방 크기 합이 규격이라 맞는 배치가 있다(작아지는 쪽을 무겁게).
      if (scale) score += Math.max(0, scale.w - BW) * 3 + Math.max(0, scale.h - BH) * 3 + Math.max(0, BW - scale.w) * 0.75 + Math.max(0, BH - scale.h) * 0.75;
    }
    for (const [p, q] of prefer) if (!edges.some((e) => (e.a === p && e.b === q) || (e.a === q && e.b === p))) { score += 3; notes.push(`${p}–${q} 이 이웃이 아니다`); }
    for (const [p, q] of openPairs) if (!edges.some((e) => (e.a === p && e.b === q) || (e.a === q && e.b === p))) score += 1.5;
    for (const [weight, rules] of [[6, pairOf(aboveRules)], [20, programAbove]] as const) for (const [p, q] of rules) {
      const up = rects.get(p)!, dn = rects.get(q)!;
      if (!edges.some((e) => e.kind === "h" && ((e.a === p && e.b === q) || (e.a === q && e.b === p))) || up.y > dn.y) { score += weight; notes.push(`${p} 가 ${q} 바로 위가 아니다`); }
    }
    for (const [weight, rules] of [[6, leftPairs], [20, programLeft]] as const) for (const [p, q] of rules) {
      const lft = rects.get(p)!, rgt = rects.get(q)!;
      if (!edges.some((e) => e.kind === "v" && ((e.a === p && e.b === q) || (e.a === q && e.b === p))) || lft.x > rgt.x) { score += weight; notes.push(`${p} 가 ${q} 바로 왼쪽이 아니다`); }
    }
    for (const w of wants) if (!isHub(w.kind) && w.id !== entrance && (deg[w.id] ?? 0) > 1) { score += 2.5; notes.push(`${w.id} 를 지나가야 다른 방에 간다`); }
    const openSpan = 5;
    const connect: HandInteriorConnect[] = tree.map((e) => {
      const A = byId.get(e.a)!, B = byId.get(e.b)!;
      if (isOpen(e.a, e.b)) {
        const lower = rects.get(e.a)!.y > rects.get(e.b)!.y ? A : B;
        const span = openSpan;
        return e.kind === "h" && !/^(genkan|entrance)$/u.test(lower.kind) ? { a: e.a, b: e.b, open: true, span } : { a: e.a, b: e.b, open: true };
      }
      const door = DOOR_OF[A.kind]?.[e.kind] ?? DOOR_OF[B.kind]?.[e.kind];
      return { a: e.a, b: e.b, ...(door && S.objects[door] ? { door } : vary?.v.plainDoorways ? { door: "none" } : {}) };
    });
    // 변주 seed 의 동↔서 뒤집기는 점수를 다 매긴 뒤 결과 좌표에만 한다 — 왼·오른 쌍 규칙까지 거울로 뒤집힌 배치가 된다.
    const rooms: LayoutRoom[] = wants.map((w) => {
      const rc = rects.get(w.id)!;
      const x0 = mirrorHorizontal ? BW - rc.x - rc.w : rc.x;
      return { id: w.id, kind: w.kind, x0, y0: rc.y, x1: x0 + rc.w - 1, y1: rc.y + rc.h - 1, ...(w.floor ? { floor: w.floor } : {}), ...(w.wall ? { wall: w.wall } : {}), ...(w.template ? { template: w.template.id } : {}), ...(w.dress ? { dress: w.dress } : {}) };
    });
    // ㄱ·ㄴ자 방 - 바닥 줄 방(남쪽이 건물 밖 벽, 아래 이웃 없음) 중 큰 방의 한 귀퉁이를 구조 코어(설비 샤프트·벽장)로 도려 낸다. 이웃 방 쪽 귀퉁이와 출구 방은 피한다.
    if ((tilesetId === "modern_city" || tilesetId === "jp_city") && req.program && rooms.length >= 3) {
      rooms.forEach((rm, i) => {
        const rw = rm.x1 - rm.x0 + 1, rh = rm.y1 - rm.y0 + 1;
        if (rm.kind === HALL_KIND) return;
        const over = (q: LayoutRoom) => q !== rm && q.x0 <= rm.x1 && q.x1 >= rm.x0;
        const below = rooms.some((q) => over(q) && q.y0 > rm.y1), above = rooms.some((q) => over(q) && q.y1 < rm.y0);
        const east = rooms.some((q) => q !== rm && q.x0 === rm.x1 + 2 && q.y0 <= rm.y1 && q.y1 >= rm.y0);
        const west = rooms.some((q) => q !== rm && q.x1 === rm.x0 - 2 && q.y0 <= rm.y1 && q.y1 >= rm.y0);
        const notches: HandInteriorNotch[] = [];
        if (rm.id === entrance) {
          // 현관 홈(vestibule) - 넓은 출구 방의 남쪽 두 귀퉁이를 막아 출구 쪽이 좁아진 ㅜ자 로비로 만든다.
          const vw = styleVariant === "C" ? 2 : 3;
          if (!below && rw >= 12 && rh >= 7) { if (!east) notches.push({ corner: "se", w: vw, h: 2 }); if (!west) notches.push({ corner: "sw", w: vw, h: 2 }); }
        } else if (!isHub(rm.kind)) {
          // ㄱ·ㄴ자 방 - 남쪽이 바깥벽인 큰 방은 한 귀퉁이를 구조 코어로, 북쪽이 바깥벽인 큰 방은 북쪽 귀퉁이를 벽장·설비실 덩이로 도려 낸다.
          if (!below && rw >= 10 && rh >= 8 && (!east || !west)) notches.push({ corner: !east ? "se" : "sw", w: 3, h: 3 });
          else if (!above && rw >= 12 && rh >= 9 && (!east || !west)) notches.push({ corner: !east ? "ne" : "nw", w: 3, h: 2 });
        }
        if (notches.length) rooms[i] = { ...rm, notches };
      });
    }
    const exitRoom = rooms.find((rm) => rm.id === entrance) ?? rooms[0]!;
    const exitW = exitRoom.x1 - exitRoom.x0 + 1;
    const exitX = styleVariant === "B" && exitW >= 8
      ? exitRoom.x0 + Math.max(2, Math.floor(exitW * 0.28))
      : styleVariant === "C" && exitW >= 8
        ? exitRoom.x0 + Math.min(exitW - 3, Math.floor(exitW * 0.72))
        : styleVariant === "D" && exitW >= 8
          ? exitRoom.x0 + Math.max(2, Math.floor(exitW * 0.36))
          : undefined;
    const key = `${styleVariant}|` + rooms.map((x) => `${x.id}:${x.x0},${x.y0},${x.x1},${x.y1}:${x.floor ?? ""}`).join("|");
    if (fromRows) rowKey = key;
    if (!found.has(key)) {
      found.set(key, {
        width: BW,
        height: BH,
        score: Math.round(score * 100) / 100,
        rooms,
        connect,
        exit: { room: entrance, ...(vary?.v.noExteriorExit || NO_EXTERIOR_EXIT_KINDS.has(exitRoom.kind) ? { width: 0 } : exitX !== undefined ? { x: exitX } : {}) },
        notes,
        styleVariant,
      });
    }
  }
  if (!found.size) throw new LayoutError(`방 ${wants.length}개를 ${req.maxWidth ?? "?"}×${req.maxHeight ?? "?"} 안에 배치하지 못했다 — 방 수를 줄이거나 크기 제한을 푼다`);
  const ranked = [...found.values()].sort((a, b) => a.score - b.score);
  const rowCand = rowKey ? found.get(rowKey) : undefined;
  return (rowCand ? [rowCand, ...ranked.filter((c) => c !== rowCand)] : ranked).slice(0, limit);
}

/** 배치 후보를 점수 순으로(낮을수록 좋다). count>1 이고 styleVariant 미지정이면 A/B/C/D 구조·색감 변형을 차례로 담는다. */
export function layoutCandidates(tilesetId: string, req: LayoutRequest, S: HandInteriorSpec, count = 3): LayoutCandidate[] {
  if (req.styleVariant || count <= 1) {
    return buildCandidatesForVariant(tilesetId, req, S, req.styleVariant ?? "A", count);
  }
  const variants: readonly InteriorStyleVariant[] = ["A", "B", "C", "D"];
  const out: LayoutCandidate[] = [];
  for (const sv of variants) {
    const cands = buildCandidatesForVariant(tilesetId, req, S, sv, 2);
    if (cands[0]) out.push(cands[0]);
  }
  if (out.length < count) {
    for (const extra of buildCandidatesForVariant(tilesetId, req, S, "A", count)) {
      if (out.length >= count) break;
      if (!out.includes(extra)) out.push(extra);
    }
  }
  return out.slice(0, count);
}

/** 후보 미리보기 — 방마다 글자 하나(A,B,…), 칸막이 '#', 문 '+'. */
export function layoutAscii(c: LayoutCandidate, plan: readonly string[]): string[] {
  const g = plan.map((row) => [...row]);
  c.rooms.forEach((rm, i) => {
    const ch = String.fromCharCode(65 + (i % 26));
    for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) if (g[y]![x] === ".") g[y]![x] = ch;
  });
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y]!.length; x++) if (g[y]![x] === ".") g[y]![x] = "+";
  return g.map((row) => row.join(""));
}
