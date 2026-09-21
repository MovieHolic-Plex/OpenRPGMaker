import raster from "./reviewedPlaces/riverVillage.json";
import { createForestHarmonyTileset } from "../forestHarmony";
import { RIVER_VILLAGE_STYLE } from "../riverVillageStyle";
import type { PlaceDesign, SpatialId } from "@/project/spatial/types";
import type { SectionStructureKitDef } from "@/project/types";

const style = RIVER_VILLAGE_STYLE;
const kit: SectionStructureKitDef = {
  id: "section_river_forest_village", name: style.name, kind: "section", learnedFrom: "db-authored",
  width: raster.width, height: raster.height,
  rows: Array.from({ length: raster.height }, (_, y) => ({
    tiles: raster.lowerTiles.slice(y * raster.width, (y + 1) * raster.width),
    upperTiles: raster.upperTiles.slice(y * raster.width, (y + 1) * raster.width),
  })),
  ai: { description: style.description, placementRules: "실외 꾸밈 도안. NPC·집 내부·이동 이벤트는 포함하지 않는다. 새 마을 생성은 author_village 사용.", themes: ["강변", "숲", "마을"] },
};
export const RIVER_VILLAGE_PLACE_TILESET = { ...createForestHarmonyTileset(), structureKits: [kit] };
export const RIVER_VILLAGE_PLACE: PlaceDesign = {
  id: style.placeId as SpatialId, name: style.name, revision: 1,
  provenance: { origin: "builtin", sourceId: raster.sourceProjectId },
  tags: ["그림체:EasyRPG", "장소유형:마을·도시", "공간형태:실외", "용도:주거", "용도:마을 꾸밈 기준", "강변", "숲", "울타리 기본 없음", "실외 도안"],
  kind: "settlement", layout: "manual", children: [], connections: [],
  ports: [{ id: "entry" as SpatialId, name: "마을 입구", ...raster.entry }],
  exterior: { tilesetId: style.tilesetId, kitId: kit.id },
};
