// 커스텀 칩셋의 **픽셀 알파 스캔** — 순수 함수만 산다. DOM·캔버스·프로젝트 상태를 모르므로
// 합성 버퍼로 그대로 테스트된다. 브라우저 배선(캔버스 → ImageData → 캐시)은
// `src/editor/customChipsetTransparency.ts` 가 맡는다.
//
// 왜 필요한가 (OPRN-OUT-026 후속): 내장 타운 칩셋은 빌드 타임에 생성한 투명 목록
// (`generatedChipsetTransparency.ts`) 이 정본이지만, 사용자가 올린 칩셋에는 그런 목록이 없다.
// 지금까지는 명시 `투명` 태그만 믿었으므로, 태그를 안 단 칩셋은 "전부 불투명" 으로 보였다.
// 이 모듈은 그 공백을 **검토 신호**로만 메운다 — 판정이 메타를 바꾸지 않는다.
//
// ── 임계값은 실측이다 (2026-09-10) ─────────────────────────────────────────
// 표본: 실제 출하 시트 6장, 16×16 셀 2,880칸.
//   easyrpg-chipset-{combined-town,interior,dungeon,retro-house,ship}-transparent.png,
//   modern-exteriors/modern-city-atlas.png (부드러운 알파를 실제로 쓰는 커스텀 아틀라스)
//
// 1) 픽셀 띠 OPAQUE_ALPHA=250 / EMPTY_ALPHA=8:
//    표본 전체에서 알파 1..8 픽셀 **0개**, 249..254 픽셀 **0개**였다. 하드 픽셀은 정확히
//    0 과 255 만 쓰고, 진짜 반투명은 modern-city-atlas 의 100·161·220 처럼 띠 한가운데
//    떨어진다. 즉 두 경계는 관측된 값이 하나도 없는 빈 구간에 놓여 있다.
// 2) SOFT_EDGE_MAX_PIXELS=16 (256칸의 6.25%):
//    비불투명 픽셀 수의 분포는 2,4,5,6,7,8,11,12,16 에서 촘촘하다가(모서리 다듬기·트림)
//    그 위로 벌어진다. 16 이하는 모두 "실루엣은 꽉 찬 칩의 가장자리" 였다.
// 3) MOSTLY_EMPTY_MAX_COVERAGE=0.15:
//    0 이 아닌 최저 커버리지들은 0.043, 0.109, 0.121, 0.129 다음이 **0.156** 이다.
//    0.129 와 0.156 사이의 빈 구간을 갈라 0.15 로 둔다. 이 아래는 "거의 빈 칸"(점 몇 개),
//    위는 "형체가 있는 스프라이트" 다.
//
// 임계값을 바꾸려면 위 실측을 다시 돌려라: `node scripts/measureChipsetAlpha.mjs`.

/** 알파 이 값 이상은 불투명으로 센다. 실측: 249~254 픽셀이 표본에 0개. */
export const OPAQUE_ALPHA = 250;
/** 알파 이 값 이하는 완전 비어 있음으로 센다. 실측: 1~8 픽셀이 표본에 0개. */
export const EMPTY_ALPHA = 8;
/** 비불투명 픽셀이 이 개수 이하이고 구멍이 없으면 "가장자리만 부드러운" 칩이다(16×16 기준 6.25%). */
export const SOFT_EDGE_MAX_RATIO = 16 / 256;
/** 커버리지가 이 이하이면 "거의 빈 칸". 실측 공백 구간 0.129~0.156 의 가운데. */
export const MOSTLY_EMPTY_MAX_COVERAGE = 0.15;

