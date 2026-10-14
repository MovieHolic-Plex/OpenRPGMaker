// 던전 종류(type) 정의 — 종류마다 「배치 문법(grammar)」·방 종류·키트 매핑이 다르다(2026-10-14 사용자: 「던전 종류가 좀 다양해야 할 것 같다」).
// 팔레트만 바꾸는 것이 아니다: 문법이 다르다(방+통로 나무 / 미로 / 불규칙 동굴 방 / 대칭 신전 / 광산 갱도 / 하수도 수로).
// 그림은 번들 시트의 기존 조각만 쓴다(sewer/sea-cave/temple/volcano/mining 키트). 모자란 조각은 profiles 의 MISSING 에 적는다.
import type { DungeonRoomKind, DungeonType } from "../types";
import { GRAMMAR, type GrammarInfo } from "../grammar";

/** 버들항 키트가 그리는 종류(얼음은 그림이 없다 → 거절). */
export type BeodeulDungeonType = Exclude<DungeonType, "ice">;
export const BEODEUL_TYPES: readonly BeodeulDungeonType[] = ["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano"];

export interface FloorSpec {
  readonly base: string;
  /** 잡음 무늬로 군데군데 바꾸는 바닥(웅덩이 모양 덩이). at = 잡음 문턱(0..1, 위로). */
  readonly patches: readonly { readonly kit: string; readonly at: number; readonly scale?: number }[];
  /** 칸마다 흩뿌리는 바닥(금·이끼·뼈 박힌 칸). p = 확률. */
  readonly scatter?: readonly { readonly kit: string; readonly p: number }[];
  /** 방 종류별 바닥. */
  readonly byKind?: Partial<Record<DungeonRoomKind, string>>;
  /** 물·용암 바로 옆 칸 바닥. */
  readonly shore?: string;
}

export interface TypeProfile extends GrammarInfo {
  readonly id: BeodeulDungeonType;
  readonly face: { readonly h3: string; readonly h2: string };
  readonly floor: FloorSpec;
}

const S = (id: string) => `bd-pick-aqueduct-sewer-${id}`;
const C = (id: string) => `bd-pick-sea-cave-${id}`;
const T = (id: string) => `bd-pick-temple-ruins-${id}`;
const K = (id: string) => `bd-pick-castle-catacombs-${id}`;
const M = (id: string) => `bd-pick-mining-valley-${id}`;

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
    floor: { base: C("floor-cave"), patches: [{ kit: C("floor-wetsand"), at: 0.66 }, { kit: C("floor-sand"), at: 0.84, scale: 3 }], scatter: [{ kit: C("glow-moss-floor"), p: 0.0 }], shore: C("floor-wetsand") },
  },
  temple: {
    ...GRAMMAR.temple,
    face: { h3: T("face-temple-3h"), h2: T("face-temple-2h") },
    floor: { base: T("floor-ruin"), patches: [{ kit: T("floor-trav"), at: 0.66 }], byKind: { boss: T("floor-trav"), vault: T("floor-trav") } },
  },
  mine: {
    ...GRAMMAR.mine,
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: C("floor-cave"), patches: [{ kit: M("ground-rock"), at: 0.7, scale: 4 }, { kit: C("floor-wetsand"), at: 0.86, scale: 3 }], scatter: [{ kit: M("ground-rock"), p: 0.02 }] },
  },
  volcano: {
    ...GRAMMAR.volcano,
    face: { h3: K("face-castle-3h"), h2: K("face-castle-2h") },
    floor: { base: M("ground-slagg"), patches: [{ kit: C("floor-wetsand"), at: 0.7, scale: 5 }, { kit: M("ground-rock"), at: 0.92, scale: 3 }], shore: C("floor-wetsand") },
  },
};

export const MISSING: Record<string, string[]> = {
  volcano: ["현무암·재 바닥 2×2 변형 3종(금 간 틈에 불씨)", "현무암 벽 앞면 3h/2h", "용암 가장자리 식은 껍질 오토타일"],
  mine: ["선로 타일(가로·세로·모서리 4·T)", "갱목 지지대(벽 걸이 1×2·바닥 기둥 1×2)", "광맥 벽 앞면 변형", "채굴장 벽 광석 장식"],
  cave: ["갈색 테두리 동굴 천장 오토타일(지금은 회색 석벽 띠)", "종유석 천장 늘어짐"],
  ice: ["얼음 동굴 전부(바닥·벽·천장·빙판·고드름) — beodeul_city 에는 없다. snow_north 의 ice-cave 실내 한 방만 별도 칩셋에 있다"],
};
