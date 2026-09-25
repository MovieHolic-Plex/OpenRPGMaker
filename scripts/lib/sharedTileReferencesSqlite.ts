import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateTilesetReferences } from '../../src/project/tilesetReferences';
import type { SharedTileReferenceSnapshot } from '../../src/project/sharedTileReferences';
import type { Project } from '../../src/project/types';
import type { SharedSpatialReferences } from '../../src/project/sharedSpatialReferences';
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
export function readSharedTileReferences(file = process.env.OPRN_SHARED_CONTENT_SQLITE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oprn', 'shared-content.sqlite')): SharedTileReferenceSnapshot {
  if (!existsSync(file)) return { revision: '', entries: [] };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as {id:string;revision:string;payload:string}[];
    const entries: SharedTileReferenceSnapshot['entries'] = [], seen = new Set<string>();
    const spatial: SharedSpatialReferences = {regions: [], maps: {}, tilesets: {}, assets: {}};
    for (const row of rows) {
      const lib = JSON.parse(row.payload) as { tilesets: Project['tilesets']; assets: Project['assets']['uploaded']; maps?: Project['maps']; regionReferences?: SharedSpatialReferences['regions']; regions?: Record<string, SharedSpatialReferences['regions'][number]> };
      const regions = new Map((lib.regionReferences ?? []).map(reference => [reference.id, reference]));
      for (const reference of Object.values(lib.regions ?? {})) {
        const previous = regions.get(reference.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(reference)) throw new Error(`Conflicting shared region reference: ${reference.id}`);
        regions.set(reference.id, reference);
      }
      if (regions.size) {
        for (const reference of regions.values()) {
          // regions is keyed by the saved snapshot; sourceMapId is provenance and
          // several snapshots can legitimately originate from the same source map.
          const snapshot = lib.regions?.[reference.id] ? lib.maps?.[reference.id] : lib.maps?.[reference.sourceMapId];
          const map = snapshot && { ...snapshot, id: reference.id }, tile = map && lib.tilesets[map.tilesetId];
          if (!reference.id.startsWith('shared_') || !map || !tile || reference.width !== map.width || reference.height !== map.height
            || reference.tilesetId !== map.tilesetId || map.lowerTiles.length !== map.width * map.height || map.upperTiles.length !== map.width * map.height) throw new Error('Invalid shared region reference');
          if (reference.referenceDocuments) validateTilesetReferences(reference.referenceDocuments);
          spatial.regions.push({ ...reference, sourceMapId: map.id }); spatial.maps[map.id] = map; spatial.tilesets[tile.id] = tile;
          if (tile.image.type === 'uploaded' && lib.assets[tile.image.id]) spatial.assets[tile.image.id] = lib.assets[tile.image.id];
        }
      }
      for (const [id, tile] of Object.entries(lib.tilesets)) {
        if (!id.startsWith('shared_') || !tile.referenceDocuments?.length || tile.image?.type !== 'uploaded') continue;
        const asset = lib.assets[tile.image.id], dataUrl = asset?.dataUrl;
        if (!dataUrl?.startsWith('data:image/') || !dataUrl.includes(';base64,')) continue;
        if (seen.has(id)) throw new Error(`Duplicate shared tileset ID: ${id}`);
        validateTilesetReferences(tile.referenceDocuments); seen.add(id);
        entries.push({ id, tileSize: tile.tileSize, tilesPerRow: tile.tilesPerRow, count: tile.count, assetId: tile.image.id,
          imageSha256: hash(Buffer.from(dataUrl.split(',')[1], 'base64')), dataUrlSha256: hash(dataUrl), documents: tile.referenceDocuments,
          kits: tile.structureKits?.filter(k => k.id.startsWith('shared_')) });
      }
    }
    return { revision: hash(rows.map(r => r.id + ':' + r.revision).join('\n')), entries, spatial };
  } finally { db.close(); }
}
