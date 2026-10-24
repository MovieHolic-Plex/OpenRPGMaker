// 던전 종류(type) 정의 — 종류마다 「배치 문법(grammar)」·방 종류·키트 매핑이 다르다(2026-10-14 사용자: 「던전 종류가 좀 다양해야 할 것 같다」).
// 팔레트만 바꾸는 것이 아니다: 문법이 다르다(방+통로 나무 / 미로 / 불규칙 동굴 방 / 대칭 신전 / 광산 갱도 / 하수도 수로).
// 그림은 번들 시트의 기존 조각만 쓴다(sewer/sea-cave/temple/volcano/mining 키트). 모자란 조각은 profiles 의 MISSING 에 적는다.
import type { DungeonRoomKind, DungeonType } from "../types";
import { GRAMMAR, type GrammarInfo } from "../grammar";

/** 버들항 키트가 그리는 종류 — 2026-10-23 dungeon-themes 부터 열두 주제 전부. */
export type BeodeulDungeonType = DungeonType;
export const BEODEUL_TYPES: readonly BeodeulDungeonType[] = ["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano", "ice", "forest", "swamp", "pyramid", "tower", "otherworld"];

/** 키트 후보 목록: 앞에서부터 이 타일셋에 있는 첫 키트를 쓴다(새 그림이 구워지면 앞의 id 가 살아난다 — 옛 사본은 뒤의 기존 키트). */
export type KitPref = string | readonly string[];

export interface FloorSpec {
  readonly base: KitPref;
  /** 바닥 칸을 키트 대신 이 칸 번호 하나로(숲 = 버들항 숲 풀 칸). 덩이·흩뿌림 키트는 그 위에 그대로. */
  readonly tile?: number;
  /** 잡음 무늬로 군데군데 바꾸는 바닥(웅덩이 모양 덩이). at = 잡음 문턱(0..1, 위로).
   *  가장자리 그림이 없어 덩이 둘레는 16px 네모로 끊긴다 — 밝기·결이 바탕과 가까운 키트만 쓴다(2026-10-25 floor VQA: 대비 큰 덩이 = 「딱딱한 네모 얼룩」).
   *  scale 은 크게(6~8): 적고 큰 덩이가 「바닥 결의 변화」로 읽힌다. */
  readonly patches: readonly { readonly kit: string; readonly at: number; readonly scale?: number }[];
  /** 칸마다 흩뿌리는 바닥(금·이끼·뼈 박힌 칸). p = 확률. */
  readonly scatter?: readonly { readonly kit: string; readonly p: number }[];
  /** 방 종류별 바닥. */
  readonly byKind?: Partial<Record<DungeonRoomKind, KitPref>>;
  /** 물·용암 바로 옆 칸 바닥. */
  readonly shore?: string;
  /** true 면 2×2·3×3 무늬를 칸마다 무작위 한 칸으로 고른다(타일 반복 격자가 눈에 띄는 마른 바닥용). 무작위 이웃의 이음매가 작가 배치와 같은 키트에만. */
  readonly mix?: boolean;
  /** mix 로 고를 칸 번호(키트 행 우선 평면 번호). 비우면 전부 — 한 칸만 튀는 무늬(금·불씨 줄)가 칸마다 되풀이되던 것을 뺀다(2026-10-25 floor VQA). */
  readonly mixCells?: readonly number[];
}

export interface TypeProfile extends GrammarInfo {
  readonly face: { readonly h3: KitPref; readonly h2: KitPref };
  readonly floor: FloorSpec;
  /** 액체 칸 바닥 무늬(가장자리 없는 물·늪물). 없으면 물 = 운하 오토타일(돌 둑), 용암 = 용암 키트, 허공 = 천장. */
  readonly liquidKit?: KitPref;
  /** 다리 칸(가로·세로). 없으면 돌다리. */
  readonly bridge?: { readonly ew: KitPref; readonly ns: KitPref };
  /** 천장(벽 윗면) 오토타일 그룹 id 후보 — 테마 테두리(사암·얼음·보랏빛)가 구워져 있으면 그것, 없으면 기본 회색 테두리. */
  readonly ceiling?: readonly string[];
  /** 야외 벽(walls: canopy)의 수관 결: leaf 활엽 · snow 눈 덮인 침엽. */
  readonly canopy?: "leaf" | "snow";
  /** 자연 물가(beodeul_nature 둑 덧그림, 2층): 물·용암 칸 위에 둥근 가장자리를 얹는다. grass 풀 둑 · bog 이끼 늪 둑 · lava 흑요석 둑. */
  readonly bank?: "grass" | "bog" | "lava";
  /** 얼어붙은 호수 방(ice 의 lake)의 걷는 빙판 바닥. */
  readonly lakeFloor?: KitPref;
  /** 오토타일 바닥(gap 얼음굴, 2026-10-23): ground = 걷는 바닥 전체, sheet = 호수 방·잡음 덩이에 까는 빙판(가장자리는 이웃 빙판 칸으로). 그룹이 없으면 키트 바닥. */
  readonly autoFloor?: { readonly ground: string; readonly sheet?: string; readonly sheetAt?: number; readonly sheetScale?: number };
}

