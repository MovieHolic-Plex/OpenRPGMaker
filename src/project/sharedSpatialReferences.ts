import type { GameMap, Project, TilesetDef } from './types';
import { sharedContentTileset, sharedRegionReferences as contentRegions, sharedRegionSnapshot as contentSnapshot } from './sharedContent';
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
/** Resolve the current content library at read time; legacy loading must not erase it. */
export function sharedRegionReferences(): SharedRegionReference[] {
  return [...new Map([...SHARED_REGION_REFERENCES, ...contentRegions()].map(region => [region.id, region])).values()];
}
let catalog: SharedSpatialReferences = { regions: [], maps: {}, tilesets: {}, assets: {} };
export function installSharedSpatialReferences(value?: SharedSpatialReferences): void {
  // 받은 응답은 이 모듈만 가진다(sharedTileReferences.ts 가 파싱하거나 IndexedDB 에서 읽은 사본). 읽기 전용으로 쓰고
  // 프로젝트로 옮길 때 ensureSharedSpatialReferences 가 복제하므로 설치 때 다시 복제하지 않는다(2026-09-28 실측 0.8s).
  catalog = value ?? { regions: [], maps: {}, tilesets: {}, assets: {} };
  SHARED_REGION_REFERENCES.splice(0, SHARED_REGION_REFERENCES.length, ...catalog.regions);
}
export function sharedRegionSnapshot(id: string) {
  const current = contentSnapshot(id);
  if (current) return current;
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
