// editor/comboBrush.ts
// Combo Brush — 여러 칸을 한 단위로 찍는 붓의 순수 모델. store·DOM 의존 없음.
//
// 왜 별 파일인가: `tilePaletteStamp.ts` 는 **드래그 좌표 → 스탬프** 변환만 안다.
// 반복 배치·경계 처리·차단 진단은 맵을 알아야 하는 다른 물음이고, 호버 미리보기와
// 실제 페인트가 **같은 답**을 내야 한다(예전에는 두 곳이 각자 `x < map.width` 를 세어
// 미리보기와 결과가 어긋날 수 있었다). 그 계산을 여기 하나로 모은다.
//
// 용어 (openwiki/editor-pre-edit-routing.md 「Combo Brush」 항목과 같은 말):
//  · Combo Brush  = 서로 다른 칸이 모인 **합성** 붓. 원본 배열이 정보다.
//  · 브러시 크기   = 같은 타일 하나를 N×N 으로 되풀이하는 것. 배열 정보가 없다.
// 이 둘은 UI 에서 반드시 다르게 보여야 한다 — `comboBrushBadge` 가 그 한 곳이다.

import type { PaletteStamp, PaletteStampCell } from "@/editor/tilePaletteStamp";

/** 붓이 어디서 왔는가 — UI 배지와 진단 문구가 이 값으로 갈린다. */
export type ComboBrushOrigin = "curated" | "palette-drag" | "structure-kit";

export type ComboBrushBounds = {
  readonly height: number;
  readonly width: number;
};

/** 한 칸의 배치 계획. `inBounds:false` 는 맵 밖으로 잘리는 칸(미리보기에서 보여야 한다). */
export type ComboBrushPlacementCell = {
  readonly cell: PaletteStampCell;
  readonly inBounds: boolean;
  readonly x: number;
  readonly y: number;
};

export type ComboBrushPlacement = {
  /** 잘려서 안 찍히는 칸 수. 0 이면 발자국 전체가 맵 안이다. */
  readonly clippedCount: number;
  readonly cells: readonly ComboBrushPlacementCell[];
  readonly height: number;
  /** 실제로 써질 칸(= inBounds 인 칸). 빈 배열이면 배치가 성립하지 않는다. */
  readonly paintableCells: readonly ComboBrushPlacementCell[];
  readonly width: number;
};

export type ComboBrushDiagnosticCode = "fully-out-of-bounds" | "partial-out-of-bounds";

export type ComboBrushDiagnostic = {
  readonly code: ComboBrushDiagnosticCode;
  readonly text: string;
};

export type ComboBrushVerdict =
  | { readonly ok: true; readonly placement: ComboBrushPlacement; readonly warning: ComboBrushDiagnostic | null }
  | { readonly ok: false; readonly diagnostic: ComboBrushDiagnostic; readonly placement: ComboBrushPlacement };

/**
 * 합성 붓인가 — 칸이 2개 이상이면 배열이 정보다.
 *
 * 1칸 스탬프(구조 킷 1칸·팔레트 단일 선택)는 Combo Brush 가 아니다. 그 경우 기존
 * 오토타일 성형·브러시 크기 규칙이 그대로 살아야 한다(TilePaintEngine.applyPaletteStamp).
 */
export function isComboBrush(stamp: PaletteStamp | null): boolean {
  return (stamp?.cells.length ?? 0) > 1;
}

/** 붓의 출처. 옛 스탬프(필드 없음)는 kitId 유무로 갈라 하위 호환을 지킨다. */
export function comboBrushOrigin(stamp: PaletteStamp): ComboBrushOrigin {
  if (stamp.origin) return stamp.origin;
  return stamp.kitId ? "structure-kit" : "palette-drag";
}

/** 붓의 레이어 구성 — 「바닥」·「덧그림」·「바닥+덧그림」. 레이어 라우팅을 눈으로 확인하는 자리. */
export function comboBrushLayerSummary(stamp: PaletteStamp): "lower" | "upper" | "mixed" {
  let lower = false;
  let upper = false;
  for (const cell of stamp.cells) {
    if (cell.layer === "upper") upper = true;
    else lower = true;
    if (lower && upper) return "mixed";
  }
  return upper ? "upper" : "lower";
}

