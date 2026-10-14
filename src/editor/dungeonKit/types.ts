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
  readonly seed?: number;
  readonly size?: DungeonSize;
  /** 맵 가로·세로 바람(칸). 방 구성을 정할 때 방 수·크기를 이 넓이에 맞추고, 배치가 이 비율에 가깝게 자란다. */
  readonly width?: number;
  readonly height?: number;
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlacedRoom extends Rect { id: string; kind: DungeonRoomKind; from: string | null; dir: DungeonDir | null; depth: number }
export interface PlacedCorridor { a: string; b: string; dir: DungeonDir; rect: Rect; loop?: boolean }


export interface DungeonLayout { rooms: PlacedRoom[]; corridors: PlacedCorridor[]; width: number; height: number; notes: string[]; grid?: Grid }
