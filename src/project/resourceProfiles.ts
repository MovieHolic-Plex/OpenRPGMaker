import { FACE_IMAGE_SIZE, RESOURCE_SLICING, gridResourceSlicing, type ResourceSlicingSpec } from "@/assets/resourceSlicing";
import type { ResourceKind } from "./types";

export type ResourceProfileSpec = {
  readonly kind: ResourceKind;
  readonly label: string;
  readonly slicing: ResourceSlicingSpec;
  readonly tileWidth?: number;
  readonly tileHeight?: number;
  readonly expectedWidth?: number;
  readonly expectedHeight?: number;
  readonly media: "image" | "audio" | "video";
};

export type ResourceDimensionResult =
  | { ok: true; tilesPerRow?: number; tileCount?: number; message: string }
  | { ok: false; message: string };

export const RESOURCE_PROFILE_SPECS: readonly ResourceProfileSpec[] = [
  imageSpec("chipset", "칩셋"),
  imageSpec("charset", "캐릭터셋"),
  imageSpec("battle", "전투 애니메이션"),
  imageSpec("battleCharset", "전투 캐릭터셋"),
  imageSpec("battleWeapon", "전투 무기"),
  imageSpec("backdrop", "전투 배경"),
  imageSpec("gameOver", "게임 오버"),
  imageSpec("monster", "몬스터"),
  imageSpec("faceset", "얼굴 그래픽", FACE_IMAGE_SIZE, FACE_IMAGE_SIZE),
  imageSpec("picture", "그림"),
  { kind: "movie", label: "동영상", slicing: RESOURCE_SLICING.movie, media: "video" },
  imageSpec("system", "시스템"),
  imageSpec("system2", "시스템 2"),
  imageSpec("title", "타이틀"),
  audioSpec("music", "음악"),
  audioSpec("sound", "효과음"),
];

export function getResourceProfileSpec(kind: ResourceKind): ResourceProfileSpec {
  return RESOURCE_PROFILE_SPECS.find((spec) => spec.kind === kind) ?? RESOURCE_PROFILE_SPECS[0];
}

export function validateResourceDimensions(kind: ResourceKind, width: number, height: number): ResourceDimensionResult {
  const spec = getResourceProfileSpec(kind);
  if (spec.media === "audio") return { ok: true, message: `${spec.label}: 오디오 리소스 (이미지 규격 검사는 생략)` };
  if (spec.media === "video") return { ok: true, message: `${spec.label}: 동영상 리소스 (이미지 규격 검사는 생략)` };
  if (kind === "faceset") return validateFacesetDimensions(spec, width, height);
  if (spec.expectedWidth !== undefined && spec.expectedHeight !== undefined) {
    if (width !== spec.expectedWidth || height !== spec.expectedHeight) {
      return {
        ok: false,
        message: `${spec.label}: ${spec.expectedWidth}x${spec.expectedHeight} 크기가 필요합니다. 현재 ${width}x${height}입니다.`,
      };
    }
  }
  const grid = gridResourceSlicing(kind);
  if (grid !== undefined) {
    if (width % grid.cellWidth !== 0 || height % grid.cellHeight !== 0) {
      return {
        ok: false,
        message: `${spec.label}: 크기는 ${grid.cellWidth}x${grid.cellHeight} 단위에 맞아야 합니다.`,
      };
    }
    return {
      ok: true,
      tilesPerRow: width / grid.cellWidth,
      tileCount: (width / grid.cellWidth) * (height / grid.cellHeight),
      message: `${spec.label}: ${width}x${height}, ${grid.cellWidth}x${grid.cellHeight}`,
    };
  }
  return { ok: true, message: `${spec.label}: ${width}x${height}` };
}

function validateFacesetDimensions(spec: ResourceProfileSpec, width: number, height: number): ResourceDimensionResult {
  if (width === FACE_IMAGE_SIZE && height === FACE_IMAGE_SIZE) {
    return { ok: true, tilesPerRow: 1, tileCount: 1, message: `${spec.label}: ${width}x${height} 얼굴 한 장` };
  }
  // 분할 전 시트(192x192 등)는 디스크에 그대로 남아 있고 프로필도 유지된다 — 그래서 48 배수
  // 정사각형은 계속 통과시키고 칸 수를 tileCount 로 보고한다. 새로 만드는 얼굴은 48x48 이다.
  const isLegacySheet = width === height && width > FACE_IMAGE_SIZE && width % FACE_IMAGE_SIZE === 0;
  if (isLegacySheet) {
    const perSide = width / FACE_IMAGE_SIZE;
    return {
      ok: true,
      tilesPerRow: perSide,
      tileCount: perSide * perSide,
      message: `${spec.label}: ${width}x${height} 레거시 시트 (${perSide * perSide}칸)`,
    };
  }
  return {
    ok: false,
    message: `${spec.label}: ${FACE_IMAGE_SIZE}x${FACE_IMAGE_SIZE} 얼굴 한 장이 필요합니다. 현재 ${width}x${height}입니다.`,
  };
}

function imageSpec(kind: ResourceKind, label: string, expectedWidth?: number, expectedHeight?: number): ResourceProfileSpec {
  const grid = gridResourceSlicing(kind);
  const sheetWidth = expectedWidth ?? grid?.sheetWidth;
  const sheetHeight = expectedHeight ?? grid?.sheetHeight;
  return {
    kind,
    label,
    slicing: RESOURCE_SLICING[kind],
    ...(grid ? { tileWidth: grid.cellWidth, tileHeight: grid.cellHeight } : {}),
    ...(sheetWidth !== undefined && sheetHeight !== undefined ? { expectedWidth: sheetWidth, expectedHeight: sheetHeight } : {}),
    media: "image",
  };
}

function audioSpec(kind: ResourceKind, label: string): ResourceProfileSpec {
  return {
    kind,
    label,
    slicing: RESOURCE_SLICING[kind],
    media: "audio",
  };
}
