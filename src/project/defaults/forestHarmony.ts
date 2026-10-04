import { DEFAULT_TILESET_ID } from "./constants";
import saved from "@/assets/forestHarmonyTileset.json";
import { referenceRevision } from "../tilesetReferences";
import previousDiverseReference from "../../../tiledata/forest-villages/diverse/previous-reference.json";
import diverseReferences from "@/assets/sharedDiverseVillageReferences.json";
import proseCorrections from "../../../tiledata/tilesets/forest_harmony/recipes/layer-prose-corrections.json";
import corrections from "../../../tiledata/tilesets/forest_harmony/recipes/layer-corrections.json";
import signLabels from "../../../tiledata/rpg-places/sign-labels.json";
import type { Project, TilesetDef } from "../types";

export const FOREST_HARMONY_TEXTURE = "tex_forest_harmony";
export const FOREST_HARMONY_ID = "forest_harmony";

/** Independent copies preserve authored passability, autotiles and forest assemblies. */
export function createForestHarmonyTileset(): TilesetDef {
  const tileset = JSON.parse(JSON.stringify(saved)) as TilesetDef;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...structuredClone(diverseReferences)];
  return tileset;
}

/**
 * 새 야외 저작의 기본 타일셋.
 * - 버들항(기본 타일셋)을 가졌고 **모든 맵이 버들항**이면(새 프로젝트, 버들항만 쓰는 프로젝트) 버들항이다 —
 *   "마을 만들어 줘" 가 숲마을이나 합본 마을로 새어 나가지 않게 한다.
 * - 이미 숲마을·합본 마을 등 다른 계열 맵이 하나라도 있으면 종전대로 숲마을(없으면 기본 타일셋)을 유지한다.
 *   기존 프로젝트의 기본값을 바꾸지 않는다.
 */
export function defaultOutdoorTilesetId(project: Pick<Project, "tilesets"> & Partial<Pick<Project, "maps">>): string {
  if (project.tilesets[DEFAULT_TILESET_ID] && onlyDefaultTilesetMaps(project.maps)) return DEFAULT_TILESET_ID;
  return isForestHarmonyTileset(project.tilesets[FOREST_HARMONY_ID])
    ? FOREST_HARMONY_ID : DEFAULT_TILESET_ID;
}

function onlyDefaultTilesetMaps(maps: Project["maps"] | undefined): boolean {
  if (!maps) return false;
  return Object.values(maps).every((m) => m.tilesetId === DEFAULT_TILESET_ID);
}

/** tilesetId 생략 도구의 대상: 시작 맵 타일셋, 없으면 새 야외 기본(숲마을). 합본 마을로 폴백하지 않는다. */
export function defaultToolTilesetId(project: Pick<Project, "tilesets" | "maps" | "startMapId">): string {
  const start = project.maps[project.startMapId]?.tilesetId;
  return start && project.tilesets[start] ? start : defaultOutdoorTilesetId(project);
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
  // Labels that shipped blank (or as the bare "창문" on 85/87) take the canonical wording; edited labels stay.
  canonical.tileMeta?.forEach((meta, tile) => {
    const own = tileset.tileMeta?.[tile];
    if (!meta?.label || !own || own.label === meta.label) return;
    const blank = !own.label && !own.description, bareWindow = (tile === 85 || tile === 87) && own.label === "창문" && !own.description;
    if (blank || bareWindow) { tileset.tileMeta![tile] = { ...own, label: meta.label, description: meta.description ?? "" }; changed = true; }
  });
  // The three hanging shop signs shipped with colour names; rename them only while the shipped wording is untouched.
  for (const [tile, fix] of Object.entries(signLabels)) {
    const own = tileset.tileMeta?.[Number(tile)];
    if (own?.label !== fix.before) continue;
    tileset.tileMeta![Number(tile)] = { ...own, label: fix.label, tags: [...fix.tags], description: fix.description };
    changed = true;
  }
  // Retire exact shipped revisions only; keep any locally edited guidance.
  for (const revision of previousDiverseReference) {
    const previous = tileset.referenceDocuments?.find(c => c.id === revision.id);
    if (previous && referenceRevision(previous) === revision.revision) {
      tileset.referenceDocuments = tileset.referenceDocuments!.filter(c => c !== previous);
      changed = true;
    }
  }
  const missing = [...saved.referenceDocuments, ...diverseReferences].filter(category =>
    !(tileset.referenceDocuments ?? []).some(existing => existing.id === category.id));
  if (missing.length) { tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...structuredClone(missing)]; changed = true; }
  // The previous shipped sentence was wrong for this atlas; replace only that exact text.
  const wrong = "남향 외곽에는 나무 줄기가 있어야 한다. 줄기의 윗부분은 잎 외곽과 같은 행에서 시작하고,\n전체 줄기와 뿌리를 유지한다.";
  for (const group of tileset.referenceDocuments ?? []) for (const doc of group.documents) {
    if (doc.id === "public-village-rules" && doc.markdown.includes(wrong)) {
      doc.markdown = doc.markdown.replace(wrong, "남향 외곽에는 나무 줄기가 있어야 한다. 줄기 시작 행은 부품별 하위/상위 배열을 따른다. 반복 본체 하위 줄기는 3행째, 마감은 4행째부터 시작한다. 전체 줄기와 뿌리를 유지한다."); changed = true;
    }
    // 물 안내(2026-09-27): 1517~1563 호수는 프레임이 한 장이라 멈춰 보였다. 번들 그대로인 문장만 바꾼다.
    if (doc.id === "public-village-rules" && doc.markdown.includes(STATIC_LAKE_RULE)) {
      doc.markdown = doc.markdown.replace(STATIC_LAKE_RULE, ANIMATED_WATER_RULE); changed = true;
    }
    if (doc.id === "public-village-gallery" && doc.markdown.includes(STATIC_LAKE_ROW)) {
      doc.markdown = doc.markdown.replace(STATIC_LAKE_ROW, STATIC_LAKE_ROW_RETIRED); changed = true;
    }
  }
  return changed;
}

const STATIC_LAKE_RULE = "길 `forest_harmony_road_47`, 물 `forest_harmony_lake_47`는 이웃 상태에 따라 자동 연결한다.";
const ANIMATED_WATER_RULE = "길 `forest_harmony_road_47`은 이웃 상태에 따라 자동 연결한다. 물은 0번 「애니메이션 물 오토타일」로 칠한다 — 렌더가 이웃을 보고 물가를 합성하고 3프레임으로 움직인다. `forest_harmony_lake_47`(1517~1563)은 프레임이 한 장뿐이라 멈춰 보이므로 새로 쓰지 않는다.";
const STATIC_LAKE_ROW = "|forest_harmony_lake_47|1517–1563|1563|";
const STATIC_LAKE_ROW_RETIRED = "|forest_harmony_lake_47 (옛 정지 호수, 새로 쓰지 않음)|1517–1563|1563|";
