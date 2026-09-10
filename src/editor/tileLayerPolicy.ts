// 타일 레이어·배경 정책 — "투명하다"는 사실과 "어느 레이어에 산다"는 결정을 분리한다.
//
// 왜 분리하는가 (OPRN-OUT-026): 투명 배경 칩을 전부 상위로 올리는 규칙은 나무 밑동
// 290~293 에서 깨진다. 밑동은 수관(상위)과 같은 칸에 공존해야 하므로 **하위에 남고**,
// 렌더러가 투명 픽셀 아래에 잔디를 깔아 검은 구멍을 막는다. 즉 같은 "투명" 칩이
// 세 가지 서로 다른 계약을 가진다:
//   - 상위 오버레이(벤치 357): 하위 지면을 보존해야 하므로 상위.
//   - 받침 있는 하위 합성(밑동 290~293): 하위 + 받침 타일 합성.
//   - 의도적 투명 하위: 사용자가 하위로 확정했고 받침을 원하지 않는 경우.
// 여기에 다중 조각 제약(밑동+수관처럼 다른 칸의 조각이 레이어 선택을 묶는 경우)과
// 불투명 바닥을 더해 다섯 부류가 된다. 이 모듈은 그 판정을 **한 곳에서** 계산하고,
// 편집기 미리보기·런타임 렌더러·검토 UI·테스트가 같은 답을 쓰게 한다.
//
// 이 모듈은 분류를 바꾸지 않는다. 기존 판정(tileLayerHome)을 그대로 읽고 설명·받침
// 전략만 덧붙인다. 커스텀 칩셋 가져오기에서도 자동 변형을 하지 않고 **검토 항목**만
// 만든다 — 자동·되돌릴 수 없는 재분류는 OPRN-OUT-026 의 범위 밖이다.
//
// 커스텀 칩셋 픽셀 감지(2026-09-10): 명시 `투명` 태그가 없는 사용자 칩셋도 실제 알파를
// 스캔해 투명 여부를 안다. 감지는 **주입**된다 — 이 모듈은 DOM 을 모르고, 런타임 렌더러가
// 쓰는 `tileBackingTile` 경로도 감지 없이 예전과 똑같이 동작한다. 감지가 하는 일은
// 검토 목록에 항목을 띄우는 것뿐이고, 메타 변경은 사용자 선택에서만 일어난다.
import { tileLayerHome, type TileLayerHome } from "@/editor/tileLayerClassification";
import {
  alphaClassHasTransparency,
  isReviewableAlphaClass,
  type TileAlphaClass,
  type TileAlphaSample,
} from "@/project/tileAlphaScan";
import { userTileBackingOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { isTransparentChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { isCombinedTownTileset, isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import { isCustomTileset } from "@/project/tilesetKind";
import type { TilesetDef } from "@/project/types";

/** 타일이 속하는 레이어·배경 계약의 부류. */
export type TileLayerPolicyClass =
  /** 불투명 바닥/벽면 — 하위에 그대로 산다. */
  | "opaqueFloor"
  /** 투명 소품 — 상위에서 하위 지면을 보존한다. */
  | "transparentOverlay"
  /** 받침이 필요한 하위 합성 — 하위에 살면서 받침 타일과 함께 그려진다. */
  | "backedLower"
  /** 의도적 투명 하위 — 사용자가 하위로 확정하고 받침을 쓰지 않는다. */
  | "transparentLower"
  /** 다중 조각 제약 — 다른 칸의 조각(수관 등)이 이 타일의 레이어 선택을 묶는다. */
  | "multiPart";

export type TileLayerPolicy = {
  /** 이 타일의 홈 레이어(기존 판정과 동일). */
  readonly home: TileLayerHome;
  /** 칩에 투명 픽셀이 있는가(시각 사실). */
  readonly transparent: boolean;
  readonly kind: TileLayerPolicyClass;
  /** 하위에 그릴 때 아래에 함께 깔 타일. 없으면 null. */
  readonly backingTile: number | null;
  /** 다중 조각 제약이 있으면 짝 조각 설명. */
  readonly multiPart: { readonly partnerLabel: string; readonly partnerTiles: readonly number[] } | null;
  /** 판정 근거의 출처. `detected` 는 커스텀 칩셋 픽셀 스캔에서 왔다. */
  readonly source: "user" | "harness" | "transparency" | "priority" | "detected";
  /** 픽셀 감지 결과(주입됐고 이 타일에 해당할 때만). 없으면 감지를 안 썼다는 뜻. */
  readonly detected: TileAlphaClass | null;
  /** 사람이 읽는 근거(편집기 표시·검토 목록에 그대로 쓴다). */
  readonly reason: string;
};

const TRUNK_TILES = [290, 291, 292, 293] as const;
const CANOPY_TILES = [260, 261, 262, 263] as const;

/** 기본 칩셋 나무 밑동의 받침 — 런타임 렌더러가 예전부터 깔던 잔디와 같은 타일. */
export const DEFAULT_TRUNK_BACKING_TILE = TILE.GRASS;

function isDefaultTransparent(tileset: TilesetDef, tile: number): boolean {
  return isCombinedTownTileset(tileset) && isTransparentChipsetTile(tile);
}

/**
 * 픽셀 감지 주입 지점. 감지는 이 모듈 밖에서 이미 끝난 상태로 들어온다.
 *
 * 주입으로 둔 이유: 정책 모듈은 DOM·비동기를 모르는 순수 함수로 남아야 한다. 런타임
 * 렌더러가 쓰는 `tileBackingTile` 경로는 감지 없이 예전과 똑같이 동작하고, 감지는
 * 검토 목록을 부르는 편집기 표면에서만 달린다.
 */
export type TileTransparencyDetection = {
  readonly classOf: (tile: number) => TileAlphaClass | null;
  readonly sampleOf?: (tile: number) => TileAlphaSample | null;
};

export function tileLayerPolicy(
  tileset: TilesetDef,
  tile: number,
  detection?: TileTransparencyDetection,
): TileLayerPolicy {
  const home = tileLayerHome(tileset, tile);
  // 감지는 커스텀 칩셋에만 보기로 붙는다 — 내장 칩셋은 생성 목록이 정본이다.
  const detected = isCustomTileset(tileset) ? detection?.classOf(tile) ?? null : null;
  const taggedTransparent = isCustomTileset(tileset) && customTileHasTransparency(tileset, tile);
  const detectedTransparent = detected !== null && alphaClassHasTransparency(detected);
  const transparent = isDefaultTransparent(tileset, tile) || taggedTransparent || detectedTransparent;
  const override = userTileLayerOverride(tileset, tile);
  const backing = resolveBackingTile(tileset, tile, home);
  // 명시 `투명` 태그가 없을 때만 감지를 근거의 출처로 적는다 — 태그가 우선이다.
  const detectedSource = detectedTransparent && !taggedTransparent;

  if (isCombinedTownTileset(tileset) && isTreeTrunkTileId(tile)) {
    return {
      home,
      transparent,
      detected,
      kind: home === "upper" ? "transparentOverlay" : backing === null ? "transparentLower" : "backedLower",
      backingTile: backing,
      multiPart: { partnerLabel: "나무 수관", partnerTiles: CANOPY_TILES },
      source: override ? "user" : "harness",
      reason: trunkReason(tileset, tile, home, backing, override),
    };
  }

  if (isCombinedTownTileset(tileset) && isTreeCanopyTileId(tile)) {
    return {
      home,
      transparent,
      detected,
      kind: "multiPart",
      backingTile: backing,
      multiPart: { partnerLabel: "나무 밑동", partnerTiles: TRUNK_TILES },
      source: override ? "user" : "harness",
      reason: "나무 수관은 상위 전용입니다 — 아래 칸의 밑동과 짝을 이뤄 한 그루를 만듭니다.",
    };
  }

  if (!transparent) {
    return {
      home,
      transparent: false,
      detected,
      kind: home === "upper" ? "transparentOverlay" : "opaqueFloor",
      backingTile: null,
      multiPart: null,
      source: override ? "user" : isCustomTileset(tileset) ? "priority" : "harness",
      reason: home === "upper"
        ? "불투명 칩이지만 상위가 홈입니다(소품/구조물) — 하위 지면을 보존합니다."
        : detected === "unknown"
          ? "픽셀을 읽지 못해 투명 여부를 알 수 없습니다 — 불투명이라고 단정하지 않았습니다."
          : "불투명 바닥/벽면이므로 하위에 그대로 놓입니다. 받침이 필요 없습니다.",
    };
  }

  if (home === "upper") {
    return {
      home,
      transparent: true,
      detected,
      kind: "transparentOverlay",
      backingTile: null,
      multiPart: null,
      source: override ? "user" : detectedSource ? "detected" : "transparency",
      reason: "투명 배경 칩이라 상위 오버레이입니다 — 하위 지면이 투명 픽셀 아래로 보입니다.",
    };
  }

  const detectionNote = describeDetection(detected, detection?.sampleOf?.(tile) ?? null);
  return {
    home,
    transparent: true,
    detected,
    kind: backing === null ? "transparentLower" : "backedLower",
    backingTile: backing,
    multiPart: null,
    source: override ? "user" : detectedSource ? "detected" : isCustomTileset(tileset) ? "priority" : "transparency",
    reason: backing === null
      ? `투명 칩을 하위에 두되 받침이 없습니다 — 투명 부분 아래가 비어 보일 수 있습니다(의도적 선택).${detectionNote}`
      : `투명 칩을 하위에 두고 받침 타일 ${backing} 을 함께 그립니다.${detectionNote}`,
  };
}

/**
 * 밑동의 근거 문장. 받침을 "없음"으로 확정하면 부류가 `transparentLower` 로 바뀌는데,
 * 근거만 "받침 타일로 투명 픽셀을 채웁니다" 로 고정되어 바로 위 경고("받침 없이 하위에
 * 깔면 투명 부분이 검게 보일 수 있습니다")와 정면으로 모순됐다
 * (브라우저 실측 2026-09-10, verify-shots/oprn-026/03-backing-none-warning.png).
 */
function trunkReason(
  tileset: TilesetDef,
  tile: number,
  home: TileLayerHome,
  backing: number | null,
  override: "lower" | "upper" | null,
): string {
  if (override) {
    return `사용자가 ${override === "lower" ? "하위" : "상위"}로 확정했습니다. 밑동은 수관과 같은 칸에 겹치므로 레이어를 바꾸면 숲 합성이 달라집니다.`;
  }
  if (home !== "upper" && backing === null) {
    return userTileBackingOverride(tileset, tile) === "none"
      ? "나무 밑동은 수관(상위)과 같은 칸에 공존해야 하므로 하위에 남지만, 사용자가 받침을 없음으로 확정해 투명 픽셀 아래가 비어 보일 수 있습니다."
      : "나무 밑동은 수관(상위)과 같은 칸에 공존해야 하므로 하위에 남지만, 받침이 없어 투명 픽셀 아래가 비어 보일 수 있습니다.";
  }
  return "나무 밑동은 수관(상위)과 같은 칸에 공존해야 하므로 투명해도 하위에 남고, 받침 타일로 투명 픽셀을 채웁니다.";
}

/** 감지 부류의 사람이 읽는 이름 — 편집기·검토 목록·증거 노트가 같은 말을 쓴다. */
export const TILE_ALPHA_CLASS_LABELS: Readonly<Record<TileAlphaClass, string>> = {
  opaque: "불투명",
  softEdge: "가장자리만 부드러움",
  partial: "부분 투명",
  mostlyEmpty: "거의 빈 칸",
  empty: "완전히 빈 칸",
  unknown: "알 수 없음",
};

/** 감지 근거를 문장으로. 사용자가 실측 수치를 보고 선택하게 하는 것이 목적이다. */
function describeDetection(detected: TileAlphaClass | null, sample: TileAlphaSample | null): string {
  if (detected === null) return "";
  if (detected === "unknown") return " 픽셀 감지: 알 수 없음(이미지를 읽지 못함).";
  const label = TILE_ALPHA_CLASS_LABELS[detected];
  if (!sample) return ` 픽셀 감지: ${label}.`;
  const coverage = Math.round(sample.coverage * 1000) / 10;
  return ` 픽셀 감지: ${label}(커버리지 ${coverage}%, 투명 ${sample.emptyPixels}px, 반투명 ${sample.softPixels}px).`;
}

// 편집기 미리보기와 런타임 렌더러가 같은 받침 답을 쓰도록 이 함수 하나만 부른다.
export function tileBackingTile(tileset: TilesetDef, tile: number): number | null {
  return resolveBackingTile(tileset, tile, tileLayerHome(tileset, tile));
}

function resolveBackingTile(tileset: TilesetDef, tile: number, home: TileLayerHome): number | null {
  if (home === "upper") return null;
  const choice = userTileBackingOverride(tileset, tile);
  if (choice === "none") return null;
  if (typeof choice === "number") return choice;
  // 기본값: 기본 칩셋 나무 밑동만 잔디 받침(기존 렌더 동작과 동일).
  if (isCombinedTownTileset(tileset) && isTreeTrunkTileId(tile) && isTransparentChipsetTile(tile)) {
    return DEFAULT_TRUNK_BACKING_TILE;
  }
  return null;
}

/** 커스텀 칩셋의 투명 여부 — 명시 메타가 없으면 알 수 없음(false)으로 둔다. */
function customTileHasTransparency(tileset: TilesetDef, tile: number): boolean {
  return tileset.tileMeta?.[tile]?.tags?.includes("투명") === true;
}

export type BackgroundlessLowerReview = {
  readonly tile: number;
  readonly home: TileLayerHome;
  readonly kind: TileLayerPolicyClass;
  readonly backingTile: number | null;
  readonly reason: string;
  /** 이 항목이 픽셀 감지에서 왔으면 그 부류. 명시 태그·하네스에서 왔으면 null. */
  readonly detected: TileAlphaClass | null;
  /** 사용자에게 제시할 선택지 — 적용은 사용자 행동에서만 일어난다. */
  readonly choices: readonly TileLayerReviewChoice[];
};

export type TileLayerReviewChoice = "overlay" | "lowerWithBacking" | "transparentLower" | "auto";

export const TILE_LAYER_REVIEW_CHOICE_LABELS: Readonly<Record<TileLayerReviewChoice, string>> = {
  overlay: "상위 오버레이",
  lowerWithBacking: "하위 + 받침",
  transparentLower: "투명 하위 유지",
  auto: "자동 판정",
};

/**
 * 배경 없는(투명) 타일 중 **하위에 살면서 받침이 없는** 것들을 검토 항목으로 모은다.
 *
 * 계약: 이 함수는 타일셋을 변형하지 않는다. 가져오기·준비 단계에서 전부 상위로 올리는
 * 자동 재분류는 금지이고(OPRN-OUT-026 범위 경계), 대신 사용자가 항목마다 선택한다.
 */
export function backgroundlessLowerReviews(
  tileset: TilesetDef,
  detection?: TileTransparencyDetection,
): readonly BackgroundlessLowerReview[] {
  const reviews: BackgroundlessLowerReview[] = [];
  for (let tile = 0; tile < tileset.count; tile += 1) {
    const policy = tileLayerPolicy(tileset, tile, detection);
    if (!policy.transparent) continue;
    if (policy.home === "upper") continue;
    if (policy.kind === "backedLower") continue;
    // 감지에서만 온 항목은 **뚫린 투명**(partial·mostlyEmpty)만 올린다. 가장자리 안티에일리어싱
    // (softEdge)과 완전히 빈 여백(empty)은 하위에 깔아도 검은 구멍이 안 나므로 목록만 오염시킨다.
    // 실측(modern-city-atlas 480칸): 이 규칙이 softEdge 36칸·empty 22칸을 걸러낸다.
    if (policy.source === "detected" && !isReviewableAlphaClass(policy.detected ?? "unknown")) continue;
    reviews.push({
      tile,
      home: policy.home,
      kind: policy.kind,
      backingTile: policy.backingTile,
      reason: policy.reason,
      detected: policy.source === "detected" ? policy.detected : null,
      choices: ["overlay", "lowerWithBacking", "transparentLower", "auto"],
    });
  }
  return reviews;
}
