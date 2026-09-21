import saved from '@/assets/sharedCastleReferences.json';
import type { TilesetDef } from '../types';
import type { TilesetReferenceCategory } from '../tilesetReferences';
import { CASTLE_TILESET_ID, CASTLE_TILESET_TEXTURE_KEY } from './constants';

/** Every new project receives its own editable copy of the shipped castle study. */
export function createSharedCastleReferences(): TilesetReferenceCategory[] {
  return structuredClone(saved);
}

/** Backfill untouched bundled copies; preserve authored documents and sharing choices. */
export function ensureSharedCastleReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== CASTLE_TILESET_ID || tileset.image.type !== 'bundled'
    || tileset.image.id !== CASTLE_TILESET_TEXTURE_KEY
    || tileset.referenceDocuments?.length === 0 || tileset.referenceSourceTilesetId) return false;
  const missing = saved.filter(category => !(tileset.referenceDocuments ?? []).some(c => c.id === category.id));
  if (!missing.length) return false;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...structuredClone(missing)];
  return true;
}
