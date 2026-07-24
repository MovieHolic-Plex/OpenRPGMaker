import {
  canonicalIceRidgeColumns,
  type IceDiagonalColumn,
  type IceDiagonalFace,
  type IceDiagonalLayer,
} from "@/project/defaults/iceDiagonalTerrain";
import {
  ICE_GRAND_EXPANSE_HEIGHT,
  ICE_GRAND_EXPANSE_WIDTH,
  type IceGrandExpanseRidgeConfig,
} from "@/project/defaults/iceGrandExpansePlan";

export const ICE_GRAND_EXPANSE_TERRAIN_ERROR_CODES = [
  "RIDGE_OUT_OF_BOUNDS",
  "RIDGE_DUPLICATE_ID",
  "RIDGE_ROLE_OMITTED",
  "RIDGE_COLUMN_CONFLICT",
  "RIDGE_CEILING_COLLISION",
  "RIDGE_STAMP_REJECTED",
] as const;

export type IceGrandExpanseTerrainErrorCode = (typeof ICE_GRAND_EXPANSE_TERRAIN_ERROR_CODES)[number];
export type IceGrandExpanseRoleKey = `${IceDiagonalFace}:${IceDiagonalLayer}`;
export type IceGrandExpanseRoleCounts = Readonly<Record<IceGrandExpanseRoleKey, number>>;

type ErrorLocation = {
  readonly ridgeId?: string;
  readonly x?: number;
  readonly y?: number;
};

export class IceGrandExpanseTerrainError extends Error {
  readonly code: IceGrandExpanseTerrainErrorCode;
  readonly ridgeId?: string;
  readonly x?: number;
  readonly y?: number;

  constructor(code: IceGrandExpanseTerrainErrorCode, location: ErrorLocation = {}) {
    super([code, location.ridgeId, location.x, location.y].filter((value) => value !== undefined).join(":"));
    this.name = "IceGrandExpanseTerrainError";
    this.code = code;
    this.ridgeId = location.ridgeId;
    this.x = location.x;
    this.y = location.y;
  }
}

export type IceGrandExpanseRidgeValidation = {
  readonly columns: readonly IceDiagonalColumn[];
  readonly roleCounts: IceGrandExpanseRoleCounts;
};

const CANONICAL_COLUMNS = canonicalIceRidgeColumns(0, 0);
const MIRROR_PIVOT = 11;

function mirroredFace(face: IceDiagonalFace): IceDiagonalFace {
  return face === "left" ? "right" : "left";
}

function expandRidge(config: IceGrandExpanseRidgeConfig): readonly IceDiagonalColumn[] {
  return config.motifOrigins.flatMap(([originX, originY]) => CANONICAL_COLUMNS.map((column) => ({
    x: originX + (config.direction === "rise" ? column.x : MIRROR_PIVOT - column.x),
    topY: originY + column.topY,
    bottomY: originY + column.bottomY,
    face: config.direction === "rise" ? column.face : mirroredFace(column.face),
  })));
}

export function expandIceGrandExpanseRidges(
  configs: readonly IceGrandExpanseRidgeConfig[],
): readonly IceDiagonalColumn[] {
  const columns = configs.flatMap(expandRidge);
  return columns.sort((left, right) => (
    left.x - right.x
    || left.topY - right.topY
    || left.bottomY - right.bottomY
    || left.face.localeCompare(right.face)
  ));
}

function roleKey(face: IceDiagonalFace, layer: IceDiagonalLayer): IceGrandExpanseRoleKey {
  return `${face}:${layer}`;
}

function columnCells(column: IceDiagonalColumn): readonly { readonly x: number; readonly y: number; readonly role: IceGrandExpanseRoleKey }[] {
  const cells: { readonly x: number; readonly y: number; readonly role: IceGrandExpanseRoleKey }[] = [];
  for (let y = column.topY; y <= column.bottomY; y += 1) {
    const layer = y === column.topY ? "cap" : y === column.bottomY ? "base" : "body";
    cells.push({ x: column.x, y, role: roleKey(column.face, layer) });
  }
  return cells;
}

export function validateIceGrandExpanseRidgeConfig(
  configs: readonly IceGrandExpanseRidgeConfig[],
  ceilingMask: Uint8Array,
): IceGrandExpanseRidgeValidation {
  const ids = new Set<string>();
  for (const config of configs) {
    if (ids.has(config.id)) throw new IceGrandExpanseTerrainError("RIDGE_DUPLICATE_ID", { ridgeId: config.id });
    ids.add(config.id);
  }

  const columnsByConfig = configs.map((config) => ({ config, columns: expandRidge(config) }));
  for (const { config, columns } of columnsByConfig) {
    for (const column of columns) {
      if (column.x < 0 || column.x >= ICE_GRAND_EXPANSE_WIDTH || column.topY < 0 || column.bottomY >= ICE_GRAND_EXPANSE_HEIGHT) {
        throw new IceGrandExpanseTerrainError("RIDGE_OUT_OF_BOUNDS", { ridgeId: config.id, x: column.x, y: column.topY });
      }
    }
  }

  const assignments = new Map<number, IceGrandExpanseRoleKey>();
  const roleCounts: Record<IceGrandExpanseRoleKey, number> = {
    "left:cap": 0,
    "left:body": 0,
    "left:base": 0,
    "right:cap": 0,
    "right:body": 0,
    "right:base": 0,
  };
  for (const { config, columns } of columnsByConfig) {
    for (const column of columns) {
      for (const cell of columnCells(column)) {
        const index = cell.y * ICE_GRAND_EXPANSE_WIDTH + cell.x;
        const assigned = assignments.get(index);
        if (assigned !== undefined && assigned !== cell.role) {
          throw new IceGrandExpanseTerrainError("RIDGE_COLUMN_CONFLICT", { ridgeId: config.id, x: cell.x, y: cell.y });
        }
        if (ceilingMask[index] === 1) {
          throw new IceGrandExpanseTerrainError("RIDGE_CEILING_COLLISION", { ridgeId: config.id, x: cell.x, y: cell.y });
        }
        if (assigned === undefined) {
          assignments.set(index, cell.role);
          roleCounts[cell.role] += 1;
        }
      }
    }
  }
  const omitted = Object.entries(roleCounts).find(([, count]) => count === 0);
  if (omitted !== undefined) throw new IceGrandExpanseTerrainError("RIDGE_ROLE_OMITTED");
  return { columns: expandIceGrandExpanseRidges(configs), roleCounts };
}
