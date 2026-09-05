import type { DatabaseTerrainRecord, Project } from "@/project/types";

export type TerrainLocation = {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
};

export type TerrainAtResult = {
  readonly tag: number;
  readonly tile: number;
  readonly record: DatabaseTerrainRecord;
};

/** Resolve the terrain tag at a map tile (tileMeta.terrainTag wins over tileset.terrain). */
export function terrainTagAt(project: Project, location: TerrainLocation | undefined): number {
  if (!location) return 0;
  const map = project.maps[location.mapId];
  if (!map) return 0;
  const x = Math.trunc(location.x);
  const y = Math.trunc(location.y);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return 0;
  const tileIndex = map.lowerTiles[y * map.width + x];
  if (typeof tileIndex !== "number" || tileIndex < 0) return 0;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return 0;
  const tag = tileset.tileMeta?.[tileIndex]?.terrainTag ?? tileset.terrain?.[tileIndex] ?? 0;
  return typeof tag === "number" && Number.isFinite(tag) ? Math.trunc(tag) : 0;
}

/** Resolve tag N at a map tile to the Nth authored terrain record (RM-style 1-based). */
export function terrainRecordAt(project: Project, location: TerrainLocation | undefined): TerrainAtResult | undefined {
  if (!location) return undefined;
  const map = project.maps[location.mapId];
  if (!map) return undefined;
  const x = Math.trunc(location.x);
  const y = Math.trunc(location.y);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  const tileIndex = map.lowerTiles[y * map.width + x];
  if (typeof tileIndex !== "number" || tileIndex < 0) return undefined;
  const tag = terrainTagAt(project, location);
  if (!tag || tag <= 0) return undefined;
  const terrains = project.database.terrains ?? [];
  const record = terrains[tag - 1];
  if (!record) return undefined;
  return { tag, tile: tileIndex, record };
}
