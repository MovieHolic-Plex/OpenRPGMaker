import type { MapId, Project } from "@/project/types";

export const INTERIOR_TILESET_ID = "easyrpg_chipset_interior";
/** easyrpg interior 나무 바닥(통행 가능). 잔디 240은 이 타일 그림판에서 다른 그림이다. */
export const INTERIOR_FLOOR_TILE = 72;
export const DEFAULT_BLANK_MAP_SIZE = { width: 20, height: 15 } as const;
export const DEFAULT_INTERIOR_MAP_SIZE = { width: 20, height: 15 } as const;

export type MapCreatePreset = "blank" | "inherit-parent" | "interior";

export type MapCreateSpec = {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tilesetId: string;
  readonly parentId: MapId | "";
  readonly preset: MapCreatePreset;
};

export type MapCreateRequest = {
  readonly parentId?: MapId | "";
  readonly preset?: MapCreatePreset;
  readonly name?: string;
};

export function resolveMapCreateDefaults(project: Project, request: MapCreateRequest = {}): MapCreateSpec {
  const parentId = request.parentId ?? "";
  const parent = parentId ? project.maps[parentId] : undefined;
  const preset = request.preset ?? (parent ? "inherit-parent" : "blank");
  const interiorTileset = project.tilesets[INTERIOR_TILESET_ID] ? INTERIOR_TILESET_ID : parent?.tilesetId ?? firstTilesetId(project);
  const inheritedTileset = parent?.tilesetId ?? firstTilesetId(project);

  if (preset === "interior") {
    return {
      name: request.name ?? "새 방",
      width: DEFAULT_INTERIOR_MAP_SIZE.width,
      height: DEFAULT_INTERIOR_MAP_SIZE.height,
      tilesetId: interiorTileset,
      parentId,
      preset,
    };
  }
  if (preset === "inherit-parent" && parent) {
    return {
      name: request.name ?? "새 맵",
      width: parent.width,
      height: parent.height,
      tilesetId: inheritedTileset,
      parentId,
      preset,
    };
  }
  return {
    name: request.name ?? "새 맵",
    width: DEFAULT_BLANK_MAP_SIZE.width,
    height: DEFAULT_BLANK_MAP_SIZE.height,
    tilesetId: inheritedTileset,
    parentId,
    preset: "blank",
  };
}

function firstTilesetId(project: Project): string {
  return Object.keys(project.tilesets)[0] ?? "";
}

export function clampMapSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(4, Math.min(256, Math.floor(value)));
}
