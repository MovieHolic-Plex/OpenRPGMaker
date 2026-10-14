// 던전 종류(type) 정의 — 종류마다 「배치 문법(grammar)」·방 종류·키트 매핑이 다르다(2026-10-14 사용자: 「던전 종류가 좀 다양해야 할 것 같다」).
// 팔레트만 바꾸는 것이 아니다: 문법이 다르다(방+통로 나무 / 미로 / 불규칙 동굴 방 / 대칭 신전 / 광산 갱도 / 하수도 수로).
// 그림은 번들 시트의 기존 조각만 쓴다(sewer/sea-cave/temple/volcano/mining 키트). 모자란 조각은 profiles 의 MISSING 에 적는다.
import type { DungeonRoomInput } from "./compose";
import { rng } from "./grid";

export const DUNGEON_TYPES = ["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano"] as const;
export type DungeonType = (typeof DUNGEON_TYPES)[number];
export type DungeonGrammar = "rooms" | "maze" | "blob";

export const DUNGEON_ROOM_KINDS = [
  "entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault",   // 지하묘지·성
  "channel", "cistern", "pump",                                                // 하수도
  "cavern", "lake", "grotto", "forge",                                         // 동굴·화산
  "nave",                                                                      // 신전
  "junction", "stope", "depot",                                                // 광산·미궁
] as const;
export type DungeonRoomKind = (typeof DUNGEON_ROOM_KINDS)[number];

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

export interface TypeProfile {
  readonly id: DungeonType;
  readonly label: string;
  /** 사용자 말 → 종류(intentDeclaration·tool 설명이 쓴다). */
  readonly words: readonly string[];
  readonly grammar: DungeonGrammar;
  readonly roomKinds: readonly DungeonRoomKind[];
  readonly face: { readonly h3: string; readonly h2: string };
  readonly floor: FloorSpec;
  readonly liquid?: "water" | "lava";
  readonly blurb: string;
}

const S = (id: string) => `bd-pick-aqueduct-sewer-${id}`;
const C = (id: string) => `bd-pick-sea-cave-${id}`;
const T = (id: string) => `bd-pick-temple-ruins-${id}`;
const K = (id: string) => `bd-pick-castle-catacombs-${id}`;
const M = (id: string) => `bd-pick-mining-valley-${id}`;

