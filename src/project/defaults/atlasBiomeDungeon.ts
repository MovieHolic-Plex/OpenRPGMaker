// 생성 칩셋(oprn-atlas) 계열의 공용 배·던전 세트(2026-09-29). 옛 atlas_biome_interior 시트(8e02e8e4e)의
// 배·던전 블록을 떼어 낸 것 — 실내가 손 도트 v5 전용(atlasBiomeInterior.ts)으로 바뀌며 따로 살렸다.
// 시트 public/assets/atlas-interior/dungeon-chipset.png, 정의 src/assets/atlasBiomeDungeonTileset.json
// (scripts/content/atlas-dungeon/split-dungeon.mjs):
//   0~509     배 블록(EasyRPG Ship 0~479, 480~509 빈 칸 — 옛 Tibo 짐 이식 자리)
//   510~1019  던전 블록(EasyRPG Dungeon 0~479 + 이식 30칸; 510+480~482 는 빈 칸, 지형 오토타일 포함)
//   1020~1079 지하 → 던전 입구 조각(바닥 뚜껑·무너진 벽 틈·돌 더미)
//   1080~     던전 물길·공허 테두리의 합성 모양을 구워 둔 칸
import data from "@/assets/atlasBiomeDungeonTileset.json";
import type { PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";

export const ATLAS_BIOME_DUNGEON_ID = "atlas_biome_dungeon";
export const ATLAS_BIOME_DUNGEON_TEXTURE = "tex_atlas_biome_dungeon";
export const ATLAS_BIOME_DUNGEON_FAMILY = "oprn-atlas";
export const ATLAS_BIOME_DUNGEON_COUNT: number = data.count;

export function createAtlasBiomeDungeonTileset(): TilesetDef {
  return {
    id: ATLAS_BIOME_DUNGEON_ID,
    name: data.name,
    image: { type: "bundled", id: ATLAS_BIOME_DUNGEON_TEXTURE },
    kind: "custom",
    family: ATLAS_BIOME_DUNGEON_FAMILY,
    tileSize: 16,
    tilesPerRow: 30,
    count: data.count,
    passability: structuredClone(data.passability) as PassFlag[],
    priority: [...data.priority] as ("lower" | "upper")[],
    terrain: [...data.terrain],
    tileMeta: structuredClone(data.tileMeta) as TileAiMetadata[],
    tileGroups: structuredClone(data.tileGroups) as unknown as TileGroupMetadata[],
    autotileGroups: structuredClone(data.autotileGroups) as unknown as NonNullable<TilesetDef["autotileGroups"]>,
    structureKits: structuredClone(data.structureKits) as unknown as StructureKitDef[],
  };
}
