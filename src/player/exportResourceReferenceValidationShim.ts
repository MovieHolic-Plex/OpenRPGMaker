import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";

export function collectResourceIds(project: Project): Set<string> {
  const ids = new Set<string>();
  for (const id of Object.keys(project.assets.sprites)) ids.add(id);
  for (const id of Object.keys(project.assets.uploaded)) ids.add(id);
  for (const profile of project.resourceProfiles) if (profile.assetId) ids.add(profile.assetId);
  for (const tileset of Object.values(project.tilesets)) ids.add(tileset.image.id);
  for (const id of builtinGeneratedResourceIds()) ids.add(id);
  for (const asset of EASYRPG_RTP_ASSETS) {
    ids.add(asset.id);
    if ("textureKey" in asset) ids.add(asset.textureKey);
  }
  for (const asset of CC0_ICON_ASSETS) ids.add(asset.id);
  return ids;
}
