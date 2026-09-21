import type { PassFlag, TileAiMetadata, TilesetDef } from "../types";
import { bakeCellsToRows } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { LPC_WOODEN_FURNITURE_OBJECTS } from "./lpcWoodenFurnitureObjects";
import {
  LPC_WOODEN_FURNITURE_16_ID,
  LPC_WOODEN_FURNITURE_16_NAME,
  LPC_WOODEN_FURNITURE_16_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_16_TILE_COUNT,
  LPC_WOODEN_FURNITURE_16_TILE_SIZE,
  LPC_WOODEN_FURNITURE_16_TILES_PER_ROW,
  LPC_WOODEN_FURNITURE_TILESET_ID,
  LPC_WOODEN_FURNITURE_TILESET_NAME,
  LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_TILE_SIZE,
  LPC_WOODEN_FURNITURE_TILES_PER_ROW,
  LPC_WOODEN_FURNITURE_TILE_COUNT,
} from "./constants";

/**
 * [LPC] Wooden Furniture (bluecarrot16, Sharm, Reemax 외 · CC-BY-SA 3.0 / GPL 3.0).
 *
 * LPC 표준 32×32px 타일 시트(512×1024, 16열×32행 = 512칸)다. 이 시트에는 RM2K 오토타일이나
 * 물 애니메이션이 없으므로 16px RM2K 애니 스트립 인덱스가 의미를 갖지 않는다 — 성채 칩셋과
 * 같은 `kind: "custom"` 으로 등록해 스트립 등록을 건너뛴다.
 *
 * 통행/레이어는 Slates 32px와 같은 계약(전부 통행 가능·하위)으로 시작한다. 자동으로 "가구는
 * 막힘"이라 추정하면 저작자가 칠할 수 없는 맵이 조용히 만들어진다. 칸 단위 조정과 검토는
 * 타일 메타데이터 도구의 몫이다. 시트는 16px 열 구분선 하나 없는 무구분 아틀라스라
 * 팔레트도 원본 열 배열 그대로 보여준다(tilePaletteGrid source-layout 규약).
 */
export function createLpcWoodenFurnitureTileset(): TilesetDef {
  const count = LPC_WOODEN_FURNITURE_TILE_COUNT;
  const passable: PassFlag = { up: true, down: true, left: true, right: true };
  const tileMeta: TileAiMetadata[] = Array.from({ length: count }, () => ({
    label: "",
    description: "",
    source: "unknown" as const,
  }));
  return {
    id: LPC_WOODEN_FURNITURE_TILESET_ID,
    name: LPC_WOODEN_FURNITURE_TILESET_NAME,
    image: { type: "bundled", id: LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY },
    kind: "custom",
    tileSize: LPC_WOODEN_FURNITURE_TILE_SIZE,
    tilesPerRow: LPC_WOODEN_FURNITURE_TILES_PER_ROW,
    count,
    passability: Array.from({ length: count }, () => ({ ...passable })),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
    tileMeta,
    tileGroups: [],
    structureKits: lpcFurnitureKits(),
  };
}

/**
 * 이 시트의 공용 오브젝트 킷 — 자료집 오브젝트 탭의 "공용 오브젝트" 원천이다.
 *
 * 왜 `learnedFrom: "interior-catalog"` 인가: `isInteriorFurnitureKit` 이 이 값을 "시드 계보"로
 * 읽어 실내 가구로 분류한다. 그래야 실내 방 문법(테마·스냅·역할)이 이 킷을 후보로 쓰고,
 * 구조물 앨범에서 실내 오브젝트 갈래로 한 번만 나온다(중복 카드 방지).
 */
function lpcFurnitureKits(): TilesetDef["structureKits"] {
  return LPC_WOODEN_FURNITURE_OBJECTS.map((object) => ({
    id: object.id,
    kind: "section" as const,
    name: object.label,
    width: object.width,
    height: object.height,
    rows: bakeCellsToRows(
      object.cells.map((cell) => ({ dx: cell.dx, dy: cell.dy, layer: "upper" as const, tile: cell.tile })),
      object.width,
      object.height,
    ),
    learnedFrom: "interior-catalog" as const,
    ai: {
      description: object.description,
      placementRules: "",
      ...(object.interiorRole ? { interiorRole: object.interiorRole } : {}),
      snap: object.snap,
      themes: [...object.themes],
      role: "prop" as const,
      layerHome: "upper" as const,
      repeatability: "fixed" as const,
      confidence: "high" as const,
      origin: "ai" as const,
    },
  }));
}

/**
 * 기존 프로젝트에 이 시트의 공용 오브젝트를 채운다.
 *
 * 계약: **사용자 저작을 덮지 않는다.** 킷이 하나라도 있으면 손대지 않는다(사람이 지운 상태를
 * 되살리지 않는다). Tibo 실내 확장의 `extendTiboInteriorDefaults` 와 같은 보수적 규칙이다.
 */
export function seedLpcWoodenFurnitureKits(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return false;
  if ((tileset.structureKits ?? []).length > 0) return false;
  tileset.structureKits = lpcFurnitureKits();
  return true;
}

/**
 * 16px 판 타일셋 — 같은 가구를 기존 16px 맵(합본 마을·실내)에서 쓸 수 있게 한다.
 *
 * 32px 판과 **같은 킷 id**를 쓴다. 그래야 자료집 카드·복제·배치가 두 판을 같은 물건으로
 * 보고, 사용자는 맵 타일셋만 바꿔 같은 가구를 고를 수 있다. 좌표도 같다 — 축소본은 원본의
 * 정확히 절반이라 셀 인덱스가 1:1로 대응한다(16열 유지).
 */
export function createLpcWoodenFurniture16Tileset(): TilesetDef {
  const base = createLpcWoodenFurnitureTileset();
  const count = LPC_WOODEN_FURNITURE_16_TILE_COUNT;
  return {
    ...base,
    id: LPC_WOODEN_FURNITURE_16_ID,
    name: LPC_WOODEN_FURNITURE_16_NAME,
    image: { type: "bundled", id: LPC_WOODEN_FURNITURE_16_TEXTURE_KEY },
    tileSize: LPC_WOODEN_FURNITURE_16_TILE_SIZE,
    tilesPerRow: LPC_WOODEN_FURNITURE_16_TILES_PER_ROW,
    count,
    passability: Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
    tileMeta: Array.from({ length: count }, () => ({ label: "", description: "", source: "unknown" as const })),
    tileGroups: [],
  };
}
/** 16px 판에도 같은 공용 오브젝트 킷을 심는다. */
export function seedLpcWoodenFurniture16Kits(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return false;
  if ((tileset.structureKits ?? []).length > 0) return false;
  tileset.structureKits = lpcFurnitureKits();
  return true;
}
