// TEMP (보고서 생성용, 사용 후 삭제) — 실내 오브젝트 어휘/데모 방/내장 집 킷을 JSON 으로 덤프.
import { writeFileSync } from "node:fs";
import {
  INTERIOR_ROOM_DEMO_PLANS,
  INTERIOR_ROOM_THEME_CATALOG,
  INTERIOR_ROOM_THEMES,
  INTERIOR_SEMANTIC_TILE_CATALOG,
  INTERIOR_THEME_MODIFIERS,
  runInteriorRoomPipeline,
  VR,
} from "@/editor/interiorRoomPipeline";
import { BUILTIN_HOUSE_STRUCTURE_KITS } from "@/editor/harnessSuggestion/builtinHouseStructureKits";
import { structureKitSize, structureKitUnitCells } from "@/editor/harnessSuggestion/structureKitModel";

const rooms = INTERIOR_ROOM_DEMO_PLANS.map((plan) => {
  try {
    const built = runInteriorRoomPipeline(plan);
    return {
      ok: true,
      theme: plan.theme,
      name: plan.name,
      width: built.map.width,
      height: built.map.height,
      lower: built.map.lowerTiles,
      upper: built.map.upperTiles,
      door: plan.door,
    };
  } catch (error) {
    return { ok: false, theme: plan.theme, name: plan.name, error: String(error) };
  }
});

const houseKits = BUILTIN_HOUSE_STRUCTURE_KITS.map((kit) => {
  const size = structureKitSize(kit);
  return { id: kit.id, name: kit.name, width: size.width, height: size.height, cells: structureKitUnitCells(kit) };
});

writeFileSync(
  "output/structure-report-dump.json",
  JSON.stringify(
    {
      vr: VR,
      semanticCatalog: INTERIOR_SEMANTIC_TILE_CATALOG,
      themeCatalog: INTERIOR_ROOM_THEME_CATALOG,
      themes: INTERIOR_ROOM_THEMES,
      modifiers: INTERIOR_THEME_MODIFIERS,
      rooms,
      houseKits,
    },
    null,
    2,
  ),
);
console.log("dumped", rooms.filter((r) => r.ok).length, "rooms,", houseKits.length, "house kits");
