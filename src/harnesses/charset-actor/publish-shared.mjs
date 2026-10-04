// Host-user publication only: no network writes and no pixels in Git/public.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withTsModule } from '../../../scripts/ontology-ts-loader.mjs';
import pngjs from 'pngjs';

const input = process.argv[2];
if (!input || process.argv.length !== 3) throw Error('Usage: publish-shared.mjs <prepared-library.json>');
const library = JSON.parse(await readFile(input, 'utf8'));
const id = 'charset-actor-kept';
if (library.version !== 1 || !library.projectDefaults || !library.characters || Object.keys(library.tilesets).length || Object.keys(library.places).length) throw Error('Invalid character library');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const { PNG } = pngjs;
for (const [key, row] of Object.entries(library.characters)) {
  const asset = library.assets[row.assetId], d = row.description, source = row.source;
  if (key !== row.assetId || !/^shared_charset_actor_[a-f0-9]{24}$/.test(key) || row.characterIndex !== 0
    || !asset || asset.id !== key || asset.kind !== 'charset' || typeof d?.label !== 'string' || !d.label.trim()
    || d.label.length > 200 || typeof source?.candidateId !== 'string' || source.acceptance?.decision !== 'accept'
    || JSON.stringify(source.acceptance.inspected) !== JSON.stringify(source.inspected)) throw Error('Invalid accepted character '+key);
  for (const field of ['gender','role','appearance','fits']) if (d[field] !== undefined && (typeof d[field] !== 'string' || d[field].length > 2000)) throw Error('Invalid description '+key);
  if (d.tags !== undefined && (!Array.isArray(d.tags) || d.tags.some(tag => typeof tag !== 'string' || tag.length > 2000))) throw Error('Invalid tags '+key);
  if (d.attributes !== undefined && (!d.attributes || typeof d.attributes !== 'object' || Array.isArray(d.attributes)
    || Object.entries(d.attributes).some(([axis,value]) => !['kind','age','gender','skin','hair','clothing','role'].includes(axis) || typeof value !== 'string' || value.length > 80))) throw Error('Invalid attributes '+key);
  if (source.inspected.sourceSha256 !== hash(Buffer.from(source.grid, 'utf8'))) throw Error('Source grid hash differs '+key);
  if (!/^data:image\/png;base64,/.test(asset.dataUrl)) throw Error('PNG bytes required '+key);
  const bytes = Buffer.from(asset.dataUrl.split(',')[1], 'base64'), png = PNG.sync.read(bytes);
  if (png.width !== 288 || png.height !== 256 || hash(bytes) !== source.imageSha256
    || asset.meta.width !== 288 || asset.meta.height !== 256 || asset.meta.frames !== 96
    || asset.meta.frameWidth !== 24 || asset.meta.frameHeight !== 32) throw Error('Sprite geometry/hash differs '+key);
  for (let y=0; y<png.height; y++) for (let x=0; x<png.width; x++) {
    const alpha=png.data[(y*png.width+x)*4+3];
    if (alpha !== 0 && alpha !== 255 || (x>=72 || y>=128) && alpha) throw Error('Invalid alpha or empty slots '+key);
  }
}
if (Object.keys(library.assets).length !== Object.keys(library.characters).length) throw Error('Unowned assets');
await withTsModule('scripts/lib/sharedContentSqlite.ts', 'charset-shared.mjs', api => {
  const old = api.readSharedContentLibrary(id), revision = hash(JSON.stringify(library));
  const result = old?.revision === revision ? {file:api.sharedContentFile(),id,revision,reloaded:old.library}
    : api.publishSharedContent(id, library, old?.revision ?? null);
  const after = api.readSharedContentLibrary(id);
  if (!after || after.revision !== result.revision || hash(JSON.stringify(after.library)) !== revision) throw Error('Shared library readback differs');
  console.log(JSON.stringify({file:result.file,id,revision,count:Object.keys(after.library.characters).length,
    assets:Object.keys(after.library.assets), reloaded:true}));
});