/**
 * 한 칸의 알파 판정.
 * - `opaque`: 비불투명 픽셀이 하나도 없다. 하위에 깔아도 검은 구멍이 안 난다.
 * - `softEdge`: 실루엣은 꽉 찼고 가장자리 몇 픽셀만 부드럽다. 하위 배치가 여전히 안전하다.
 * - `partial`: 실제로 뚫린 투명 영역이 있다. 하위에 깔면 아래가 비친다 → 검토 대상.
 * - `mostlyEmpty`: 거의 빈 칸에 점만 몇 개. `partial` 중에서도 특히 위험하다.
 * - `empty`: 완전히 빈 칸. 칩셋 여백이므로 검토할 것이 없다.
 * - `unknown`: 읽지 못했다(CORS 오염·디코드 실패). **절대 opaque 로 낙관하지 않는다.**
 */
export type TileAlphaClass = "opaque" | "softEdge" | "partial" | "mostlyEmpty" | "empty" | "unknown";

export type TileAlphaSample = {
  readonly tile: number;
  readonly cls: TileAlphaClass;
  /** 완전히 비지 않은(알파 > EMPTY_ALPHA) 픽셀 비율 0..1. */
  readonly coverage: number;
  /** 불투명(알파 >= OPAQUE_ALPHA) 픽셀 수. */
  readonly opaquePixels: number;
  /** 반투명(EMPTY_ALPHA < 알파 < OPAQUE_ALPHA) 픽셀 수. */
  readonly softPixels: number;
  /** 완전 투명(알파 <= EMPTY_ALPHA) 픽셀 수. */
  readonly emptyPixels: number;
  /** 이 칸의 픽셀 총수. 부분 셀(시트 끝단)이면 tileSize² 보다 작다. */
  readonly totalPixels: number;
};

export type TileAlphaScanGeometry = {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly tilesPerRow: number;
  readonly count: number;
};

export type TileAlphaScan = {
  readonly status: "scanned" | "unknown";
  /** status==="unknown" 이면 왜 못 읽었는지. 사용자에게 그대로 보여준다. */
  readonly unknownReason: string | null;
  readonly samples: readonly TileAlphaSample[];
};

/** 판정이 검토 항목이 되어야 하는 부류인가 — 뚫린 투명이 있는 칸만. */
export function isReviewableAlphaClass(cls: TileAlphaClass): boolean {
  return cls === "partial" || cls === "mostlyEmpty";
}

/** 이 칸에 투명 픽셀이 조금이라도 있는가(시각 사실). unknown 은 false — 모르면 주장하지 않는다. */
export function alphaClassHasTransparency(cls: TileAlphaClass): boolean {
  return cls === "partial" || cls === "mostlyEmpty" || cls === "softEdge" || cls === "empty";
}

export const UNKNOWN_TILE_ALPHA_SAMPLE = Object.freeze({
  tile: -1,
  cls: "unknown",
  coverage: 0,
  opaquePixels: 0,
  softPixels: 0,
  emptyPixels: 0,
  totalPixels: 0,
}) satisfies TileAlphaSample;

/** 읽을 수 없는 이미지의 정직한 답 — "불투명" 으로 낙관하지 않는다. */
export function unknownTileAlphaScan(reason: string): TileAlphaScan {
  return { status: "unknown", unknownReason: reason, samples: [] };
}

/**
 * RGBA 버퍼(캔버스 `getImageData().data` 와 같은 배치)를 칸 단위로 스캔한다.
 *
 * 순수 함수다: 입력을 읽기만 하고 전역 상태를 만지지 않는다. 브라우저가 없어도
 * 합성 `Uint8ClampedArray` 로 그대로 테스트할 수 있다.
 */
export function scanTileAlpha(rgba: Uint8ClampedArray | Uint8Array, geometry: TileAlphaScanGeometry): TileAlphaScan {
  const { width, height, tileSize, tilesPerRow, count } = geometry;
  if (width <= 0 || height <= 0 || tileSize <= 0 || tilesPerRow <= 0) {
    return unknownTileAlphaScan("타일 그림판 크기를 알 수 없습니다.");
  }
  if (rgba.length < width * height * 4) {
    return unknownTileAlphaScan(`픽셀 버퍼가 이미지보다 작습니다(${rgba.length} < ${width * height * 4}).`);
  }
  const samples: TileAlphaSample[] = [];
  for (let tile = 0; tile < count; tile += 1) {
    samples.push(sampleTile(rgba, geometry, tile));
  }
  return { status: "scanned", unknownReason: null, samples };
}

