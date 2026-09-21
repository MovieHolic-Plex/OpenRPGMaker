import saved from '@/assets/sharedVillageObjects.json';
import type { TilesetDef } from '../types';
import type { InteriorObjectDef } from './interiorObjectCatalog';

export const SHARED_VILLAGE_OBJECT_TEXTURE = 'tex_shared_forest_village_objects';
export const SHARED_VILLAGE_OBJECT_ID = 'shared_forest_village_objects';
export function createSharedVillageObjectsTileset(): TilesetDef {
  return structuredClone(saved) as unknown as TilesetDef;
}
export function sharedVillageObjectById(id: string): InteriorObjectDef | undefined {
  const kit = saved.structureKits.find(k => k.id === id);
  if (!kit) return undefined;
  return { id, label: kit.name, description: kit.name, role: null,
    width: kit.width, height: kit.height, layer: 'upper', themes: ['storage'], snap: 'floor',
    cells: kit.rows.flatMap((r, dy) => r.upperTiles.map((tile, dx) => ({ dx, dy, tile, layer: 'upper' as const }))) };
}

/** Add shipped guidance to older copies without replacing authored documents. */
export function ensureSharedVillageObjectReferences(tileset: TilesetDef): boolean {
  if (tileset.image.type !== 'bundled' || tileset.image.id !== SHARED_VILLAGE_OBJECT_TEXTURE
    || tileset.referenceDocuments !== undefined || tileset.referenceSourceTilesetId) return false;
  tileset.referenceDocuments = createSharedVillageObjectsTileset().referenceDocuments;
  return true;
}
