import { ASSET_TILESET, BUNDLED_EASYRPG_CHIPSET_ASSETS, TEX_TILESET } from "./bundled";
import { awaitGraftedTilesetImageUrl } from "./tileGraftImageCache";
import type { Project, TilesetDef } from "@/project/types";
export async function snapshotTilesetImageUrl(project: Project, tileset: TilesetDef): Promise<string> {
  const image = tileset.image;
  const url = image.type === "uploaded" ? project.assets.uploaded[image.id]?.dataUrl
    : image.id === TEX_TILESET ? `/${ASSET_TILESET}`
    : BUNDLED_EASYRPG_CHIPSET_ASSETS.find(asset => asset.textureKey === image.id)?.path;
  if (!url) throw new Error(`Missing snapshot tileset image: ${image.id}`);
  return awaitGraftedTilesetImageUrl(tileset, /^(?:data:|\/)/.test(url) ? url : `/${url}`);
}
