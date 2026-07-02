import { RESOURCE_SLICING, gridResourceSlicing, type ResourceSlicingSpec } from "@/assets/resourceSlicing";
import type { ResourceKind } from "./types";

export type ResourceProfileSpec = {
  readonly kind: ResourceKind;
  readonly label: string;
  readonly slicing: ResourceSlicingSpec;
  readonly tileWidth?: number;
  readonly tileHeight?: number;
  readonly expectedWidth?: number;
  readonly expectedHeight?: number;
  readonly media: "image" | "audio";
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
  imageSpec("faceset", "얼굴 그래픽"),
  imageSpec("picture", "그림"),
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
  if (spec.media === "audio") return { ok: true, message: `${spec.label}: 오디오 리소스` };
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
