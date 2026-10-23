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
  /** 잡음 무늬로 군데군데 바꾸는 바닥(웅덩이 모양 덩이). at = 잡음 문턱(0..1, 위로). */
  readonly patches: readonly { readonly kit: string; readonly at: number; readonly scale?: number }[];
  /** 칸마다 흩뿌리는 바닥(금·이끼·뼈 박힌 칸). p = 확률. */
  readonly scatter?: readonly { readonly kit: string; readonly p: number }[];
  /** 방 종류별 바닥. */
  readonly byKind?: Partial<Record<DungeonRoomKind, KitPref>>;
  /** 물·용암 바로 옆 칸 바닥. */
  readonly shore?: string;
  /** true 면 2×2·3×3 무늬를 칸마다 무작위 한 칸으로 고른다(타일 반복 격자가 눈에 띄는 마른 바닥용). */
  readonly mix?: boolean;
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
    floor: { base: S("floor-cata"), patches: [{ kit: S("floor-darkcata"), at: 0.7 }, { kit: S("floor-sewer"), at: 0.82, scale: 3 }], scatter: [{ kit: S("floor-bone"), p: 0.025 }], byKind: { crypt: S("floor-bone"), cell: K("floor-cell") } },
  },
  castle: {
    ...GRAMMAR.castle,
    face: { h3: K("face-castle-3h"), h2: K("face-castle-2h") },
    floor: { base: K("floor-castle"), patches: [{ kit: S("floor-cata"), at: 0.72 }, { kit: S("floor-darkcata"), at: 0.85, scale: 3 }], scatter: [{ kit: K("floor-cell"), p: 0.02 }], byKind: { cell: K("floor-cell") } },
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
    floor: { base: C("floor-cave"), patches: [{ kit: C("floor-wetsand"), at: 0.66 }, { kit: C("floor-sand"), at: 0.84, scale: 3 }], scatter: [{ kit: C("glow-moss-floor"), p: 0.0 }], shore: C("floor-wetsand"), mix: true },
  },
  temple: {
    ...GRAMMAR.temple,
    face: { h3: T("face-temple-3h"), h2: T("face-temple-2h") },
    floor: { base: T("floor-ruin"), patches: [{ kit: T("floor-trav"), at: 0.66 }], byKind: { boss: T("floor-trav"), vault: T("floor-trav") } },
  },
  mine: {
    ...GRAMMAR.mine,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: C("floor-cave"), patches: [{ kit: M("ground-rock"), at: 0.7, scale: 4 }, { kit: C("floor-wetsand"), at: 0.86, scale: 3 }], scatter: [{ kit: M("ground-rock"), p: 0.02 }], mix: true },
  },
  volcano: {
    ...GRAMMAR.volcano,
    face: { h3: K("face-castle-3h"), h2: K("face-castle-2h") },
    floor: { base: M("ground-slagg"), patches: [{ kit: C("floor-cave"), at: 0.74, scale: 4 }], shore: C("floor-cave"), mix: true },
    bank: "lava",
  },
  // ---- 2026-10-23 dungeon-themes: 새 주제 ----
  ice: {
    ...GRAMMAR.ice,
    face: { h3: [TK("ice-face-3h"), C("face-cave-3h")], h2: [TK("ice-face-2h"), C("face-cave-2h")] },
    floor: { base: SN("ground-snow"), patches: [{ kit: SN("ground-ice"), at: 0.78, scale: 5 }, { kit: SN("ground-plat"), at: 0.86, scale: 3 }], mix: true },
    ceiling: ["beodeul_dungeon_ceiling_ice"],
    lakeFloor: [TK("ice-floor"), SN("ground-ice")],
    // gap 얼음굴 바닥(ice_floor A1, #3283): 얼음굴 돌바닥 오토타일 + 호수 방·덩이는 빙판 오토타일. 벽·천장은 검푸른 심층굴 바위(줄 C).
    autoFloor: { ground: "beodeul_dungeon_ice_ground", sheet: "beodeul_dungeon_ice", sheetAt: 0.74, sheetScale: 5 },
  },
  forest: {
    ...GRAMMAR.forest,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    // 숲 바닥 = 버들항 공용 잔디 칸 737(BEODEUL_PLAIN_GRASS) + 흙길 덩이. 벽 칸은 수관 숲(writeBeodeulCanopy)이 덮는다.
    floor: { base: T("floor-grass"), tile: 737, patches: [], mix: true },   // 흙 덩이는 가장자리 그림이 없어 네모 얼룩으로 읽혔다 — 맨 잔디 + 풀·고사리 장식으로 결을 낸다
    bank: "grass", canopy: "leaf",
    bridge: { ew: SWP("ground-deck"), ns: SWP("ground-deck") },
  },
  swamp: {
    ...GRAMMAR.swamp,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: SWP("ground-mud"), patches: [{ kit: SWP("ground-reedbed"), at: 0.82, scale: 3 }], mix: true },
    bank: "bog", canopy: "leaf",
    bridge: { ew: SWP("ground-deck"), ns: SWP("ground-deck") },
  },
  pyramid: {
    ...GRAMMAR.pyramid,
    face: { h3: [TK("sandstone-face-3h"), T("face-temple-3h")], h2: [TK("sandstone-face-2h"), T("face-temple-2h")] },
    floor: { base: [TK("sandstone-floor"), D("ground-plaza")], patches: [{ kit: D("ground-sand"), at: 0.74, scale: 4 }], byKind: { boss: [TK("sandstone-floor"), D("ground-plaza")] }, mix: true },
    ceiling: ["beodeul_dungeon_ceiling_sand"],
  },
  tower: {
    ...GRAMMAR.tower,
    face: { h3: [TK("tower-face-3h"), K("face-castle-3h")], h2: [TK("tower-face-2h"), K("face-castle-2h")] },
    floor: { base: [TK("tower-floor"), K("floor-castle")], patches: [{ kit: T("floor-trav"), at: 0.8, scale: 4 }], byKind: { library: [TK("tower-floor-wood"), S("floor-plank")] } },
  },
  otherworld: {
    ...GRAMMAR.otherworld,
    face: { h3: [TK("otherworld-face-3h"), C("face-cave-3h")], h2: [TK("otherworld-face-2h"), C("face-cave-2h")] },
    floor: { base: [TK("otherworld-floor"), M("ground-slagg")], patches: [{ kit: S("floor-darkcata"), at: 0.7, scale: 4 }], mix: true },
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
