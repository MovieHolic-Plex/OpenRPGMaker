import type { Project } from "@/project/types";
import type { SpaceDesign, SpatialDesignReference } from "@/project/spatial/types";
import { spatialId, checkedDocument } from "@/project/spatial/domain";
import { resolveMaterialSlots } from "@/editor/operators/materialSlots";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { freshSpatialId, upsertSpaceDesign } from "./spatialSpaceDraft";
import { blankPlaceDesign, upsertPlaceDesign } from "./spatialPlaceDraft";

export type NewPlaceKind = "interior" | "outdoor" | "building";
export type NewPlaceOptions = { name: string; kind: NewPlaceKind; width: number; height: number; tilesetId: string };
export const NEW_PLACE_MIN = 4;
export const NEW_PLACE_MAX = 128;
export const INTERIOR_PLACE_ATLAS = "easyrpg_chipset_interior";

export function newPlaceTilesets(project: Project, kind: NewPlaceKind) {
  return Object.values(project.tilesets).filter(tileset => kind === "outdoor"
    ? Boolean(resolveMaterialSlots(tileset).ground?.tiles.length)
    : tileset.id === INTERIOR_PLACE_ATLAS);
}

/** One draft edit creates the full design; no library records are left on rejection. */
export function createNewPlace(project: Project, options: NewPlaceOptions): { project: Project; source: SpatialDesignReference } {
  if (!project.spatialAuthoring) throw new Error("장소 설계를 활성화한 뒤 다시 만들어 주세요.");
  const name = options.name.trim();
  if (!name || name.length > 80) throw new Error("장소 이름을 1~80자로 입력해 주세요.");
  if (![options.width, options.height].every(n => Number.isInteger(n) && n >= NEW_PLACE_MIN && n <= NEW_PLACE_MAX)) {
    throw new Error(`가로와 세로를 ${NEW_PLACE_MIN}~${NEW_PLACE_MAX} 사이의 정수로 입력해 주세요.`);
  }
  if (!newPlaceTilesets(project, options.kind).some(tileset => tileset.id === options.tilesetId)) {
    throw new Error("이 장소에 사용할 수 있는 타일셋을 선택해 주세요.");
  }
  const id = freshSpatialId(project, "space");
  const space: SpaceDesign = {
    id, name: options.kind === "building" ? `${name} 1층` : name,
    revision: 1, tags: [], provenance: { origin: "user" },
    tilesetId: options.tilesetId, shape: "rect", width: options.width, height: options.height,
    objectSlots: [], ports: [{ id: spatialId(`${id}-entry`), name: "입구", x: Math.floor(options.width / 2), y: options.height - 1 }],
    ...(options.kind === "outdoor" ? { environment: "outdoor", floor: "ground", wall: "none", floorAreas: [{ kind: "rect", material: "ground", x: 0, y: 0, width: options.width, height: options.height }] }
      : { environment: "interior", role: "room", floor: "wood", wall: "cream" }),
  };
  spaceLayout(project, space, { mapId: "new-place-preview", seed: 7 });
  let next = upsertSpaceDesign(project, space);
  let source: SpatialDesignReference = { kind: "space", id };
  if (options.kind === "building") {
    const building = { ...blankPlaceDesign(next), name, kind: "facility" as const,
      children: [{ id: freshSpatialId(next, "slot"), source: { kind: "space" as const, id }, x: 0, y: 0, level: 1 }] };
    next = upsertPlaceDesign(next, building);
    source = { kind: "place", id: building.id };
  }
  checkedDocument(next.spatialAuthoring, next);
  return { project: next, source };
}
