// Moves tileset reference-document image bytes out of the bundled JSON under `src/assets/`.
//
// Reference images used to ship as `data:` URLs inside the bundle JSON (~15 MB unique) and were copied into
// every project's `tilesets[].referenceDocuments`, so each boot parsed them and each save serialized them.
// This rewrites every `images[].dataUrl` to a same-origin static path. Bytes that already exist under
// `public/assets/` reuse that file; the rest are written content-addressed to `public/assets/reference-images/`.
//
// It also writes `src/assets/bundledReferenceImageManifest.json` (digest of the original data URL -> path) so the
// load-time normalizer can shrink projects that still carry the old inline copies.
//
// Run after any `prepare-*-references.mjs` / `author-*` script that regenerates these bundles.
// Usage: node scripts/content/externalize-reference-images.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dry = process.argv.includes('--dry');
const assetsDir = 'src/assets';
const publicDir = 'public';
const outDir = 'public/assets/reference-images';
const manifestPath = 'src/assets/bundledReferenceImageManifest.json';
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/u;
const EXT = { png: '.png', jpeg: '.jpg', webp: '.webp' };

/** Must match `referenceImageDigest` in src/project/bundledReferenceImages.ts. */
function digest(value) {
  let h1 = 2166136261;
  let h2 = 0x811c9dc5 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 ^ code, 2246822519);
  }
  return `s${value.length}:${h1 >>> 0}:${h2 >>> 0}`;
}

function* imageNodes(value) {
  if (Array.isArray(value)) { for (const item of value) yield* imageNodes(item); return; }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value.images) && typeof value.documents !== 'undefined') {
    for (const image of value.images) if (image && typeof image.dataUrl === 'string') yield image;
  }
  for (const child of Object.values(value)) if (child && typeof child === 'object') yield* imageNodes(child);
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(png|jpe?g|webp)$/iu.test(entry.name)) out.push(full);
  }
  return out;
}

const bundles = fs.readdirSync(assetsDir).filter(name => name.endsWith('.json') && name !== path.basename(manifestPath));
const pending = new Map(); // dataUrl -> { bytes, ext }
const parsed = [];
for (const name of bundles) {
  const file = path.join(assetsDir, name);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('"dataUrl"')) continue;
  const value = JSON.parse(text);
  const images = [...imageNodes(value)].filter(image => DATA_URL.test(image.dataUrl));
  if (!images.length) continue;
  parsed.push({ file, text, value, images });
  for (const image of images) {
    if (pending.has(image.dataUrl)) continue;
    const [, mime, base64] = DATA_URL.exec(image.dataUrl);
    pending.set(image.dataUrl, { bytes: Buffer.from(base64, 'base64'), ext: EXT[mime] });
  }
}

// Reuse identical files already shipped under public/ (only hash candidates with a matching size).
const sizes = new Set([...pending.values()].map(entry => entry.bytes.length));
const existing = new Map(); // sha256 -> public path
for (const file of walkFiles(path.join(publicDir, 'assets'))) {
  const size = fs.statSync(file).size;
  if (!sizes.has(size)) continue;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (!existing.has(sha)) existing.set(sha, '/' + path.relative(publicDir, file).split(path.sep).join('/'));
}

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const pathFor = new Map();
let reused = 0, written = 0, writtenBytes = 0;
for (const [dataUrl, { bytes, ext }] of pending) {
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  let target = existing.get(sha);
  if (target && path.extname(target).toLowerCase().replace('jpeg', 'jpg') === ext) reused += 1;
  else {
    target = `/assets/reference-images/${sha.slice(0, 20)}${ext}`;
    const file = path.join(publicDir, target);
    if (!fs.existsSync(file)) {
      written += 1; writtenBytes += bytes.length;
      if (!dry) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(file, bytes); }
    }
  }
  pathFor.set(dataUrl, target);
  manifest[digest(dataUrl)] = target;
}

let before = 0, after = 0;
for (const { file, text, value, images } of parsed) {
  for (const image of images) image.dataUrl = pathFor.get(image.dataUrl);
  const pretty = /^[[{]\n/u.test(text);
  const next = (pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)) + (text.endsWith('\n') ? '\n' : '');
  before += text.length; after += next.length;
  console.log(`${file}: ${images.length} images, ${(text.length / 1e6).toFixed(2)}MB -> ${(next.length / 1e6).toFixed(2)}MB`);
  if (!dry) fs.writeFileSync(file, next);
}
const sortedManifest = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
if (!dry) fs.writeFileSync(manifestPath, JSON.stringify(sortedManifest, null, 1) + '\n');
console.log(`unique images ${pending.size}: reused ${reused} existing public files, wrote ${written} (${(writtenBytes / 1e6).toFixed(2)}MB)`);
console.log(`bundle JSON ${(before / 1e6).toFixed(2)}MB -> ${(after / 1e6).toFixed(2)}MB${dry ? ' (dry run)' : ''}`);