function sampleTile(
  rgba: Uint8ClampedArray | Uint8Array,
  geometry: TileAlphaScanGeometry,
  tile: number,
): TileAlphaSample {
  const { width, height, tileSize, tilesPerRow } = geometry;
  const originX = (tile % tilesPerRow) * tileSize;
  const originY = Math.floor(tile / tilesPerRow) * tileSize;
  // 시트 밖을 가리키는 칸(선언된 count 가 이미지보다 큰 경우)은 모른다고 답한다.
  if (originX >= width || originY >= height) {
    return { ...UNKNOWN_TILE_ALPHA_SAMPLE, tile };
  }
  const spanX = Math.min(tileSize, width - originX);
  const spanY = Math.min(tileSize, height - originY);
  let opaquePixels = 0;
  let softPixels = 0;
  let emptyPixels = 0;
  for (let dy = 0; dy < spanY; dy += 1) {
    const rowStart = (originY + dy) * width + originX;
    for (let dx = 0; dx < spanX; dx += 1) {
      const alpha = rgba[(rowStart + dx) * 4 + 3] ?? 0;
      if (alpha >= OPAQUE_ALPHA) opaquePixels += 1;
      else if (alpha <= EMPTY_ALPHA) emptyPixels += 1;
      else softPixels += 1;
    }
  }
  const totalPixels = spanX * spanY;
  const coverage = totalPixels === 0 ? 0 : (opaquePixels + softPixels) / totalPixels;
  return {
    tile,
    cls: classifyTileAlpha({ opaquePixels, softPixels, emptyPixels, totalPixels, coverage }),
    coverage,
    opaquePixels,
    softPixels,
    emptyPixels,
    totalPixels,
  };
}

type TileAlphaCounts = {
  readonly opaquePixels: number;
  readonly softPixels: number;
  readonly emptyPixels: number;
  readonly totalPixels: number;
  readonly coverage: number;
};

/**
 * 세 가지를 구분한다: 완전 불투명 / 부분 투명 / 완전 빈 칸.
 * 그리고 "거의 빈 칸"(mostlyEmpty)과 "가장자리 몇 픽셀만 부드러운 칸"(softEdge)을
 * 같은 부분 투명으로 뭉뚱그리지 않는다 — 전자는 하위에 깔면 사실상 구멍이고,
 * 후자는 안티에일리어싱일 뿐이라 하위 배치가 안전하다.
 */
export function classifyTileAlpha(counts: TileAlphaCounts): TileAlphaClass {
  const { opaquePixels, softPixels, emptyPixels, totalPixels, coverage } = counts;
  if (totalPixels === 0) return "unknown";
  if (emptyPixels === totalPixels) return "empty";
  if (emptyPixels === 0 && softPixels === 0) return "opaque";
  if (coverage <= MOSTLY_EMPTY_MAX_COVERAGE) return "mostlyEmpty";
  const nonOpaque = totalPixels - opaquePixels;
  // 구멍(완전 투명 픽셀)이 임계 이하로만 있거나, 반투명이 가장자리 수준으로만 있는 칸.
  if (nonOpaque <= Math.max(1, Math.round(totalPixels * SOFT_EDGE_MAX_RATIO))) return "softEdge";
  return "partial";
}

/** 스캔 요약 — 검토 UI 헤더와 증거 노트가 같은 숫자를 쓴다. */
export function summarizeTileAlphaScan(scan: TileAlphaScan): Readonly<Record<TileAlphaClass, number>> {
  const summary: Record<TileAlphaClass, number> = {
    opaque: 0,
    softEdge: 0,
    partial: 0,
    mostlyEmpty: 0,
    empty: 0,
    unknown: 0,
  };
  for (const sample of scan.samples) summary[sample.cls] += 1;
  return summary;
}
