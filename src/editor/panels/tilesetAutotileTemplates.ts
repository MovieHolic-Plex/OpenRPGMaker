import {
  buildEdgeCornerInnerVariantMap,
  buildEdgeCornerVariantMap,
  type EdgeCornerInnerTileSet,
  type EdgeCornerTileSet,
} from "@/project/defaults/autotileEngine";
import type { AutotileNeighborhood, TilesetAnimationStrip } from "@/project/types";

// DB→타일셋 오토타일 템플릿 위저드의 순수 계산 모듈.
// 시트 위 "앵커 타일"(템플릿 블록의 좌상단 인덱스) 하나로 오토타일 그룹 정의
// (memberTileIds/connectTileIds/variantMap)를 결정론으로 파생한다.
// DOM/스토어 의존 없음 — 단위 테스트(test/autotileTemplates.test.ts)로 고정.

// 오토타일 그룹을 생성하는 템플릿 종류.
export type AutotileTemplateGroupKind = "rm2k-3x4" | "grid-3x3" | "grid-3x2";
// 위저드가 다루는 전체 템플릿 종류(애니메이션 물은 그룹 대신 animationStrips 를 만든다).
export type AutotileTemplateKind = AutotileTemplateGroupKind | "animated-water";

// UI 선택지 노출용 안내(라벨은 위저드 select 에서 그대로 사용).
export const AUTOTILE_TEMPLATE_KIND_GUIDES: readonly { id: AutotileTemplateKind; label: string }[] = [
  { id: "rm2k-3x4", label: "RM2K식 3×4 (외딴·오목 + 3×3)" },
  { id: "grid-3x3", label: "3×3 격자 (모서리·변·몸통)" },
  { id: "grid-3x2", label: "3×2 격자 (상단·하단 행)" },
  { id: "animated-water", label: "애니메이션 물 (가로 3프레임)" },
];

export interface AutotileTemplateGroup {
  name: string;
  neighborhood: AutotileNeighborhood;
  memberTileIds: number[];
  connectTileIds: number[];
  variantMap: Record<string, number>;
}

export interface AutotileTemplateError {
  error: string;
}

// 템플릿 블록 크기(행×열). 앵커 열 넘침/시트 범위 검증에 사용.
const TEMPLATE_BLOCK_SIZE: Record<AutotileTemplateKind, { rows: number; cols: number }> = {
  "rm2k-3x4": { rows: 4, cols: 3 },
  "grid-3x3": { rows: 3, cols: 3 },
  "grid-3x2": { rows: 2, cols: 3 },
  "animated-water": { rows: 1, cols: 3 },
};

// 앵커가 시트 안에서 블록(rows×cols)을 온전히 담는지 검증. 실패 시 한국어 오류 메시지.
function validateBlock(kind: AutotileTemplateKind, anchorTile: number, tilesPerRow: number, tileCount: number): string | null {
  if (!Number.isInteger(anchorTile) || anchorTile < 0) {
    return "앵커 타일 번호는 0 이상의 정수여야 합니다.";
  }
  if (!Number.isInteger(tilesPerRow) || tilesPerRow <= 0) {
    return "타일셋의 행당 타일 수(tilesPerRow)가 잘못되었습니다.";
  }
  const { rows, cols } = TEMPLATE_BLOCK_SIZE[kind];
  const column = anchorTile % tilesPerRow;
  if (column + (cols - 1) >= tilesPerRow) {
    return `앵커 타일 ${anchorTile}(열 ${column})에서 오른쪽으로 ${cols}칸이 시트 행(행당 ${tilesPerRow}타일)을 넘칩니다.`;
  }
  const lastTile = anchorTile + (rows - 1) * tilesPerRow + (cols - 1);
  if (lastTile >= tileCount) {
    return `템플릿 마지막 타일(${lastTile})이 시트 범위(총 ${tileCount}타일)를 벗어납니다.`;
  }
  return null;
}

