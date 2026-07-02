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
  battleCharset: {
    kind: "grid",
    unit: "battle-character",
    cellWidth: 48,
    cellHeight: 48,
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
  faceset: {
    kind: "grid",
    unit: "face",
    cellWidth: 48,
    cellHeight: 48,
    columns: 4,
    rows: 4,
    count: 16,
    sheetWidth: 192,
    sheetHeight: 192,
  },
  picture: { kind: "whole-image", unit: "image" },
  system: { kind: "whole-image", unit: "image" },
  system2: { kind: "whole-image", unit: "image" },
  title: { kind: "whole-image", unit: "image" },
  music: { kind: "audio", unit: "audio" },
  sound: { kind: "audio", unit: "audio" },
} as const satisfies Record<ResourceKind, ResourceSlicingSpec>;

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
