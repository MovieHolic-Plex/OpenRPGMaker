// No art is generated here. The host kit's theme definitions remain the source of truth.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const kit = path.join(root, 'tiledata/worldmap-kit');
const rows = fs.readdirSync(path.join(kit, 'themes')).filter(name => name.endsWith('.json')).sort().map(name => {
  const theme = JSON.parse(fs.readFileSync(path.join(kit, 'themes', name), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(kit, 'iconsets', theme.iconset, 'manifest.json'), 'utf8'));
  const terrain = theme.terrain ? JSON.parse(fs.readFileSync(path.join(kit, 'terrains', theme.terrain + '.json'), 'utf8')) : null;
  return { id: theme.id, name: theme.name, kind: theme.kind, iconset: theme.iconset, candidateIcons: manifest.icons.length,
    terrain: theme.terrain ?? 'shared-v9', journey: theme.journey ?? 'fantasy-5act', terrainNote: terrain?.note ?? null };
});
fs.writeFileSync(path.join(root, 'src/assets/worldmapThemeCatalog.json'), JSON.stringify(rows, null, 2) + '\n');
