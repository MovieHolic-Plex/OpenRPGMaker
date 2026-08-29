import type { ResourceKind } from "@/project/types";

export type ResourceSlicingSpec =
  | {
      readonly kind: "grid";
      readonly unit: "battle-character" | "battle-weapon" | "charset-frame" | "face" | "sprite-frame" | "tile";
      readonly cellWidth: number;
      readonly cellHeight: number;
      readonly columns?: number;
      readonly rows?: number;
      readonly count?: number;
      readonly sheetWidth?: number;
      readonly sheetHeight?: number;
      readonly subcell?: {
        readonly unit: "quarter-tile";
        readonly cellWidth: number;
        readonly cellHeight: number;
      };
    }
  | {
      readonly kind: "whole-image";
      readonly unit: "image";
    }
  | {
      readonly kind: "audio";
      readonly unit: "audio";
    };

export const RESOURCE_SLICING = {
  chipset: {
    kind: "grid",
    unit: "tile",
    cellWidth: 16,
    cellHeight: 16,
    columns: 30,
    rows: 16,
    count: 480,
    sheetWidth: 480,
    sheetHeight: 256,
    subcell: { unit: "quarter-tile", cellWidth: 8, cellHeight: 8 },
  },
  charset: {
    kind: "grid",
    unit: "charset-frame",
    cellWidth: 24,
    cellHeight: 32,
    columns: 12,
    rows: 8,
    count: 96,
    sheetWidth: 288,
    sheetHeight: 256,
  },
  battle: { kind: "whole-image", unit: "image" },
  // 48px 셀 3열×8행 = 24프레임(144×384). battleWeapon 과 같은 3×8 구조이고,
  // 런타임의 backgroundSize 산식(src/player/battleFieldDom.ts)이 이 값에 의존한다.
  // 어느 프레임에 어느 포즈가 들어가는지는 src/battle/battlePose.ts 가 정한다.
  battleCharset: {
    kind: "grid",
    unit: "battle-character",
    cellWidth: 48,
    cellHeight: 48,
    columns: 3,
    rows: 8,
    count: 24,
    sheetWidth: 144,
    sheetHeight: 384,
  },
  battleWeapon: {
    kind: "grid",
    unit: "battle-weapon",
    cellWidth: 64,
    cellHeight: 64,
    columns: 3,
    rows: 8,
    count: 24,
    sheetWidth: 192,
    sheetHeight: 512,
  },
  backdrop: { kind: "whole-image", unit: "image" },
  gameOver: { kind: "whole-image", unit: "image" },
  monster: { kind: "whole-image", unit: "image" },
  // 얼굴은 그림 한 장이다. 4x4 시트 + 칸 번호 모델은 파일 분할(scripts/slice-faceset-sheets.mjs)로 끝났다.
  faceset: { kind: "whole-image", unit: "image" },
  picture: { kind: "whole-image", unit: "image" },
  system: { kind: "whole-image", unit: "image" },
  system2: { kind: "whole-image", unit: "image" },
  title: { kind: "whole-image", unit: "image" },
  music: { kind: "audio", unit: "audio" },
  sound: { kind: "audio", unit: "audio" },
} as const satisfies Record<ResourceKind, ResourceSlicingSpec>;

/** 얼굴 낱장 한 장의 크기. 표시 배율 계산의 기준값이다. */
export const FACE_IMAGE_SIZE = 48;

export const BUILTIN_SPRITE_SLICING = {
  kind: "grid",
  unit: "sprite-frame",
  cellWidth: 32,
  cellHeight: 32,
  columns: 2,
  rows: 4,
  count: 8,
} as const satisfies ResourceSlicingSpec;

export type GridResourceSlicing = Extract<ResourceSlicingSpec, { readonly kind: "grid" }>;

export function gridResourceSlicing(kind: ResourceKind): GridResourceSlicing | undefined {
  const slicing = RESOURCE_SLICING[kind];
  return slicing.kind === "grid" ? slicing : undefined;
}