// RM2K식 3×4 블록의 11분류 배치. 앵커 T(=isolated) 기준:
//   T열:      [isolated] [ ]      [inner]
//   T+R열:    [cornerNW] [edgeN]  [cornerNE]
//   T+2R열:   [edgeW]    [body]   [edgeE]
//   T+3R열:   [cornerSW] [edgeS]  [cornerSE]
// 검증 픽스처: 앵커 129 → chipsetMapping.ts 의 COBBLE_TILE 블록과 정확히 일치.
function rm2kTiles(anchorTile: number, tilesPerRow: number): EdgeCornerInnerTileSet {
  const T = anchorTile;
  const R = tilesPerRow;
  return {
    isolated: T,
    inner: T + 2,
    cornerNW: T + R,
    edgeN: T + R + 1,
    cornerNE: T + R + 2,
    edgeW: T + 2 * R,
    body: T + 2 * R + 1,
    edgeE: T + 2 * R + 2,
    cornerSW: T + 3 * R,
    edgeS: T + 3 * R + 1,
    cornerSE: T + 3 * R + 2,
  };
}

// 3×3 격자: 앵커 T 부터 row-major 9타일 =
// [cornerNW, edgeN, cornerNE, edgeW, body, edgeE, cornerSW, edgeS, cornerSE].
function grid3x3Tiles(anchorTile: number, tilesPerRow: number): EdgeCornerTileSet {
  const T = anchorTile;
  const R = tilesPerRow;
  return {
    cornerNW: T,
    edgeN: T + 1,
    cornerNE: T + 2,
    edgeW: T + R,
    body: T + R + 1,
    edgeE: T + R + 2,
    cornerSW: T + 2 * R,
    edgeS: T + 2 * R + 1,
    cornerSE: T + 2 * R + 2,
  };
}

// 3×2 격자 접기 규약: 시트에는 상단 행(cornerNW/edgeN/cornerNE)과 하단 행
// (cornerSW/edgeS/cornerSE)만 있고, 없는 역할은 최근접 역할로 접는다 —
//   edgeW ← cornerNW, edgeE ← cornerNE, body ← edgeN.
// (좌우 변은 같은 쪽 상단 모서리와, 몸통은 상단 변과 시각적으로 가장 가깝다.)
function grid3x2Tiles(anchorTile: number, tilesPerRow: number): EdgeCornerTileSet {
  const T = anchorTile;
  const R = tilesPerRow;
  return {
    cornerNW: T,
    edgeN: T + 1,
    cornerNE: T + 2,
    edgeW: T, // ← cornerNW 접기
    body: T + 1, // ← edgeN 접기
    edgeE: T + 2, // ← cornerNE 접기
    cornerSW: T + R,
    edgeS: T + R + 1,
    cornerSE: T + R + 2,
  };
}

// 11분류 → memberTileIds 순서. 내장 그룹(autotileGroups.ts templateSurfaceTiles)과 동일한
// [몸통, 4변, 4모서리, 외딴, 오목] 순서를 유지한다(COBBLE 픽스처 완전 일치 계약).
function rm2kMemberTiles(tiles: EdgeCornerInnerTileSet): number[] {
  return [
    tiles.body,
    tiles.edgeN,
    tiles.edgeS,
    tiles.edgeW,
    tiles.edgeE,
    tiles.cornerNW,
    tiles.cornerNE,
    tiles.cornerSW,
    tiles.cornerSE,
    tiles.isolated,
    tiles.inner,
  ];
}