const S = (id: string) => `bd-pick-aqueduct-sewer-${id}`;
const C = (id: string) => `bd-pick-sea-cave-${id}`;
const T = (id: string) => `bd-pick-temple-ruins-${id}`;
const K = (id: string) => `bd-pick-castle-catacombs-${id}`;
const M = (id: string) => `bd-pick-mining-valley-${id}`;
const D = (id: string) => `bd-pick-desert-oasis-${id}`;
const SN = (id: string) => `bd-pick-snowfield-${id}`;
const SWP = (id: string) => `bd-pick-swamp-stilt-${id}`;
/** 새 테마 그림(dungeon-themes 하네스 굽기, 2026-10-23~) — 구워지기 전에는 hasKit 이 거짓이라 뒤의 기존 키트로 물러선다. */
export const TK = (id: string) => `bd-pick-dungeon-theme-${id}`;

export const PROFILES: Record<BeodeulDungeonType, TypeProfile> = {
  catacomb: {
    ...GRAMMAR.catacomb,
    face: { h3: S("face-cata-3h"), h2: S("face-cata-2h") },
    floor: { base: S("floor-cata"), patches: [{ kit: S("floor-sewer"), at: 0.74, scale: 7 }], byKind: { crypt: S("floor-bone"), cell: K("floor-cell") } },
  },
  castle: {
    ...GRAMMAR.castle,
    face: { h3: K("face-castle-3h"), h2: K("face-castle-2h") },
    floor: { base: K("floor-castle"), patches: [], byKind: { cell: K("floor-cell") } },
  },
  labyrinth: {
    ...GRAMMAR.labyrinth,
    face: { h3: S("face-cata-3h"), h2: S("face-cata-2h") },
    floor: { base: S("floor-darkcata"), patches: [{ kit: S("floor-cata"), at: 0.7 }, { kit: S("floor-sewer"), at: 0.84, scale: 3 }], scatter: [{ kit: S("floor-bone"), p: 0.03 }] },
  },
  sewer: {
    ...GRAMMAR.sewer,
    face: { h3: S("face-sewer-3h"), h2: S("face-sewer-2h") },
    floor: { base: S("floor-sewer"), patches: [{ kit: S("floor-cata"), at: 0.68 }, { kit: S("floor-darkcata"), at: 0.84, scale: 3 }], scatter: [{ kit: S("floor-plank"), p: 0.012 }], shore: S("floor-darkcata") },
  },
  cave: {
    ...GRAMMAR.cave,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: M("ground-road"), patches: [] },   // 바다 동굴 모래 바닥은 칸마다 얼룩 결이라(결 11~18) 잔잔한 회갈색 흙바닥. 젖은 모래 물가 띠는 네모 고리로 읽혀 뺐다
  },
  temple: {
    ...GRAMMAR.temple,
    face: { h3: T("face-temple-3h"), h2: T("face-temple-2h") },
    floor: { base: T("floor-ruin"), patches: [], byKind: { boss: T("floor-trav"), vault: T("floor-trav") } },
  },
  mine: {
    ...GRAMMAR.mine,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: M("ground-yard"), patches: [{ kit: M("ground-yard2"), at: 0.62, scale: 6 }] },
  },
  volcano: {
    ...GRAMMAR.volcano,
    face: { h3: K("face-castle-3h"), h2: K("face-castle-2h") },
    floor: { base: M("ground-slagg"), patches: [], mix: true, mixCells: [0, 1, 3, 4, 5, 6, 7, 8] },   // 칸 2 = 갈색 금 줄(3칸마다 격자로 되풀이됐다)
    bank: "lava",
  },
  // ---- 2026-10-23 dungeon-themes: 새 주제 ----
  ice: {
    ...GRAMMAR.ice,
    face: { h3: [TK("ice-face-3h"), C("face-cave-3h")], h2: [TK("ice-face-2h"), C("face-cave-2h")] },
    floor: { base: SN("ground-snow"), patches: [] },
    ceiling: ["beodeul_dungeon_ceiling_ice"],
    lakeFloor: [TK("ice-floor"), SN("ground-ice")],
    // gap 얼음굴 바닥(ice_floor A1, #3283): 얼음굴 돌바닥 오토타일 + 호수 방·덩이는 빙판 오토타일. 벽·천장은 검푸른 심층굴 바위(줄 C).
    autoFloor: { ground: "beodeul_dungeon_ice_ground", sheet: "beodeul_dungeon_ice", sheetAt: 0.82, sheetScale: 8 },
  },
  forest: {
    ...GRAMMAR.forest,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    // 벽 칸은 수관 숲(writeBeodeulCanopy)이 덮는다.
    // 숲 바닥 잔디: 공용 잔디 737 은 칸마다 같은 풀 무늬가 박혀 16px 격자로 되풀이됐다(2026-10-25 floor VQA r0·r1) — 같은 색(평균 RGB 차 1)의 잔잔한 3×3 오아시스 잔디. 737 그림은 마을·길이 쓰니 건드리지 않는다.
    floor: { base: [D("ground-lawn"), T("floor-grass")], patches: [] },   // 흙 덩이는 가장자리 그림이 없어 네모 얼룩으로 읽혔다 — 맨 잔디 + 풀·고사리 장식으로 결을 낸다
    bank: "grass", canopy: "leaf",
    bridge: { ew: SWP("ground-deck"), ns: SWP("ground-deck") },
  },
  swamp: {
    ...GRAMMAR.swamp,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: SWP("ground-mud"), patches: [] },
    bank: "bog", canopy: "leaf",
    bridge: { ew: SWP("ground-deck"), ns: SWP("ground-deck") },
  },
  pyramid: {
    ...GRAMMAR.pyramid,
    face: { h3: [TK("sandstone-face-3h"), T("face-temple-3h")], h2: [TK("sandstone-face-2h"), T("face-temple-2h")] },
    // 모래 바닥: 칸 0·3·6 = 밝은 세로 줄(3칸마다 되풀이) — 나머지 칸만 섞는다.
    floor: { base: D("ground-camp"), mix: true, mixCells: [1, 2, 4, 5, 7, 8], patches: [{ kit: D("ground-road"), at: 0.68, scale: 7 }], byKind: { boss: [TK("sandstone-floor"), D("ground-plaza")], shrine: [TK("sandstone-floor"), D("ground-plaza")], crypt: [TK("sandstone-floor"), D("ground-plaza")] } },
    ceiling: ["beodeul_dungeon_ceiling_sand"],
  },
  tower: {
    ...GRAMMAR.tower,
    face: { h3: [TK("tower-face-3h"), K("face-castle-3h")], h2: [TK("tower-face-2h"), K("face-castle-2h")] },
    floor: { base: [TK("tower-floor"), K("floor-castle")], patches: [], byKind: { library: [TK("tower-floor-wood"), S("floor-plank")] } },
    ceiling: ["beodeul_dungeon_ceiling_tower"],
  },
  otherworld: {
    ...GRAMMAR.otherworld,
    face: { h3: [TK("otherworld-face-3h"), C("face-cave-3h")], h2: [TK("otherworld-face-2h"), C("face-cave-2h")] },
    floor: { base: [TK("otherworld-floor"), M("ground-slagg")], patches: [], mix: true, mixCells: [1, 5, 7, 10, 14, 17] },   // 분홍 점이 가장 적은 칸(6~7점)만 — 칸 13 붉은 사선 금·점 많은 칸은 「분홍 소금·후추」로 읽혔다(2026-10-25 floor VQA r1)
    ceiling: ["beodeul_dungeon_ceiling_void"],
  },
};

export const MISSING: Record<string, string[]> = {
  forest: ["숲 바닥 오솔길 오토타일(지금은 숲길 키트 무늬)", "자연 물가 연못 가장자리"],
  swamp: ["늪물 자연 물가 가장자리(지금은 가장자리 없는 늪물 무늬)"],
  volcano: ["현무암·재 바닥 2×2 변형 3종(금 간 틈에 불씨)", "현무암 벽 앞면 3h/2h", "용암 가장자리 식은 껍질 오토타일"],
  mine: ["선로 타일(가로·세로·모서리 4·T)", "갱목 지지대(벽 걸이 1×2·바닥 기둥 1×2)", "광맥 벽 앞면 변형", "채굴장 벽 광석 장식"],
  cave: ["갈색 테두리 동굴 천장 오토타일(지금은 회색 석벽 띠)", "종유석 천장 늘어짐"],
  ice: ["얼음 동굴 전부(바닥·벽·천장·빙판·고드름) — beodeul_city 에는 없다. snow_north 의 ice-cave 실내 한 방만 별도 칩셋에 있다"],
};
