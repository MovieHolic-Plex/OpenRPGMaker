import { defaultOutdoorTilesetId } from "@/project/defaults/outdoorTileset";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import type { MapId, Project } from "@/project/types";

/** 새 실내 맵의 기본 칩셋 — 손 도트 실내 v5(생성 칩셋 공용). 옛 실내 칩셋은 폐기됐다(retiredInteriorTilesets.ts). */
export const INTERIOR_TILESET_ID = "atlas_biome_interior";
/** 새 실내 맵의 방 껍데기(벽 2줄·천장 테두리) 재료 — handInteriorSpec.json 의 floors·walls 키. */
export const INTERIOR_SHELL_FLOOR = "boards";
export const INTERIOR_SHELL_WALL = "plaster";
/** 옛 EasyRPG 실내 칩셋. 파라메트릭 실내·공간 카탈로그 이관 경로만 이 번호 체계를 쓴다. */
export const EASYRPG_INTERIOR_TILESET_ID = "easyrpg_chipset_interior";
/** easyrpg interior 나무 바닥(통행 가능). 잔디 240은 이 타일 그림판에서 다른 그림이다. */
export const EASYRPG_INTERIOR_FLOOR_TILE = 72;
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
  const preset = request.preset ?? "blank";
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
    tilesetId: defaultOutdoorTilesetId(project),
    parentId,
    preset: "blank",
  };
}

function firstTilesetId(project: Project): string {
  return Object.keys(project.tilesets)[0] ?? "";
}

// 상한은 mapSizeLimits 한 곳에서만 선언한다 — 여기 숫자를 따로 적어 두면 생성 툴·lint 와
// 어긋난다(OPRN-OUT-018). 이 함수는 빈칸/NaN 입력을 기본값으로 되돌리는 입력 정리용이고,
// 상한 초과는 호출자가 명시적으로 거부한다(조용한 클램프는 왜 작아졌는지를 숨긴다).
export function clampMapSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(4, Math.min(MAX_TOOL_MAP_DIMENSION, Math.floor(value)));
}