export const PROFILES: Record<DungeonType, TypeProfile> = {
  catacomb: {
    id: "catacomb", label: "지하묘지·지하 감옥", words: ["지하묘지", "카타콤", "묘지", "납골", "지하 감옥", "감옥", "던전", "지하", "미궁 아닌"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault"],
    face: { h3: S("face-cata-3h"), h2: S("face-cata-2h") },
    floor: { base: S("floor-cata"), patches: [{ kit: S("floor-darkcata"), at: 0.7 }, { kit: S("floor-sewer"), at: 0.82, scale: 3 }], scatter: [{ kit: S("floor-bone"), p: 0.025 }], byKind: { crypt: S("floor-bone"), cell: K("floor-cell") } },
    blurb: "이끼 낀 회색 석벽 지하 묘지. 방+통로 나무 모양(큰 홀·묘실·감방·제단·창고·보물 방·보스방).",
  },
  castle: {
    id: "castle", label: "성 지하·성채", words: ["성채", "성 지하", "성 지하실", "지하 성", "마왕성", "요새", "성"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault"],
    face: { h3: K("face-castle-3h"), h2: K("face-castle-2h") },
    floor: { base: K("floor-castle"), patches: [{ kit: S("floor-cata"), at: 0.72 }, { kit: S("floor-darkcata"), at: 0.85, scale: 3 }], scatter: [{ kit: K("floor-cell"), p: 0.02 }], byKind: { cell: K("floor-cell") } },
    blurb: "다듬은 석벽의 성 지하(감옥·창고·제단·보스방). catacomb 와 같은 방+통로 문법, 밝은 판석 바닥.",
  },
  labyrinth: {
    id: "labyrinth", label: "미궁(미로)", words: ["미궁", "미로", "labyrinth", "maze"],
    grammar: "maze", roomKinds: ["entrance", "boss", "vault", "junction", "storage", "shrine"],
    face: { h3: S("face-cata-3h"), h2: S("face-cata-2h") },
    floor: { base: S("floor-darkcata"), patches: [{ kit: S("floor-cata"), at: 0.7 }, { kit: S("floor-sewer"), at: 0.84, scale: 3 }], scatter: [{ kit: S("floor-bone"), p: 0.03 }] },
    blurb: "굽이치는 갈림길 통로 미로(막다른 길 보물·한가운데 보스). 격자 간격으로 통로 폭 3칸 고정.",
  },
  sewer: {
    id: "sewer", label: "하수도·수로", words: ["하수도", "수로", "수도교", "배수", "지하 수로", "waterworks", "sewer"],
    grammar: "rooms", roomKinds: ["entrance", "channel", "cistern", "pump", "hall", "storage", "boss", "vault", "crypt"],
    face: { h3: S("face-sewer-3h"), h2: S("face-sewer-2h") },
    floor: { base: S("floor-sewer"), patches: [{ kit: S("floor-cata"), at: 0.68 }, { kit: S("floor-darkcata"), at: 0.84, scale: 3 }], scatter: [{ kit: S("floor-plank"), p: 0.012 }], shore: S("floor-darkcata") },
    liquid: "water",
    blurb: "수로가 가로지르는 지하 하수도(수로 방은 양옆 보행로 + 다리, 저수조 섬, 펌프실). 물은 막힘 — 다리·보행로로만 건넌다.",
  },
  cave: {
    id: "cave", label: "자연 동굴", words: ["동굴", "굴", "cave", "cavern", "지하 호수", "종유"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "grotto", "boss", "vault"],
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: C("floor-cave"), patches: [{ kit: C("floor-wetsand"), at: 0.66 }, { kit: C("floor-sand"), at: 0.84, scale: 3 }], scatter: [{ kit: C("glow-moss-floor"), p: 0.0 }], shore: C("floor-wetsand") },
    liquid: "water",
    blurb: "불규칙한 동굴 방(둥글게 번진 방 + 굽은 넓은 통로), 지하 호수, 석순·버섯·이끼 빛. 지름길 고리 하나.",
  },
  temple: {
    id: "temple", label: "폐허 신전", words: ["신전", "사원", "유적", "폐허", "temple", "ruin", "성소"],
    grammar: "rooms", roomKinds: ["entrance", "nave", "shrine", "crypt", "boss", "vault", "storage", "hall"],
    face: { h3: T("face-temple-3h"), h2: T("face-temple-2h") },
    floor: { base: T("floor-ruin"), patches: [{ kit: T("floor-trav"), at: 0.66 }], byKind: { boss: T("floor-trav"), vault: T("floor-trav") } },
    blurb: "좌우 대칭 신전(현관 → 열주 늘어선 신랑 → 제단 안쪽 성소, 곁방), 군데군데 무너진 구역·덩굴·이끼.",
  },
  mine: {
    id: "mine", label: "광산 갱도", words: ["광산", "갱도", "갱", "탄광", "채굴", "mine", "mining"],
    grammar: "rooms", roomKinds: ["entrance", "junction", "stope", "depot", "boss", "vault", "storage"],
    face: { h3: C("face-cave-3h"), h2: C("face-cave-2h") },
    floor: { base: M("ground-rock"), patches: [{ kit: M("ground-slagg"), at: 0.76, scale: 5 }, { kit: C("floor-cave"), at: 0.84, scale: 3 }], scatter: [{ kit: C("floor-wetsand"), p: 0.02 }] },
    blurb: "수평 주 갱도(한 줄 대로) + 갈래 갱 + 채굴장(광석 덩이·광차·램프). 입구는 갱구.",
  },
  volcano: {
    id: "volcano", label: "화산 동굴", words: ["화산", "용암", "화염", "불의 동굴", "volcano", "lava", "magma"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "forge", "grotto", "boss", "vault"],
    face: { h3: K("face-castle-3h"), h2: K("face-castle-2h") },
    floor: { base: M("ground-slagg"), patches: [{ kit: C("floor-wetsand"), at: 0.7, scale: 5 }, { kit: M("ground-rock"), at: 0.92, scale: 3 }], shore: C("floor-wetsand") },
    liquid: "lava",
    blurb: "용암 못·용암 강이 있는 화산 동굴(재 바닥, 흑요석 뾰족돌, 열 구멍, 옛 대장간 방). 용암은 막힘 — 안전한 길·다리가 보장된다.",
  },
};

export const MISSING: Record<string, string[]> = {
  volcano: ["현무암·재 바닥 2×2 변형 3종(금 간 틈에 불씨)", "현무암 벽 앞면 3h/2h", "용암 가장자리 식은 껍질 오토타일"],
  mine: ["선로 타일(가로·세로·모서리 4·T)", "갱목 지지대(벽 걸이 1×2·바닥 기둥 1×2)", "광맥 벽 앞면 변형", "채굴장 벽 광석 장식"],
  cave: ["갈색 테두리 동굴 천장 오토타일(지금은 회색 석벽 띠)", "종유석 천장 늘어짐"],
  ice: ["얼음 동굴 전부(바닥·벽·천장·빙판·고드름) — beodeul_city 에는 없다. snow_north 의 ice-cave 실내 한 방만 별도 칩셋에 있다"],
};

/** 사용자 말에서 던전 종류 추정(첫 번째로 맞는 낱말, 더 구체적인 종류가 앞). 얼음은 null + iceRequested. */
export function inferDungeonType(text: string): { type: DungeonType | null; iceRequested: boolean } {
  const t = text.toLowerCase();
  const iceRequested = /얼음|빙하|빙굴|설원 동굴|ice|frozen|glacier/.test(t);
  const order: DungeonType[] = ["labyrinth", "sewer", "mine", "volcano", "temple", "castle", "catacomb", "cave"];
  for (const id of order) {
    if (PROFILES[id].words.some((w) => w && t.includes(w.toLowerCase()))) {
      // 「하수도 미로」처럼 둘이 같이 나오면 하수도(미로 문법 선택은 layout 인자)
      if (id === "labyrinth" && /하수도|수로|sewer/.test(t)) return { type: "sewer", iceRequested };
      return { type: id, iceRequested };
    }
  }
  return { type: null, iceRequested };
}

// ---------- 방 구성(rooms 를 주지 않았을 때) ----------

const sized = (spec: { size?: "small" | "medium" | "large"; width?: number; height?: number }): number => {
  const bySize = { small: 4, medium: 6, large: 9 } as const;
  const area = spec.width && spec.height ? spec.width * spec.height : 0;
  return area ? Math.max(3, Math.min(11, Math.round(area / 260))) : bySize[spec.size ?? "medium"];
};

/** 하수도: 입구 → 수로 방 → (저수조·펌프실 곁방) → … → 보스(둥지) → 보물. */
export function planSewer(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number }): DungeonRoomInput[] {
  const n = sized(spec), random = rng((spec.seed ?? 7) * 7907 + 3);
  const rooms: DungeonRoomInput[] = [{ id: "entrance", kind: "entrance" }, { id: "channel1", kind: "channel", w: 26 + Math.floor(random() * 6), h: 11, from: "entrance", dir: "N" }];
  if (n >= 4) rooms.push({ id: "cistern", kind: "cistern", from: "channel1", dir: random() < 0.5 ? "W" : "E" });
  if (n >= 5) rooms.push({ id: "pump", kind: "pump", from: "channel1", dir: "N" });
  if (n >= 7) rooms.push({ id: "channel2", kind: "channel", w: 22 + Math.floor(random() * 6), h: 11, from: "pump", dir: random() < 0.5 ? "W" : "E" });
  if (n >= 8) rooms.push({ id: "storage", kind: "storage", from: "cistern" });
  rooms.push({ id: "boss", kind: "boss", from: rooms.some((r) => r.id === "channel2") ? "channel2" : rooms.some((r) => r.id === "pump") ? "pump" : "channel1", dir: "N" });
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", from: "boss" });
  return rooms;
}

