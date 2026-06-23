import type { TileAiMetadata, TilesetDef } from "@/project/types";

type UserRuntimePatch = Partial<Pick<TileAiMetadata, "passage" | "terrainTag">>;

export function markUserTileRuntimeMetadata(tileset: TilesetDef, tile: number, patch: UserRuntimePatch): void {
  if (tile < 0 || tile >= tileset.count) return;
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
  }
  const current = tileset.tileMeta[tile] ?? { label: "", description: "", source: "unknown" };
  tileset.tileMeta[tile] = { ...current, ...patch, source: "user", userLocked: true };
}
