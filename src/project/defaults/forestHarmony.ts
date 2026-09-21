import { DEFAULT_TILESET_ID } from "./constants";
import saved from "@/assets/forestHarmonyTileset.json";
import proseCorrections from "../../../tiledata/tilesets/forest_harmony/recipes/layer-prose-corrections.json";
import corrections from "../../../tiledata/tilesets/forest_harmony/recipes/layer-corrections.json";
import type { Project, TilesetDef } from "../types";

export const FOREST_HARMONY_TEXTURE = "tex_forest_harmony";
export const FOREST_HARMONY_ID = "forest_harmony";

/** Independent copies preserve authored passability, autotiles and forest assemblies. */
export function createForestHarmonyTileset(): TilesetDef {
  return JSON.parse(JSON.stringify(saved)) as TilesetDef;
}

/** New outdoor authoring prefers the bundled forest atlas; old stripped projects remain usable. */
export function defaultOutdoorTilesetId(project: Pick<Project, "tilesets">): string {
  return isForestHarmonyTileset(project.tilesets[FOREST_HARMONY_ID])
    ? FOREST_HARMONY_ID : DEFAULT_TILESET_ID;
}

export function isForestHarmonyTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === FOREST_HARMONY_TEXTURE;
}

/** Backfill shipped guidance without replacing user categories or shared ownership. */
export function ensureForestHarmonyReferences(tileset: TilesetDef): boolean {
  if (!isForestHarmonyTileset(tileset) || tileset.referenceSourceTilesetId) return false;
  let changed = false;
  const canonical = saved as unknown as TilesetDef;
  // Only repair known, unedited old annotation values. Preserve user overrides/priority.
  for (const fix of corrections) {
    if (fix.scope === "group") {
      const group = tileset.tileGroups?.find(g => g.id === fix.id);
      if (group && group.defaultLayer === fix.before) { group.defaultLayer = fix.after as typeof group.defaultLayer; changed = true; }
    } else {
      const meta = tileset.tileMeta?.[Number(fix.id)];
      if (meta && meta.defaultLayer === fix.before) { meta.defaultLayer = fix.after as typeof meta.defaultLayer; changed = true; }
    }
  }
  for (const fix of proseCorrections) {
    const group = tileset.tileGroups?.find(g => g.id === fix.id);
    if (group?.description === fix.before.description) { group.description = fix.after.description; changed = true; }
    if (group?.placementRules === fix.before.placementRules) { group.placementRules = fix.after.placementRules; changed = true; }
  }
  // Add the keyed source only when this slot has not been locally grafted or backed.
  const mouth = tileset.tileMeta?.[893];
  if (mouth && mouth.layerBacking === undefined && !tileset.tileGrafts?.some(g => g.targetTile === 893)) {
    const graft = canonical.tileGrafts?.find(g => g.targetTile === 893);
    if (graft) { tileset.tileGrafts = [...(tileset.tileGrafts ?? []), structuredClone(graft)]; mouth.layerBacking = 652; changed = true; }
  }
  const missing = saved.referenceDocuments.filter(category =>
    !(tileset.referenceDocuments ?? []).some(existing => existing.id === category.id));
  if (missing.length) { tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...structuredClone(missing)]; changed = true; }
  // The previous shipped sentence was wrong for this atlas; replace only that exact text.
  const wrong = "남향 외곽에는 나무 줄기가 있어야 한다. 줄기의 윗부분은 잎 외곽과 같은 행에서 시작하고,\n전체 줄기와 뿌리를 유지한다.";
  for (const group of tileset.referenceDocuments ?? []) for (const doc of group.documents) {
    if (doc.id === "public-village-rules" && doc.markdown.includes(wrong)) {
      doc.markdown = doc.markdown.replace(wrong, "남향 외곽에는 나무 줄기가 있어야 한다. 줄기 시작 행은 부품별 하위/상위 배열을 따른다. 반복 본체 하위 줄기는 3행째, 마감은 4행째부터 시작한다. 전체 줄기와 뿌리를 유지한다."); changed = true;
    }
  }
  return changed;
}
