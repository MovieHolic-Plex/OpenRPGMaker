/** Sync the accepted outline-cleaned native sprite into its bundled copies.
 * node scripts/content/prepare-forest-well-outline.mjs [--apply]
 * Without --apply, only writes the native candidate in tiledata/forest-stone-well.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(root, 'tiledata/forest-stone-well');
const read = (p) => PNG.sync.read(fs.readFileSync(p));
const before = read(path.join(sourceDir, 'palette-before-outline.png'));
const out = read(path.join(sourceDir, 'outline-native.png'));
const finalPath = path.join(sourceDir, 'stone-well-low.png');
fs.writeFileSync(finalPath, PNG.sync.write(out, { deflateStrategy: 0, deflateLevel: 9 }));
if (!process.argv.includes('--apply')) {
  console.log(`Candidate: ${finalPath}`);
  process.exit(0);
}

function tile(image, x, y) {
  const bytes = Buffer.alloc(16 * 16 * 4);
  for (let dy = 0; dy < 16; dy++) image.data.copy(bytes, dy*64, ((y+dy)*image.width+x)*4, ((y+dy)*image.width+x+16)*4);
  return bytes;
}
const oldTiles = [], newTiles = [];
for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
  oldTiles.push(tile(before,x,y)); newTiles.push(tile(out,x,y));
}
const outline = read(path.join(sourceDir,'outline-native.png'));
for(let y=0;y<32;y+=16) for(let x=0;x<32;x+=16) oldTiles.push(tile(outline,x,y));
const rejected = read(path.join(sourceDir,'rejected-selected-native.png'));
for(let y=0;y<32;y+=16) for(let x=0;x<32;x+=16) oldTiles.push(tile(rejected,x,y));
function* pngs(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir,e.name);
    if(e.isDirectory()) yield* pngs(p); else if(e.name.endsWith('.png')) yield p;
  }
}
function digest(s) {
  let h1 = 2166136261, h2 = 0x811c9dc5 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i),16777619) >>> 0;
    h2 = Math.imul(h2 ^ s.charCodeAt(i),2246822519) >>> 0;
  }
  return `s${s.length}:${h1}:${h2}`;
}
const manifestPath = path.join(root,'src/assets/bundledReferenceImageManifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const known = new Set(Object.values(manifest));
let changed = 0;
for (const p of pngs(path.join(root,'public/assets'))) {
  // Some legacy files have a .png name but contain JPEG/WebP bytes.
  const raw = fs.readFileSync(p);
  if (!raw.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) continue;
  // Reject non-atlas dimensions from IHDR before decoding large reference images.
  const w = raw.readUInt32BE(16), h = raw.readUInt32BE(20);
  if(w%16 || h%16 || w*h > 4_000_000) continue;
  const im = PNG.sync.read(raw);
  let hits = 0;
  for (let y=0;y<im.height;y+=16) for(let x=0;x<im.width;x+=16) {
    const bytes = tile(im,x,y);
    const k = oldTiles.findIndex(t=>t.equals(bytes));
    if(k < 0) continue;
    for(let dy=0;dy<16;dy++) newTiles[k % 4].copy(im.data,((y+dy)*im.width+x)*4,dy*64,(dy+1)*64);
    hits++;
  }
  if(!hits) {
    const url = '/' + path.relative(path.join(root,'public'),p).split(path.sep).join('/');
    if(known.has(url)) manifest[digest('data:image/png;base64,'+raw.toString('base64'))] = url;
    continue;
  }
  const encoded = PNG.sync.write(im, { deflateStrategy: 0, deflateLevel: 9 });
  fs.writeFileSync(p,encoded); changed++;
  const url = '/' + path.relative(path.join(root,'public'),p).split(path.sep).join('/');
  if(known.has(url)) manifest[digest('data:image/png;base64,'+encoded.toString('base64'))] = url;
  console.log(`${path.relative(root,p)}: ${hits} tiles`);
}
const preview = new PNG({width:96,height:96});
for(let y=0;y<96;y++) for(let x=0;x<96;x++) {
  const i=(Math.floor(y/3)*32+Math.floor(x/3))*4;
  out.data.copy(preview.data,(y*96+x)*4,i,i+4);
}
fs.writeFileSync(path.join(root,'public/assets/shared-objects/prop_forest_stone-well-low-cliff-life.png'),PNG.sync.write(preview, { deflateStrategy: 0, deflateLevel: 9 }));
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,1)+'\n');
console.log(`${changed} sheets updated; preview synced`);
