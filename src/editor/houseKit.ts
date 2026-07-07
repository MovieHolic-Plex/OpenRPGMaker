// editor/houseKit.ts
// 집 하네싱 키트 — 사용자 기준 집(연습04 파랑+석벽 / 연습08 밝은오렌지+회벽)에서 학습한
// 타일 역할·연속 규칙을 선언적 키트로 고정하고, 직사각 집을 규칙 그대로 전개한다.
// 정본 명세: docs/knowledge/images/2026-07-08-house-harness-design.png
//
// 불변식(하네싱 규칙):
// 1) 벽 = 상단 1행 + 중단 N행 + 하단 1행 나인슬라이스. 가로는 중앙 열만 반복.
// 2) 지붕(하위) = 처마 1행 + 몸통 N행 (+ 파랑은 좌우 1칸 인셋된 최상행 1행).
// 3) 마감은 전부 상위 레이어, "빈 칸에만" 얹는다(이웃 오브젝트 보존).
// 4) 세트 혼합 금지 — 벽·지붕은 키트로 페어 고정.

import { TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";

export type HouseKitId = "blue-stone" | "bright-plaster";

interface WallNineSlice {
  readonly top: readonly [number, number, number];
  readonly mid: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
}

interface BlueRoofKit {
  readonly kind: "blue";
  readonly body: number; // 406 — 몸통·최상행 채움 (가로+세로)
  readonly rightEdge: number; // 407 — 몸통행 우측 끝 1칸 (세로)
  readonly eave: number; // 467 — 최하행, 벽과 같은 폭 (가로)
  readonly upper: { readonly nw: number; readonly ne: number; readonly sw: number; readonly se: number };
}

interface BrightRoofKit {
  readonly kind: "bright";
  readonly body: number; // 404 — 몸통 면 (가로+세로), 벽보다 좌우 1칸 인셋
  readonly eave: number; // 405 — 최하행, 벽과 같은 폭(몸통보다 좌우 +1 오버행)
  readonly upper: {
    readonly ridge: number; // 374 — 몸통 위 한 줄 (가로)
    readonly ridgeCapL: number; // 354
    readonly ridgeCapR: number; // 355
    readonly trimL: number; // 376 — 몸통 좌측 바깥 열 (세로)
    readonly trimR: number; // 377
    readonly trimCapL: number; // 384 — 처마 행에서 트림 마감(처마 위에 겹침)
    readonly trimCapR: number; // 385
  };
}

export interface HouseKit {
  readonly id: HouseKitId;
  readonly name: string;
  readonly wall: WallNineSlice;
  readonly roof: BlueRoofKit | BrightRoofKit;
}

export const HOUSE_KITS: Record<HouseKitId, HouseKit> = {
  "blue-stone": {
    id: "blue-stone",
    name: "파랑 지붕 + 석벽",
    wall: { top: [15, 16, 17], mid: [45, 46, 47], bottom: [75, 76, 77] },
    roof: { kind: "blue", body: 406, rightEdge: 407, eave: 467, upper: { nw: 356, ne: 357, sw: 386, se: 387 } },
  },
  "bright-plaster": {
    id: "bright-plaster",
    name: "밝은 오렌지 지붕 + 흰 회벽",
    wall: { top: [12, 13, 14], mid: [42, 43, 44], bottom: [72, 73, 74] },
    roof: {
      kind: "bright",
      body: 404,
      eave: 405,
      upper: { ridge: 374, ridgeCapL: 354, ridgeCapR: 355, trimL: 376, trimR: 377, trimCapL: 384, trimCapR: 385 },
    },
  },
};

export interface RectHousePlan {
  /** 바운딩 박스 좌상단 (bright는 용마루(상위) 행이 y, blue는 지붕 최상행이 y). */
  readonly x: number;
  readonly y: number;
  /** 벽 폭(칸). 최소 3 — 좌/우 모서리 + 중앙 1칸. */
  readonly width: number;
  /** 층수. 벽 중단 행 수 = 2*stories - 1 (1층=1, 2층=3). */
  readonly stories: 1 | 2;
  /** 지붕 몸통 행 수(≥1). 높은 지붕이 필요하면 늘린다. */
  readonly roofBodyRows: number;
  readonly kitId: HouseKitId;
}

export interface RectHouseStampResult {
  readonly ok: boolean;
  readonly reason?: string;
  /** 문 배치 권장 위치(남쪽 벽 하단 중앙). */
  readonly doorAt?: { readonly x: number; readonly y: number };
  readonly height?: number;
}

export function rectHouseHeight(plan: Pick<RectHousePlan, "stories" | "roofBodyRows" | "kitId">): number {
  const wallRows = 2 + wallMidRows(plan.stories);
  // blue: 최상행 + 몸통 + 처마 / bright: 용마루(상위) 행 + 몸통 + 처마 — 총 행수는 동일 구조.
  return 1 + plan.roofBodyRows + 1 + wallRows;
}

function wallMidRows(stories: 1 | 2): number {
  return 2 * stories - 1;
}

// 직사각 집을 하네싱 규칙 그대로 전개한다. map을 직접 변경(호출측이 draft/스냅샷 관리).
export function stampRectHouseKit(map: GameMap, plan: RectHousePlan): RectHouseStampResult {
  const kit = HOUSE_KITS[plan.kitId];
  if (!kit) return { ok: false, reason: `알 수 없는 키트: ${plan.kitId}` };
  if (plan.width < 3) return { ok: false, reason: "벽 폭은 최소 3칸(좌·중·우)입니다." };
  if (plan.roofBodyRows < 1) return { ok: false, reason: "지붕 몸통은 최소 1행입니다." };
  const height = rectHouseHeight(plan);
  const left = plan.x;
  const right = plan.x + plan.width - 1;
  if (left < 0 || plan.y < 0 || right >= map.width || plan.y + height > map.height) {
    return { ok: false, reason: `맵 경계를 벗어납니다 (필요 영역 ${plan.width}×${height}).` };
  }

  const lower = (x: number, y: number, tile: number): void => {
    map.lowerTiles[y * map.width + x] = tile;
  };
  // 상위 마감은 빈 칸에만 — 이웃 오브젝트(나무/다른 지붕)를 절대 덮지 않는다.
  const upperIfEmpty = (x: number, y: number, tile: number): void => {
    const index = y * map.width + x;
    if (map.upperTiles[index] === TILE.EMPTY) map.upperTiles[index] = tile;
  };
  // 나인슬라이스 한 행: 좌 모서리 + 중앙 반복 + 우 모서리.
  const nineSliceRow = (y: number, [l, c, r]: readonly [number, number, number]): void => {
    lower(left, y, l);
    for (let x = left + 1; x < right; x += 1) lower(x, y, c);
    lower(right, y, r);
  };

  // ── 지붕(위→아래) ──
  const roof = kit.roof;
  let y = plan.y;
  if (roof.kind === "blue") {
    // 최상행: 좌우 1칸 인셋 몸통 + 빈 모서리에 상위 대각.
    for (let x = left + 1; x < right; x += 1) lower(x, y, roof.body);
    upperIfEmpty(left, y, roof.upper.nw);
    upperIfEmpty(right, y, roof.upper.ne);
    y += 1;
    // 몸통행 ×N: 좌측 끝 포함 몸통, 우측 끝만 사면 마감.
    for (let row = 0; row < plan.roofBodyRows; row += 1, y += 1) {
      for (let x = left; x < right; x += 1) lower(x, y, roof.body);
      lower(right, y, roof.rightEdge);
    }
    // 처마행: 벽과 같은 폭, 좌우 끝에 상위 대각 겹침.
    for (let x = left; x <= right; x += 1) lower(x, y, roof.eave);
    upperIfEmpty(left, y, roof.upper.sw);
    upperIfEmpty(right, y, roof.upper.se);
    y += 1;
  } else {
    // 용마루(상위) 행: 몸통 폭 = 벽보다 좌우 1칸 인셋 → 용마루도 인셋 폭, 캡은 그 바깥.
    for (let x = left + 1; x < right; x += 1) upperIfEmpty(x, y, roof.upper.ridge);
    upperIfEmpty(left, y, roof.upper.ridgeCapL);
    upperIfEmpty(right, y, roof.upper.ridgeCapR);
    y += 1;
    // 몸통행 ×N (인셋) + 좌우 바깥 열 수직 트림(상위).
    for (let row = 0; row < plan.roofBodyRows; row += 1, y += 1) {
      for (let x = left + 1; x < right; x += 1) lower(x, y, roof.body);
      upperIfEmpty(left, y, roof.upper.trimL);
      upperIfEmpty(right, y, roof.upper.trimR);
    }
    // 처마행: 벽과 같은 폭(몸통보다 +1 오버행), 트림 하단 캡을 처마 위에 겹침.
    for (let x = left; x <= right; x += 1) lower(x, y, roof.eave);
    upperIfEmpty(left, y, roof.upper.trimCapL);
    upperIfEmpty(right, y, roof.upper.trimCapR);
    y += 1;
  }

  // ── 벽(상단 1 + 중단 N + 하단 1) ──
  nineSliceRow(y, kit.wall.top);
  y += 1;
  for (let row = 0; row < wallMidRows(plan.stories); row += 1, y += 1) nineSliceRow(y, kit.wall.mid);
  nineSliceRow(y, kit.wall.bottom);

  return { ok: true, doorAt: { x: left + Math.floor(plan.width / 2), y }, height };
}
