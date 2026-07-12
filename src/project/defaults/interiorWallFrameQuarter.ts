import {
  INTERIOR_TEXTURE_KEY,
  INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
} from "@/project/tilesetHarness/themePacks";
import type { TilesetDef } from "@/project/types";
import type { TerrainQuarter, TerrainQuarterSource } from "./terrainQuarterAutotile";

// RM2k3식 다크월 쿼터(8×8 미니타일) 오토타일 렌더링.
//
// 칩셋 6~8열×12~15행이 교과서적 RM2k3 오토타일 블록이다:
//   366 고립(프리뷰) · 367 몸통 변형 · 368 오목 코너 미니타일 소스(render-only)
//   396 397 398 / 426 427 428 / 456 457 458 = 3×3 본체(볼록 코너·변·중앙)
// 엔진 원리: 셀의 쿼터(NW/NE/SW/SE)마다 세로 이웃(v)·가로 이웃(h)·대각(d)의
// "어둠 덩어리(dark mass)" 여부를 보고 소스 타일의 같은 위치 쿼터를 고른다:
//   v·h·d 모두 벽 → 중앙(저장 타일 그대로 노출)
//   v·h 벽, d 열림 → 368 오목 코너
//   v만 벽 → 세로 변(왼쪽 절반 426, 오른쪽 절반 428)  ← 1열 기둥 = 좌우 2등분
//   h만 벽 → 가로 변(위 절반 397, 아래 절반 457)      ← 1줄 밴드 = 상하 2등분
//   둘 다 열림 → 볼록 코너(396/398/456/458)
// 저장 타일은 바꾸지 않는다 — 중앙 쿼터와 "저장 타일과 동일한" 쿼터는 생략해
// underlay(저장 타일)가 그대로 보이게 한다(430 공허 보존, 구 특수 케이스 호환).
// 예외: 라벨 타일(233/257/258)은 시트에 그림자 실물 아트가 없으므로(2026-07-12 시트
// 원본 복원 — 원본 픽셀은 빈칸/돌벽) 원시 픽셀을 절대 노출하지 않고 항상 4쿼터 전체를 합성한다.
// 234는 라벨이 아니라 세로 긴 탁자 상단 캡(가구, upper 소품)으로 판명 — 어둠/라벨 세트에서 제외.

type InteriorWallFrameMap = {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
};

export type InteriorWallFrameQuarterComposition = {
  readonly underlayTile: number;
  readonly sources: readonly TerrainQuarterSource[];
};

// 어둠 덩어리(dark mass) — 다크월 오토타일 블록 + 공허/그림자/동굴 테두리 계열.
// 방 내용물(바닥 72/73, 크림 벽면 74~77/104~107, 카펫, 가구 lower)은 "열림"이다.
const INTERIOR_DARK_MASS_TILES = new Set<number>([
  366, 367, 368, 369,
  396, 397, 398, 399,
  426, 427, 428, 429,
  456, 457, 458, 459,
  430, 431, 460, 461, 400, 401, 370, 371,
  233, 257, 258,
  116, 146,
]);

// 오토타일이 조인트/코너 라벨로 저장하는 타일 — 시트 픽셀(빈칸/돌벽)을 렌더에 쓰면 안 된다.
const INTERIOR_WALL_LABEL_TILES = new Set<number>([233, 257, 258]);

// 쿼터 소스 타일 (3×3 본체 + 오목 코너 368)
const Q_CENTER = 427;
const Q_INNER = 368;
const Q_EDGE_W = 426;
const Q_EDGE_E = 428;
const Q_EDGE_N = 397;
const Q_EDGE_S = 457;
const Q_CORNER: Record<TerrainQuarter, number> = { nw: 396, ne: 398, sw: 456, se: 458 };

