// 던전 종류의 「문법 정보」 — 칩셋을 모르는 쪽(2026-10-15 beodeul/profiles.ts 에서 분리).
// 종류 이름·낱말·배치 문법·방 종류·액체·방 구성 계획기. 어느 칩셋이 이 종류를 그릴 수 있는지(키트 매핑)는 어댑터가 따로 가진다.
import { rng } from "./grid";
import type { DungeonGrammar, DungeonRoomInput, DungeonRoomKind, DungeonType } from "./types";

export interface GrammarInfo {
  readonly id: DungeonType;
  readonly label: string;
  /** 사용자 말 → 종류(intentDeclaration·tool 설명이 쓴다). */
  readonly words: readonly string[];
  readonly grammar: DungeonGrammar;
  readonly roomKinds: readonly DungeonRoomKind[];
  readonly liquid?: "water" | "lava";
  readonly blurb: string;
}

export const GRAMMAR: Record<DungeonType, GrammarInfo> = {
  catacomb: {
    id: "catacomb", label: "지하묘지·지하 감옥", words: ["지하묘지", "카타콤", "묘지", "납골", "지하 감옥", "감옥", "던전", "지하", "미궁 아닌"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault"],
    blurb: "이끼 낀 회색 석벽 지하 묘지. 방+통로 나무 모양(큰 홀·묘실·감방·제단·창고·보물 방·보스방).",
  },
  castle: {
    id: "castle", label: "성 지하·성채", words: ["성채", "성 지하", "성 지하실", "지하 성", "마왕성", "요새", "성"],
    grammar: "rooms", roomKinds: ["entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault"],
    blurb: "다듬은 석벽의 성 지하(감옥·창고·제단·보스방). catacomb 와 같은 방+통로 문법, 밝은 판석 바닥.",
  },
  labyrinth: {
    id: "labyrinth", label: "미궁(미로)", words: ["미궁", "미로", "labyrinth", "maze"],
    grammar: "maze", roomKinds: ["entrance", "boss", "vault", "junction", "storage", "shrine"],
    blurb: "굽이치는 갈림길 통로 미로(막다른 길 보물·한가운데 보스). 격자 간격으로 통로 폭 3칸 고정.",
  },
  sewer: {
    id: "sewer", label: "하수도·수로", words: ["하수도", "수로", "수도교", "배수", "지하 수로", "waterworks", "sewer"],
    grammar: "rooms", roomKinds: ["entrance", "channel", "cistern", "pump", "hall", "storage", "boss", "vault", "crypt"],
    liquid: "water",
    blurb: "수로가 가로지르는 지하 하수도(수로 방은 양옆 보행로 + 다리, 저수조 섬, 펌프실). 물은 막힘 — 다리·보행로로만 건넌다.",
  },
  cave: {
    id: "cave", label: "자연 동굴", words: ["동굴", "굴", "cave", "cavern", "지하 호수", "종유"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "grotto", "boss", "vault"],
    liquid: "water",
    blurb: "불규칙한 동굴 방(둥글게 번진 방 + 굽은 넓은 통로), 지하 호수, 석순·버섯·이끼 빛. 지름길 고리 하나.",
  },
  temple: {
    id: "temple", label: "폐허 신전", words: ["신전", "사원", "유적", "폐허", "temple", "ruin", "성소"],
    grammar: "rooms", roomKinds: ["entrance", "nave", "shrine", "crypt", "boss", "vault", "storage", "hall"],
    blurb: "좌우 대칭 신전(현관 → 열주 늘어선 신랑 → 제단 안쪽 성소, 곁방), 군데군데 무너진 구역·덩굴·이끼.",
  },
  mine: {
    id: "mine", label: "광산 갱도", words: ["광산", "갱도", "갱", "탄광", "채굴", "mine", "mining"],
    grammar: "rooms", roomKinds: ["entrance", "junction", "stope", "depot", "boss", "vault", "storage"],
    blurb: "수평 주 갱도(한 줄 대로) + 갈래 갱 + 채굴장(광석 덩이·광차·램프). 입구는 갱구.",
  },
  volcano: {
    id: "volcano", label: "화산 동굴", words: ["화산", "용암", "화염", "불의 동굴", "volcano", "lava", "magma"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "lake", "forge", "grotto", "boss", "vault"],
    liquid: "lava",
    blurb: "용암 못·용암 강이 있는 화산 동굴(재 바닥, 흑요석 뾰족돌, 열 구멍, 옛 대장간 방). 용암은 막힘 — 안전한 길·다리가 보장된다.",
  },
  ice: {
    id: "ice", label: "얼음 동굴", words: ["얼음 동굴", "빙굴", "빙하 동굴", "얼음굴", "얼음", "빙하", "ice cave"],
    grammar: "blob", roomKinds: ["entrance", "cavern", "grotto", "boss", "vault"],
    blurb: "미끄러운 얼음 판이 깔린 눈 덮인 동굴(바위·결정·고드름). 몬스터 키트(monster_dungeon ic_*)만 그린다 — 버들항에는 그림이 없다.",
  },
};

/** 사용자 말에서 던전 종류 추정(첫 번째로 맞는 낱말, 더 구체적인 종류가 앞). 얼음은 null + iceRequested. */
export function inferDungeonType(text: string): { type: DungeonType | null; iceRequested: boolean } {
  const t = text.toLowerCase();
  const iceRequested = /얼음|빙하|빙굴|설원 동굴|ice|frozen|glacier/.test(t);
  const order: DungeonType[] = ["ice", "labyrinth", "sewer", "mine", "volcano", "temple", "castle", "catacomb", "cave"];
  for (const id of order) {
    if (GRAMMAR[id].words.some((w) => w && t.includes(w.toLowerCase()))) {
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

/**
 * 신전: 현관 → 신랑 → 성소(축 위 한 줄) + 신랑 좌우 곁방(대칭) + 성소 좌우 보물 방·납골실. 모든 곁방은 shift 0 으로 대칭.
 * 2026-10-23(assistant-dungeons-2): 통로를 위아래 4·옆 2칸으로 줄이고 보물 방을 성소 뒤가 아니라 옆에 붙였다 — 세로로 길게 늘어선
 * 십자형이라 맵의 57%가 검은 허공이었다. 신랑도 17×19 → 15×13(맨바닥이 넓었다).
 */
export function planTemple(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number }): DungeonRoomInput[] {
  const n = sized(spec);
  const rooms: DungeonRoomInput[] = [
    { id: "porch", kind: "entrance", w: 13, h: 6 },
    { id: "nave", kind: "nave", w: 15, h: 13, from: "porch", dir: "N", shift: 0, len: 4 },
    { id: "sanctum", kind: "boss", w: 15, h: 9, from: "nave", dir: "N", shift: 0, len: 4 },
  ];
  if (n >= 4) { rooms.push({ id: "chapelW", kind: "shrine", w: 9, h: 9, from: "nave", dir: "W", shift: 0, len: 2 }, { id: "chapelE", kind: "shrine", w: 9, h: 9, from: "nave", dir: "E", shift: 0, len: 2 }); }
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", w: 9, h: 7, from: "sanctum", dir: "W", shift: 0, len: 2 });
  if (n >= 6) rooms.push({ id: "ossuaryE", kind: "crypt", w: 9, h: 7, from: "sanctum", dir: "E", shift: 0, len: 2 });
  return rooms;
}

/** 광산: 갱구(입구) → 동쪽으로 주 갱도(갈림 방 junction 줄) → 위·아래 채굴장(stope) → 끝 심부(보스) + 보물. */
export function planMine(spec: { size?: "small" | "medium" | "large"; width?: number; height?: number; seed?: number }): DungeonRoomInput[] {
  const n = sized(spec), random = rng((spec.seed ?? 7) * 6151 + 5);
  const rooms: DungeonRoomInput[] = [
    { id: "adit", kind: "entrance", w: 11, h: 7 },
    { id: "j1", kind: "junction", w: 9, h: 7, from: "adit", dir: "E", shift: 0, len: 5 + Math.floor(random() * 3) },
  ];
  const spine = n >= 8 ? 3 : n >= 5 ? 2 : 1;
  for (let i = 2; i <= spine; i += 1) rooms.push({ id: `j${i}`, kind: "junction", w: 9, h: 7, from: `j${i - 1}`, dir: "E", shift: 0, len: 5 + Math.floor(random() * 3) });
  rooms.push({ id: "stopeN", kind: "stope", from: "j1", dir: "N", len: 4 });
  if (n >= 4) rooms.push({ id: "stopeS", kind: "stope", from: spine >= 2 ? "j2" : "j1", dir: "S", len: 4 });
  if (n >= 7) rooms.push({ id: "depot", kind: "depot", from: `j${spine}`, dir: "N", len: 4 });
  rooms.push({ id: "deep", kind: "boss", w: 15, h: 10, from: `j${spine}`, dir: "E", shift: 0, len: 5 });
  if (n >= 6) rooms.push({ id: "vault", kind: "vault", from: "deep", dir: "N", len: 4 });
  return rooms;
}