// 템플릿 종류 + 앵커 타일 → 오토타일 그룹 정의. 실패 시 { error } 반환.
// animated-water 는 그룹을 만들지 않으므로 buildAnimatedWaterStrip 을 사용할 것.
export function buildTemplateGroup(
  kind: AutotileTemplateGroupKind,
  anchorTile: number,
  tilesPerRow: number,
  tileCount: number
): AutotileTemplateGroup | AutotileTemplateError {
  const invalid = validateBlock(kind, anchorTile, tilesPerRow, tileCount);
  if (invalid !== null) return { error: invalid };
  if (kind === "rm2k-3x4") {
    const tiles = rm2kTiles(anchorTile, tilesPerRow);
    const members = rm2kMemberTiles(tiles);
    return {
      name: `RM2K 3×4 (앵커 ${anchorTile})`,
      neighborhood: 8,
      memberTileIds: members,
      connectTileIds: [...members],
      variantMap: buildEdgeCornerInnerVariantMap(tiles),
    };
  }
  if (kind === "grid-3x3") {
    const tiles = grid3x3Tiles(anchorTile, tilesPerRow);
    const members = [
      tiles.cornerNW, tiles.edgeN, tiles.cornerNE,
      tiles.edgeW, tiles.body, tiles.edgeE,
      tiles.cornerSW, tiles.edgeS, tiles.cornerSE,
    ];
    return {
      name: `3×3 격자 (앵커 ${anchorTile})`,
      neighborhood: 4,
      memberTileIds: members,
      connectTileIds: [...members],
      variantMap: buildEdgeCornerVariantMap(tiles),
    };
  }
  // grid-3x2
  const tiles = grid3x2Tiles(anchorTile, tilesPerRow);
  const members = [
    tiles.cornerNW, tiles.edgeN, tiles.cornerNE,
    tiles.cornerSW, tiles.edgeS, tiles.cornerSE,
  ];
  return {
    name: `3×2 격자 (앵커 ${anchorTile})`,
    neighborhood: 4,
    memberTileIds: members,
    connectTileIds: [...members],
    variantMap: buildEdgeCornerVariantMap(tiles),
  };
}

// 애니메이션 물 템플릿: 앵커 T 에서 가로 3프레임(T, T+1, T+2)을 FPS 3 으로 재생하는
// 스트립 데이터를 만든다(기본 칩셋 CHIPSET_ANIMATION_STRIPS 규약과 동일한 3프레임·FPS3).
// 오토타일 그룹은 만들지 않는다 — tileset.animationStrips 에 push 하는 데이터 모델 전용.
export function buildAnimatedWaterStrip(
  anchorTile: number,
  tilesPerRow: number,
  tileCount: number
): { strip: TilesetAnimationStrip } | AutotileTemplateError {
  const invalid = validateBlock("animated-water", anchorTile, tilesPerRow, tileCount);
  if (invalid !== null) return { error: invalid };
  return { strip: { baseTile: anchorTile, frames: 3, fps: 3 } };
}

// 위저드 미리보기용 역할별 타일 id 목록(텍스트 표시용). 실패 시 { error }.
export function previewTemplateTiles(
  kind: AutotileTemplateKind,
  anchorTile: number,
  tilesPerRow: number,
  tileCount: number
): { entries: { role: string; tileId: number }[] } | AutotileTemplateError {
  const invalid = validateBlock(kind, anchorTile, tilesPerRow, tileCount);
  if (invalid !== null) return { error: invalid };
  if (kind === "animated-water") {
    return {
      entries: [
        { role: "프레임 1(기준)", tileId: anchorTile },
        { role: "프레임 2", tileId: anchorTile + 1 },
        { role: "프레임 3", tileId: anchorTile + 2 },
      ],
    };
  }
  const tiles = kind === "rm2k-3x4"
    ? rm2kTiles(anchorTile, tilesPerRow)
    : kind === "grid-3x3"
      ? grid3x3Tiles(anchorTile, tilesPerRow)
      : grid3x2Tiles(anchorTile, tilesPerRow);
  const entries: { role: string; tileId: number }[] = [];
  if (kind === "rm2k-3x4") {
    const inner = tiles as EdgeCornerInnerTileSet;
    entries.push({ role: "외딴 점", tileId: inner.isolated }, { role: "오목 코너", tileId: inner.inner });
  }
  entries.push(
    { role: "북서 모서리", tileId: tiles.cornerNW },
    { role: "북 변", tileId: tiles.edgeN },
    { role: "북동 모서리", tileId: tiles.cornerNE },
    { role: "서 변", tileId: tiles.edgeW },
    { role: "몸통", tileId: tiles.body },
    { role: "동 변", tileId: tiles.edgeE },
    { role: "남서 모서리", tileId: tiles.cornerSW },
    { role: "남 변", tileId: tiles.edgeS },
    { role: "남동 모서리", tileId: tiles.cornerSE }
  );
  return { entries };
}
