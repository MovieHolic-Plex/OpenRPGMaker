import type { TilesetDef } from "./types";

export const TILESET_ART_STYLES = [
  { id: "easyrpg", label: "EasyRPG" },
  { id: "scarloxy", label: "Scarloxy" },
  { id: "castle", label: "성채" },
  { id: "lpc", label: "LPC 가구" },
  { id: "slates", label: "Slates 32px" },
  { id: "modern", label: "네온 도시" },
  { id: "oga", label: "OGA 동굴" },
  { id: "other", label: "기타" },
] as const;

export type TilesetArtStyleId = (typeof TILESET_ART_STYLES)[number]["id"];

const EASYRPG_PROJECT_IDS = new Set([
  "forest_harmony",
  "tibo_interior_expanded",
  "interior_wall_ceiling_wood_floor",
]);

function imageId(tileset: TilesetDef): string {
  return "id" in tileset.image && typeof tileset.image.id === "string" ? tileset.image.id : "";
}

function styleFromIdentity(tileset: TilesetDef): TilesetArtStyleId | null {
  const id = tileset.id;
  const image = imageId(tileset);
  if (id.startsWith("easyrpg_") || id.startsWith("tileset_interior_") || EASYRPG_PROJECT_IDS.has(id)
    || image.startsWith("tex_easyrpg_") || image.startsWith("tex_tibo_") || image.startsWith("tex_forest_harmony")
    || image.startsWith("interior_")) return "easyrpg";
  if (id.startsWith("scarloxy_") || image.startsWith("tex_scarloxy_")) return "scarloxy";
  if (id.startsWith("opengameart_castle") || id.startsWith("castle_") || image.includes("castle")) return "castle";
  if (id.includes("lpc_wooden") || image.includes("lpc_wooden") || image.includes("lpc-wooden")) return "lpc";
  if (id.startsWith("slates_") || image.includes("slates")) return "slates";
  if (id.startsWith("modern_exteriors") || image.includes("modern_exteriors") || image.includes("modern-exteriors")) return "modern";
  if (id.startsWith("oga_cave") || image.startsWith("oga-cave")) return "oga";
  return null;
}

/** Art family for the database tile list. EasyRPG includes its retro sheets. */
export function tilesetArtStyle(tileset: TilesetDef, tilesets: readonly TilesetDef[], seen = new Set<string>()): TilesetArtStyleId {
  const direct = styleFromIdentity(tileset);
  if (direct) return direct;
  const sourceId = tileset.referenceSourceTilesetId;
  if (!sourceId || seen.has(tileset.id)) return "other";
  const source = tilesets.find((entry) => entry.id === sourceId);
  if (!source) return "other";
  seen.add(tileset.id);
  return tilesetArtStyle(source, tilesets, seen);
}
