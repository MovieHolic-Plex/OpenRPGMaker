import type { Project } from './types';
import { EMERALD_MONSTER_KIT_SHEETS } from '@/assets/emeraldMonsterKitAssets';
import { createEmeraldMonsterKitTileset } from './defaults/emeraldMonsterKit';

/** Adopt the native variant while retaining the author's collision and layer tables. */
export function configureEmeraldMonsterTiles(project: Project): number {
  let changed = 0;
  for (const sheet of EMERALD_MONSTER_KIT_SHEETS) {
    const sourceId = sheet.sourceTextureKey.replace(/^tex_/, '');
    const maps = Object.values(project.maps).filter(map => map.tilesetId === sourceId);
    if (!maps.length) continue;
    const source = project.tilesets[sourceId];
    if (!source || source.image.type !== 'bundled' || source.image.id !== sheet.sourceTextureKey) continue;
    const fresh = createEmeraldMonsterKitTileset(sheet.textureKey);
    if (source.count !== fresh.count || source.tileSize !== fresh.tileSize || source.tilesPerRow !== fresh.tilesPerRow) {
      throw new Error(`Emerald tile geometry does not match authored tileset: ${sourceId}`);
    }
    if (!project.tilesets[sheet.id]) {
      const adopted = structuredClone(source);
      adopted.id = sheet.id;
      adopted.name = fresh.name;
      adopted.image = fresh.image;
      const have = new Set((adopted.referenceDocuments ?? []).map(category => category.id));
      adopted.referenceDocuments = adopted.referenceDocuments?.length === 0 ? [] : [
        ...(adopted.referenceDocuments ?? []),
        ...(fresh.referenceDocuments ?? []).filter(category => !have.has(category.id)),
      ];
      project.tilesets[sheet.id] = adopted;
    }
    for (const map of maps) { map.tilesetId = sheet.id; changed++; }
  }
  return changed;
}
