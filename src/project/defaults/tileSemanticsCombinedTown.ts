// combined_town(EasyRPG RTP) 칩셋의 AI 검색용 큐레이션 시맨틱 테이블.
// 핸드오프 0.4에서 헤드리스 플레이테스트로 검증된 통행성 사실 + 집 패턴 타일 + 장식 타일을 다룬다.
// tileset.tileMeta[]와는 별개로 관리되는 검색 전용 데이터다(일부 타일은 tilesetHarness/combinedTownGroups.ts에서
// 실제 tileMeta/통행성도 함께 채우지만, 나머지 다수는 여기에서만 라벨을 제공한다 — resourceSearch.ts 참고).

import { TILE } from "./constants";

export interface CombinedTownTileSemanticEntry {
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: "passable" | "solid";
  readonly tags: readonly string[];
}

function entries(
  indexes: readonly number[],
  label: string,
  role: string,
  passage: "passable" | "solid",
  tags: readonly string[]
): CombinedTownTileSemanticEntry[] {
  return indexes.map((index) => ({ index, label, role, passage, tags: [label, ...tags] }));
}

export const COMBINED_TOWN_TILE_SEMANTICS: readonly CombinedTownTileSemanticEntry[] = [
  // 검증된 통행 불가 타일(핸드오프 0.4) — 겉보기와 실제 통행성이 다른 함정 포함.
  ...entries([TILE.FLOOR, 343], "돌바닥", "floor", "solid", ["floor", "FLOOR", "통행불가", "함정"]),
  ...entries([TILE.STAIRS], "계단", "stairs", "solid", ["stairs", "STAIRS", "성벽"]),
  ...entries([TILE.WALL], "벽", "wall", "solid", ["wall", "WALL", "성벽"]),
  ...entries([TILE.TREE], "나무", "tree", "solid", ["tree", "TREE", "숲"]),
  ...entries([TILE.WATER], "물", "water", "solid", ["water", "WATER", "호수", "강"]),
  ...entries([329], "문 상단", "door", "solid", ["문", "입구", "door"]),
  ...entries([359], "문 하단", "door", "solid", ["문", "입구", "door"]),
  ...entries([426], "어두운 벽", "wall", "solid", ["dark wall", "동굴", "던전"]),

  // 검증된 통행 가능 지면(핸드오프 0.4).
  ...entries([TILE.GRASS, 270, 271, 272, 273, 300, 301, 302, 330, 331, 332, 333], "잔디", "terrain", "passable", ["grass", "GRASS", "풀밭"]),
  ...entries([TILE.DARK_GRASS], "짙은 잔디", "terrain", "passable", ["dark grass", "숲", "풀밭"]),
  ...entries([TILE.PATH], "자갈길", "terrain", "passable", ["길", "path", "자갈", "보라"]),
  ...entries([421], "흙길", "terrain", "passable", ["길", "흙길", "dirt road"]),
  ...entries([390, 391, 392, 420, 422, 450, 451, 452], "흙길 외곽", "terrain", "passable", ["길", "흙길", "dirt road", "edge"]),
  ...entries([TILE.SAND, 424], "모래", "terrain", "passable", ["sand", "SAND", "사막", "해변"]),
  ...entries([361, 362, 363], "모래", "terrain", "passable", ["sand", "사막", "해변"]),
  ...entries([425, 453, 454], "모래 외곽", "terrain", "passable", ["sand", "사막", "edge"]),

  // 집 패턴 타일 — 지붕/벽/문/창문(핸드오프 0.4 최소 범위).
  ...entries([374, 375], "사선 지붕", "roof", "solid", ["지붕", "roof", "사선"]),
  ...entries([404, 405], "지붕-벽 경계", "wall", "solid", ["지붕", "벽", "경계"]),
  ...entries([102, 103, 104], "나무 집벽 상단", "wall", "solid", ["나무 집벽", "목조", "집벽", "wood wall"]),
  ...entries([132, 133, 134], "나무 집벽 중단", "wall", "solid", ["나무 집벽", "목조", "집벽", "wood wall"]),
  ...entries([162, 163, 164], "나무 집벽 하단", "wall", "solid", ["나무 집벽", "목조", "집벽", "wood wall"]),
  ...entries([15, 16, 17], "흰 집벽 상단", "wall", "solid", ["흰 집벽", "집벽", "white wall"]),
  ...entries([45, 46, 47], "흰 집벽 중단", "wall", "solid", ["흰 집벽", "집벽", "white wall"]),
  ...entries([87], "창문", "window", "solid", ["window", "집"]),
  ...entries([116], "문/입구", "door", "solid", ["문", "입구", "door", "집"]),

  // 장식 타일(핸드오프 0.4 최소 범위).
  ...entries([TILE.FLOWERS], "꽃", "decoration", "passable", ["flower", "자연", "장식"]),
  ...entries([327, 328], "벤치", "decoration", "passable", ["bench", "가구", "장식"]),
  ...entries([320], "표지판", "decoration", "passable", ["sign", "이정표", "마을", "장식"]),
  ...entries([378, 379, 380, 408, 409, 410, 438, 439], "울타리", "fence", "solid", ["fence", "barrier", "장식"]),
];
