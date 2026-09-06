import { tilesetImageUrl } from "./tilesetImage";
import { loadTilesetImageUrl } from "./mapTileDrawCore";
import type { TilesetDef } from "@/project/types";
export * from "./mapTileDrawCore";
export function loadTilesetImage(tileset: TilesetDef) { return loadTilesetImageUrl(tileset, tilesetImageUrl(tileset)); }
