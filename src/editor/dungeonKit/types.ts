// 던전 시공기 공용 형식 — 칩셋을 모르는 쪽(배치 문법·마스크)과 키트 어댑터가 함께 쓴다(2026-10-15 장르별 던전 분리).
import type { Grid } from "./grid";

/** 던전 종류 — 배치 문법·분위기의 이름. 어느 칩셋이 어느 종류를 지을 수 있는지는 어댑터가 정한다(dungeonKit/adapters.ts). */
export const DUNGEON_TYPES = ["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano", "ice"] as const;
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

export type DungeonDir = "N" | "S" | "W" | "E";
export const DUNGEON_DIRS: readonly DungeonDir[] = ["N", "S", "W", "E"];
/** 옛 style 인자(catacomb|castle) — type 의 앞 두 값과 같다. */
export const DUNGEON_STYLES = ["catacomb", "castle"] as const;
export type DungeonStyle = (typeof DUNGEON_STYLES)[number];
export const DUNGEON_SIZES = ["small", "medium", "large"] as const;
export type DungeonSize = (typeof DUNGEON_SIZES)[number];

export interface DungeonRoomInput {
  readonly id?: string;
  readonly kind?: DungeonRoomKind;
  /** 바닥 가로·세로(벽 앞면 3줄은 따로 위에 붙는다). 생략하면 종류별 기본에 시드로 ±1~2 흔든다. */
  readonly w?: number;
  readonly h?: number;
  /** 이 방이 이어지는 앞 방 id(기본: 바로 앞 방). */
  readonly from?: string;
  /** 앞 방의 어느 쪽 문에서 뻗나. 생략하면 층 모양(화면 비)에 맞는 쪽을 고른다. 자리가 막히면 다른 쪽으로 옮긴다. */
  readonly dir?: DungeonDir;
  /** 통로 길이(칸)와 앞 방 가운데에서의 옆 어긋남(칸) — 지정하면 그 값만 시도한다(대칭 신전·곧은 갱도). */
  readonly len?: number;
  readonly shift?: number;
}

export interface DungeonSpec {
  /** 방 목록. 생략하면 size(기본 medium)로 방 구성을 정한다(입구 → … → 보스방, 곁방 갈래). */
  readonly rooms?: readonly DungeonRoomInput[];
  /** 던전 종류. 생략하면 style(옛 인자) → catacomb. */
  readonly type?: DungeonType;
  readonly style?: DungeonStyle;
  /** 종류의 변형(예: cave 의 dry·wet). 어댑터가 정하며 모르는 값은 기본 변형으로 간다. */
  readonly variant?: string;
  /** 불규칙 동굴 문법(cave·volcano·ice)의 방(입구 제외) 수 — 장르 프리셋이 짧은 던전을 정할 때. 생략하면 size 로. */
  readonly roomCount?: number;
  /** false 면 보물 방(vault)을 두지 않는다(불규칙 동굴 문법). 기본 true. */
  readonly vault?: boolean;
  readonly seed?: number;
  readonly size?: DungeonSize;
  /** 맵 가로·세로 바람(칸). 방 구성을 정할 때 방 수·크기를 이 넓이에 맞추고, 배치가 이 비율에 가깝게 자란다. */
  readonly width?: number;
  readonly height?: number;
  /**
   * 층 계단 종류(2026-10-22 여러 층 던전). entryStair = 이 층에 들어오는 계단: up(기본, 북쪽 벽에 올라가는 계단 — 바깥·위층으로 나간다)
   * · down(입구 방 바닥에 내려가는 계단 — 탑 위층에서 아래층으로) · door(북쪽 벽 아치 문 — 탑 1층 출입문).
   * exitStair = 다음 층으로 가는 계단: down(기본, 보스·가장 깊은 방 바닥 구멍) · up(가장 깊은 방 북쪽 벽 올라가는 계단 — 탑) · none.
   */
  readonly entryStair?: "up" | "down" | "door" | "none";
  readonly exitStair?: "down" | "up" | "none";
  /** true 면 보물 방(없으면 가장 깊은 곁방) 북쪽 벽에 아치 문을 낸다 — 퍼즐 방·곁 맵과 잇는 문(sideDoor). */
  readonly sideDoor?: boolean;
  /** 물에 잠긴 던전(신전·지하묘지·성): 큰 방 바닥에 물이 차고 걸을 길(둑·가운데 길)만 남는다. 다리는 코드가 잇는다. */
  readonly flooded?: boolean;
}

/** 층 계단·문 하나: x,y = 이동 이벤트를 둘 칸(계단 그림 칸), front = 들어서는 앞 칸(도착 칸). */
export interface DungeonStairCell { x: number; y: number; front: { x: number; y: number }; kind: "up" | "down" | "door" }

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlacedRoom extends Rect { id: string; kind: DungeonRoomKind; from: string | null; dir: DungeonDir | null; depth: number }
export interface PlacedCorridor { a: string; b: string; dir: DungeonDir; rect: Rect; loop?: boolean }


export interface DungeonLayout {
  rooms: PlacedRoom[]; corridors: PlacedCorridor[]; width: number; height: number; notes: string[]; grid?: Grid;
  /** 얇은 칸막이 배치(벽 1칸) — 벽 두께 규칙(settle)을 적용하지 않는다. */
  thin?: boolean;
}

export interface DungeonCompose {
  readonly type: DungeonType;
  readonly width: number;
  readonly height: number;
  readonly lower: number[];
  readonly upper: number[];
  readonly rooms: PlacedRoom[];
  readonly corridors: PlacedCorridor[];
  readonly entrance: { x: number; y: number };
  readonly stairsUp: { x: number; y: number; front: { x: number; y: number } } | null;
  readonly stairsDown: { x: number; y: number } | null;
  /** 이 층에 들어오는 계단·문과 다음 층으로 가는 계단(여러 층 던전이 잇는다). 옛 stairsUp/stairsDown 은 기본 종류일 때 같은 칸이다. */
  readonly entryStair?: DungeonStairCell | null;
  readonly exitStair?: DungeonStairCell | null;
  /** 곁 맵(퍼즐 방)으로 가는 아치 문(spec.sideDoor). */
  readonly sideDoor?: (DungeonStairCell & { room: string }) | null;
  /** 서사 앵커: 보스방(입구에서 가장 깊은 방 또는 kind boss)·보물 방·잠긴 문 자리(보스·보물 방으로 들어가는 통로 한가운데 칸). */
  readonly anchors: { boss: string | null; treasure: string | null; gate: { x: number; y: number; to: string } | null };
  readonly spots: Record<string, { x: number; y: number }[]>;
  readonly picture: string[];
  readonly liquid: { readonly kind: "water" | "lava" | null; readonly cells: number; readonly bridges: number };
  readonly counts: Record<string, number>;
  /** 이 층을 그린 어댑터와 쓴 타일셋(몬스터 키트는 시트마다 타일셋이 다르다). */
  readonly adapter?: string;
  readonly tilesetId?: string;
  readonly warnings: string[];
}
