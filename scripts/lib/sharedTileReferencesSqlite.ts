import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateTilesetReferences } from '../../src/project/tilesetReferences';
import type { SharedTileReferenceSnapshot } from '../../src/project/sharedTileReferences';
import type { Project } from '../../src/project/types';
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
export function readSharedTileReferences(file = process.env.OPRN_SHARED_CONTENT_SQLITE || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oprn', 'shared-content.sqlite')): SharedTileReferenceSnapshot {
  if (!existsSync(file)) return { revision: '', entries: [] };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare('SELECT id, revision, payload FROM content_libraries ORDER BY id').all() as {id:string;revision:string;payload:string}[];
    const entries: SharedTileReferenceSnapshot['entries'] = [], seen = new Set<string>();
    for (const row of rows) {
      const lib = JSON.parse(row.payload) as { tilesets: Project['tilesets']; assets: Project['assets']['uploaded'] };
      for (const [id, tile] of Object.entries(lib.tilesets)) {
        if (!id.startsWith('shared_') || !tile.referenceDocuments?.length || tile.image?.type !== 'uploaded') continue;
        const asset = lib.assets[tile.image.id], dataUrl = asset?.dataUrl;
        if (!dataUrl?.startsWith('data:image/') || !dataUrl.includes(';base64,')) continue;
        if (seen.has(id)) throw new Error(`Duplicate shared tileset ID: ${id}`);
        validateTilesetReferences(tile.referenceDocuments); seen.add(id);
        entries.push({ id, tileSize: tile.tileSize, tilesPerRow: tile.tilesPerRow, count: tile.count, assetId: tile.image.id,
          imageSha256: hash(Buffer.from(dataUrl.split(',')[1], 'base64')), dataUrlSha256: hash(dataUrl), documents: tile.referenceDocuments });
      }
    }
    return { revision: hash(rows.map(r => r.id + ':' + r.revision).join('\n')), entries };
  } finally { db.close(); }
}