/** 신전: 현관 → 신랑 → 성소(축 위 한 줄) + 신랑 좌우 곁방(대칭) + 성소 좌우 납골실·뒤 보물 방. 모든 곁방은 shift 0 으로 대칭. */
export function planTemple(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number }): DungeonRoomInput[] {
  const n = sized(spec);
  const rooms: DungeonRoomInput[] = [
    { id: "porch", kind: "entrance", w: 15, h: 7 },
    { id: "nave", kind: "nave", w: 17, h: 19, from: "porch", dir: "N", shift: 0, len: 5 },
    { id: "sanctum", kind: "boss", w: 17, h: 11, from: "nave", dir: "N", shift: 0, len: 5 },
  ];
  if (n >= 4) { rooms.push({ id: "chapelW", kind: "shrine", w: 11, h: 9, from: "nave", dir: "W", shift: 0, len: 5 }, { id: "chapelE", kind: "shrine", w: 11, h: 9, from: "nave", dir: "E", shift: 0, len: 5 }); }
  if (n >= 8) { rooms.push({ id: "ossuaryW", kind: "crypt", w: 11, h: 8, from: "sanctum", dir: "W", shift: 0, len: 5 }, { id: "ossuaryE", kind: "crypt", w: 11, h: 8, from: "sanctum", dir: "E", shift: 0, len: 5 }); }
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", w: 11, h: 7, from: "sanctum", dir: "N", shift: 0, len: 5 });
  return rooms;
}

/** 광산: 갱구(입구) → 동쪽으로 주 갱도(갈림 방 junction 줄) → 위·아래 채굴장(stope) → 끝 심부(보스) + 보물. */
export function planMine(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number }): DungeonRoomInput[] {
  const n = sized(spec), random = rng((spec.seed ?? 7) * 6151 + 5);
  const rooms: DungeonRoomInput[] = [
    { id: "adit", kind: "entrance", w: 11, h: 7 },
    { id: "j1", kind: "junction", w: 9, h: 7, from: "adit", dir: "E", shift: 0, len: 9 + Math.floor(random() * 3) },
  ];
  const spine = n >= 8 ? 3 : n >= 5 ? 2 : 1;
  for (let i = 2; i <= spine; i += 1) rooms.push({ id: `j${i}`, kind: "junction", w: 9, h: 7, from: `j${i - 1}`, dir: "E", shift: 0, len: 9 + Math.floor(random() * 4) });
  rooms.push({ id: "stopeN", kind: "stope", from: "j1", dir: "N", len: 6 });
  if (n >= 4) rooms.push({ id: "stopeS", kind: "stope", from: spine >= 2 ? "j2" : "j1", dir: "S", len: 6 });
  if (n >= 7) rooms.push({ id: "depot", kind: "depot", from: `j${spine}`, dir: "N", len: 6 });
  rooms.push({ id: "deep", kind: "boss", w: 15, h: 10, from: `j${spine}`, dir: "E", shift: 0, len: 9 });
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", from: "deep", dir: "N", len: 5 });
  return rooms;
}
