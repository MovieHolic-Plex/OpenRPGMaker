import type { GameMap, Project, TilesetDef } from './types';
import { sharedContentTileset } from './sharedContent';
import type { TilesetReferenceCategory } from './tilesetReferences';

export interface SharedRegionReference {
  id: string; name: string; kind: 'completed-map'; regionKind: 'terrain' | 'settlement'; revision: number;
  width: number; height: number; tilesetId: string; preview: string;
  sourceProjectId: string; sourceMapId: string; rules: string[]; limitations: string;
  referenceDocuments?: TilesetReferenceCategory[];
}
export interface SharedSpatialReferences {
  regions: SharedRegionReference[];
  maps: Record<string, GameMap>;
  tilesets: Record<string, TilesetDef>;
  assets: Project['assets']['uploaded'];
}
export const SHARED_REGION_REFERENCES: SharedRegionReference[] = [];
let catalog: SharedSpatialReferences = { regions: [], maps: {}, tilesets: {}, assets: {} };
export function installSharedSpatialReferences(value?: SharedSpatialReferences): void {
  catalog = value ? structuredClone(value) : { regions: [], maps: {}, tilesets: {}, assets: {} };
  SHARED_REGION_REFERENCES.splice(0, SHARED_REGION_REFERENCES.length, ...catalog.regions);
}
export function sharedRegionSnapshot(id: string) {
  const reference = catalog.regions.find(r => r.id === id);
  const map = reference && catalog.maps[reference.sourceMapId];
  const tileset = map && catalog.tilesets[map.tilesetId];
  return map && tileset ? { map, tileset } : undefined;
}
export function sharedObjectKit(tilesetId: string, kitId: string) {
  return (sharedContentTileset(tilesetId) ?? catalog.tilesets[tilesetId])?.structureKits?.find(k => k.id === kitId);
}
/** Install missing dependencies and reserved shared kits; never overwrite map arrays or tile rules. */
export function ensureSharedSpatialReferences(project: Project): boolean {
  let changed = false;
  for (const [id, source] of Object.entries(catalog.tilesets)) {
    if (!id.startsWith('shared_') || source.image.type !== 'uploaded') continue;
    const asset = catalog.assets[source.image.id];
    if (!asset) continue;
    const current = project.tilesets[id];
    if (!current) {
      if (project.assets.uploaded[source.image.id] && JSON.stringify(project.assets.uploaded[source.image.id]) !== JSON.stringify(asset)) continue;
      project.assets.uploaded[source.image.id] = structuredClone(asset);
      project.tilesets[id] = structuredClone(source); changed = true; continue;
    }
    // Exact identity is checked by the reference sync before refreshing installed kits.
  }
  return changed;
}