const INTERIOR_WALL_FRAME_QUARTERS = [
  { quarter: "nw", vertical: { x: 0, y: -1 }, horizontal: { x: -1, y: 0 }, diagonal: { x: -1, y: -1 }, offsetX: 0, offsetY: 0 },
  { quarter: "ne", vertical: { x: 0, y: -1 }, horizontal: { x: 1, y: 0 }, diagonal: { x: 1, y: -1 }, offsetX: 8, offsetY: 0 },
  { quarter: "sw", vertical: { x: 0, y: 1 }, horizontal: { x: -1, y: 0 }, diagonal: { x: -1, y: 1 }, offsetX: 0, offsetY: 8 },
  { quarter: "se", vertical: { x: 0, y: 1 }, horizontal: { x: 1, y: 0 }, diagonal: { x: 1, y: 1 }, offsetX: 8, offsetY: 8 },
] as const satisfies readonly {
  readonly quarter: TerrainQuarter;
  readonly vertical: { readonly x: 0; readonly y: -1 | 1 };
  readonly horizontal: { readonly x: -1 | 1; readonly y: 0 };
  readonly diagonal: { readonly x: -1 | 1; readonly y: -1 | 1 };
  readonly offsetX: 0 | 8;
  readonly offsetY: 0 | 8;
}[];

export function interiorWallFrameQuarterComposition(
  map: InteriorWallFrameMap,
  tileset: Pick<TilesetDef, "autotileGroups" | "image">,
  x: number,
  y: number,
): InteriorWallFrameQuarterComposition | null {
  if (tileset.image.type !== "bundled" || tileset.image.id !== INTERIOR_TEXTURE_KEY) return null;
  const centerTile = tileAt(map, x, y);
  if (centerTile === undefined || !INTERIOR_DARK_MASS_TILES.has(centerTile)) return null;
  // 실내 하네스(벽 프레임 그룹)가 시드된 타일셋에서만 동작 — 기존 게이트 유지.
  const hasWallFrameGroup = tileset.autotileGroups?.some(
    (group) => group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
  );
  if (!hasWallFrameGroup) return null;

  const isMass = (nx: number, ny: number): boolean => {
    const tile = tileAt(map, nx, ny);
    if (tile === undefined) return true; // 맵 밖 = 어둠
    if (tile < 0) return true;
    return INTERIOR_DARK_MASS_TILES.has(tile);
  };

  const isLabelTile = INTERIOR_WALL_LABEL_TILES.has(centerTile);
  const sources: TerrainQuarterSource[] = [];
  for (const part of INTERIOR_WALL_FRAME_QUARTERS) {
    const v = isMass(x + part.vertical.x, y + part.vertical.y);
    const h = isMass(x + part.horizontal.x, y + part.horizontal.y);
    const d = isMass(x + part.diagonal.x, y + part.diagonal.y);
    let tile: number;
    if (v && h && d) tile = Q_CENTER;
    else if (v && h) tile = Q_INNER;
    else if (v) tile = part.horizontal.x < 0 ? Q_EDGE_W : Q_EDGE_E;
    else if (h) tile = part.vertical.y < 0 ? Q_EDGE_N : Q_EDGE_S;
    else tile = Q_CORNER[part.quarter];
    // 중앙 쿼터는 저장 타일(underlay)을 그대로 노출하고, 저장 타일과 같은 소스도 생략한다.
    // 단 라벨 타일은 노출할 실물 아트가 없으므로 어느 쿼터도 생략하지 않는다.
    if (!isLabelTile && (tile === Q_CENTER || tile === centerTile)) continue;
    sources.push({ quarter: part.quarter, tile, offsetX: part.offsetX, offsetY: part.offsetY });
  }
  if (sources.length === 0) return null;
  // 라벨 타일의 underlay는 저장 타일 대신 어둠 몸통(427) — 시트 복원 후 저장 픽셀은 궤짝/돌벽/빈칸이다.
  return { underlayTile: isLabelTile ? Q_CENTER : centerTile, sources };
}

function tileAt(map: InteriorWallFrameMap, x: number, y: number): number | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.lowerTiles[y * map.width + x];
}
