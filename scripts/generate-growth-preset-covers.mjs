// Offline composition only. Never calls an image service or changes source art.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = fileURLToPath(new URL('../', import.meta.url));
// 옛 전투 배경·파티 일러스트는 2026-10-03 deprecated/assets/generated/battle-skins/ 로 옮겼다 — 다시 돌리려면 그 경로를 읽게 고친다.
const sourceDir = 'public/assets/generated/battle-skins/';
const outputDir = 'public/assets/generated/growth-presets/';
const width = 1024;
const height = 683;
const verify = process.argv.includes('--verify');
assert(process.argv.slice(2).every((arg) => arg === '--verify'), 'Only --verify is supported');
const covers = [
  { role: 'vanguard', backdrop: 'goldensun-backdrop.png', figure: 'party-warrior-back.png' },
  { role: 'arcane', backdrop: 'chrono-backdrop.png', figure: 'party-mage-back.png' },
  { role: 'ranger', backdrop: 'bravely-backdrop.png', figure: 'hero-04-back.png' },
];

/** @param {Buffer} bytes */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** @param {Jimp} image */
function inspect(image) {
  let left = image.bitmap.width;
  let top = image.bitmap.height;
  let right = -1;
  let bottom = -1;
  let transparent = 0;
  let partial = 0;
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, i) => {
    const alpha = image.bitmap.data[i + 3];
    if (alpha === 0) transparent++;
    else {
      if (alpha < 255) partial++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  });
  assert(right >= left && bottom >= top, 'Empty source image');
  return { width: image.bitmap.width, height: image.bitmap.height, transparent, partial,
    bounds: { x: left, y: top, w: right - left + 1, h: bottom - top + 1 } };
}

/** @param {string} path */
async function source(path) {
  const bytes = await readFile(root + path);
  const image = await Jimp.read(bytes);
  const commit = execFileSync('git', ['log', '-1', '--format=%H', '--', path],
    { cwd: root, encoding: 'utf8' }).trim();
  assert(commit, `Source is not recorded in git: ${path}`);
  return { image, evidence: { path, commit, sha256: sha256(bytes), bytes: bytes.length, ...inspect(image) } };
}

/** Resize in premultiplied alpha so transparent black RGB cannot form a matte.
 * @param {Jimp} image @param {number} targetHeight
 */
function resizeFigure(image, targetHeight) {
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (_x, _y, i) => {
    const alpha = image.bitmap.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) image.bitmap.data[i + c] = Math.round(image.bitmap.data[i + c] * alpha);
  });
  image.resize(Math.round(image.bitmap.width * targetHeight / image.bitmap.height), targetHeight,
    Jimp.RESIZE_BILINEAR);
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (_x, _y, i) => {
    const alpha = image.bitmap.data[i + 3];
    if (alpha > 0) {
      for (let c = 0; c < 3; c++) {
        image.bitmap.data[i + c] = Math.min(255, Math.round(image.bitmap.data[i + c] * 255 / alpha));
      }
    }
  });
  return image;
}

// Sequential decoding/encoding keeps memory and CPU bounded on the shared host.
if (!verify) await mkdir(root + outputDir, { recursive: true });
for (const cover of covers) {
  const backdrop = await source(sourceDir + cover.backdrop);
  const figure = await source(sourceDir + 'sprites/' + cover.figure);
  assert.equal(backdrop.evidence.transparent + backdrop.evidence.partial, 0, 'Backdrop must be opaque');
  assert(figure.evidence.transparent > 0, 'Figure must have real transparency');
  const cropHeight = Math.round(backdrop.image.bitmap.width * height / width);
  const cropY = Math.round((backdrop.image.bitmap.height - cropHeight) / 2);
  const scene = backdrop.image.crop(0, cropY, backdrop.image.bitmap.width, cropHeight)
    .resize(width, height, Jimp.RESIZE_BILINEAR);
  const { x, y, w, h } = figure.evidence.bounds;
  const subject = resizeFigure(figure.image.crop(x, y, w, h), 490);
  const subjectX = Math.round((width - subject.bitmap.width) / 2);
  const subjectY = 118;
  // Whole figures remain inside the central 16:9 crop band (y=54..629).
  assert(subjectY >= 54 && subjectY + subject.bitmap.height <= 629);
  // An opaque backdrop stays opaque under source-over. Jimp can truncate
  // floating-point alpha to 254; restore 255 before RGB encoding adds a matte.
  scene.composite(subject, subjectX, subjectY).opaque();
  const path = outputDir + cover.role + '.png';
  // Keep RGBA input stride; rgba(false) incorrectly treats this buffer as RGB.
  const bytes = await scene.colorType(2).deflateLevel(9).getBufferAsync(Jimp.MIME_PNG);
  const decoded = await Jimp.read(bytes);
  assert(scene.bitmap.data.equals(decoded.bitmap.data), `PNG changed composed pixels: ${path}`);
  const output = inspect(decoded);
  assert.deepEqual([output.width, output.height, output.transparent, output.partial], [width, height, 0, 0]);
  if (verify) assert.deepEqual(await readFile(root + path), bytes, `Non-reproducible cover: ${path}`);
  else await writeFile(root + path, bytes);
  console.log(JSON.stringify({ mode: verify ? 'verified' : 'written', path, bytes: bytes.length,
    sha256: sha256(bytes), ...output, backdrop: backdrop.evidence, figure: figure.evidence,
    composition: { cropY, cropHeight, subjectX, subjectY, subjectWidth: subject.bitmap.width, subjectHeight: 490 } }));
}
