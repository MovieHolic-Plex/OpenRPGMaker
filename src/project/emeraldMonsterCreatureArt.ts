import type { Project, UploadedAsset } from './types';
import artwork from '../../public/assets/monster-expedition/creatures/uploaded-art.json';

/** Reuse the original shared campaign pack without touching species or saved instances. */
export function configureEmeraldMonsterCreatureArt(project: Project, replaceExisting = false): string[] {
  const used = new Set((project.database.monsterSpecies ?? []).flatMap(species =>
    [species.graphic.monsterResourceId, species.graphic.backResourceId].filter(Boolean)));
  const updated: string[] = [];
  for (const asset of artwork as UploadedAsset[]) {
    const front = asset.id.endsWith('_icon') ? asset.id.replace(/_icon$/u, '_front') : undefined;
    if (!used.has(asset.id) && !(front && used.has(front))) continue;
    if (project.assets.uploaded[asset.id] && !replaceExisting) continue;
    project.assets.uploaded[asset.id] = { ...asset, meta: { ...asset.meta } };
    updated.push(asset.id);
  }
  return updated;
}
