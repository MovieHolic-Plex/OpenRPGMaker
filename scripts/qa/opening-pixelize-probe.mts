// pixelizeOpeningImage 회귀 — 워커(캔버스 없음)에서 JPEG 원본이 384×216 PNG 로 내려가는지 본다.
// 실행: bun scripts/qa/opening-pixelize-probe.mts <jpeg-or-png-file>
import fs from 'node:fs';
import { pixelizeOpeningImage } from '../../src/editor/openingImageGeneration.ts';

const file = process.argv[2];
if (!file) throw new Error('Usage: opening-pixelize-probe.mts <image-file>');
const mime = /\.jpe?g$/iu.test(file) ? 'image/jpeg' : 'image/png';
const dataUrl = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const out = await pixelizeOpeningImage(dataUrl, false);
const changed = out !== dataUrl;
const outMime = out.slice(5, out.indexOf(';'));
const bytes = Buffer.from(out.split(',')[1]!, 'base64');
const { PNG } = await import('pngjs');
const png = PNG.sync.read(bytes);
const colors = new Set<number>();
for (let i = 0; i < png.data.length; i += 4) colors.add(((png.data[i]! >> 3) << 10) | ((png.data[i + 1]! >> 3) << 5) | (png.data[i + 2]! >> 3));
console.log(JSON.stringify({ input: mime, outputMime: outMime, pixelized: changed, size: `${png.width}x${png.height}`, colors5bit: colors.size, kb: Math.round(out.length / 1024) }, null, 1));