/**
 * 사이드바·상태칩이 쓰는 한 줄 배지. **합성 붓과 반복 붓을 여기서 구분한다.**
 * 반복 붓(브러시 크기)은 이 함수를 타지 않고 "크기 N × N" 으로 표기된다.
 */
export function comboBrushBadge(stamp: PaletteStamp): string {
  const layer = { lower: "바닥", mixed: "바닥+덧그림", upper: "덧그림" }[comboBrushLayerSummary(stamp)];
  return `조합 붓 ${stamp.width}×${stamp.height} · ${stamp.cells.length}칸 · ${layer}`;
}

/**
 * 붓을 (x, y) 원점에 대고 칸마다 좌표를 푼다 — **미리보기와 페인트가 공유하는 유일한 계산.**
 * 맵 밖 칸도 목록에 남긴다(`inBounds:false`) — 미리보기가 "여기는 잘린다"를 보여야 한다.
 */
export function comboBrushPlacement(input: {
  readonly bounds: ComboBrushBounds;
  readonly stamp: PaletteStamp;
  readonly x: number;
  readonly y: number;
}): ComboBrushPlacement {
  const cells: ComboBrushPlacementCell[] = [];
  const paintable: ComboBrushPlacementCell[] = [];
  for (const cell of input.stamp.cells) {
    const x = input.x + cell.dx;
    const y = input.y + cell.dy;
    const inBounds = x >= 0 && y >= 0 && x < input.bounds.width && y < input.bounds.height;
    const placed: ComboBrushPlacementCell = { cell, inBounds, x, y };
    cells.push(placed);
    if (inBounds) paintable.push(placed);
  }
  return {
    cells,
    clippedCount: cells.length - paintable.length,
    height: input.stamp.height,
    paintableCells: paintable,
    width: input.stamp.width,
  };
}

/**
 * 이 자리에 찍어도 되는가.
 *
 * 두 결과만 있다:
 *  · 발자국이 **통째로** 맵 밖이면 거부한다 — 아무 칸도 쓰지 않으므로 패턴이 반쯤 남지 않는다.
 *  · 일부만 잘리면 허용하고 **경고**를 돌려준다. 사용자가 경계에 붙여 찍는 것은 정상 저작이고,
 *    잘린 칸은 애초에 쓰지 않으므로 "패턴 반쪽 손상"이 아니다(맵 안 칸은 전부 원본 배열대로 들어간다).
 *
 * 구조 킷의 `kit.ai.placement` hard 조건은 여기가 아니라 `checkKitStampConditions` 가 본다 —
 * 두 검사는 서로를 확장하지 않는다(OPRN-OUT-017 과 같은 경계).
 */
export function evaluateComboBrushPlacement(input: {
  readonly bounds: ComboBrushBounds;
  readonly stamp: PaletteStamp;
  readonly x: number;
  readonly y: number;
}): ComboBrushVerdict {
  const placement = comboBrushPlacement(input);
  if (placement.paintableCells.length === 0) {
    return {
      diagnostic: {
        code: "fully-out-of-bounds",
        text: `조합 붓 ${placement.width}×${placement.height}이 맵(${input.bounds.width}×${input.bounds.height}) 밖입니다 — 맵 안쪽을 눌러 주세요.`,
      },
      ok: false,
      placement,
    };
  }
  if (placement.clippedCount > 0) {
    return {
      ok: true,
      placement,
      warning: {
        code: "partial-out-of-bounds",
        text: `맵 경계에서 ${placement.clippedCount}칸이 잘립니다 — 맵 안쪽 ${placement.paintableCells.length}칸만 찍습니다.`,
      },
    };
  }
  return { ok: true, placement, warning: null };
}

/** 원본 배열 보존 검사용 — 붓 셀을 dy→dx→layer 순으로 정규화한다(테스트·서명 공통 규약). */
export function comboBrushCellOrder(cells: readonly PaletteStampCell[]): readonly PaletteStampCell[] {
  return [...cells].sort((a, b) => a.dy - b.dy || a.dx - b.dx || a.layer.localeCompare(b.layer));
}
