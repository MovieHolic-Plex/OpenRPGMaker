// 프레임 확대 검수판 — animatic-frames/*.png 의 지정 프레임을 정수배(nearest)로 확대해 한 장에 모은다.
// 사용: node scripts/qa/opening-pixel-zoom.mjs <recordDir> <out.png> [frameIndex:zoom ...]
// 기본은 8샷에서 앞 4샷 표본(0, 25%, 50%, 75%)을 x2~x3 으로 확대한다.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [recordDir, outFile, ...specs] = process.argv.slice(2);
if (!recordDir || !outFile) throw Error('Usage: opening-pixel-zoom.mjs <recordDir> <out.png> [frameIndex:zoom ...]');
const framesDir = path.join(recordDir, 'animatic-frames');
const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(framesDir, f));
const record = fs.existsSync(path.join(recordDir, 'record.json')) ? JSON.parse(fs.readFileSync(path.join(recordDir, 'record.json'), 'utf8')) : {};
const shots = record.shotList ?? [];
const frameCounts = shots.map((s) => Math.max(2, Math.round((s.durationMs / 1000) * 12)));
const picks = [];
let cursor = 0;
for (const [i, count] of frameCounts.entries()) {
  for (const frac of [0.15, 0.55]) picks.push({ label: `${shots[i].id}@${frac}`, file: files[cursor + Math.min(count - 1, Math.round(count * frac))], zoom: 2 });
  cursor += count;
}
const rows = specs.length
  ? specs.map((s) => { const [frame, zoom] = s.split(':'); return { label: `frame ${frame}`, file: files[Number(frame)], zoom: Number(zoom) || 2 }; })
  : picks;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setContent('<main></main>');
const payload = rows.map((row) => ({ label: row.label, zoom: row.zoom, dataUrl: `data:image/png;base64,${fs.readFileSync(row.file).toString('base64')}` }));
const png = await page.evaluate(async (list) => {
  const images = [];
  for (const item of list) {
    const image = new Image();
    image.src = item.dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth * item.zoom;
    canvas.height = image.naturalHeight * item.zoom;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    images.push({ label: item.label, zoom: item.zoom, url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height });
  }
  const cellW = Math.min(1300, Math.max(...images.map((c) => c.w)));
  const cellH = Math.max(...images.map((c) => c.h)) + 22;
  const sheet = document.createElement('canvas');
  sheet.width = cellW; sheet.height = cellH * images.length;
  const sctx = sheet.getContext('2d');
  sctx.fillStyle = '#101216'; sctx.fillRect(0, 0, sheet.width, sheet.height);
  sctx.font = '13px monospace'; sctx.fillStyle = '#8ce0c0';
  for (const [i, cell] of images.entries()) {
    sctx.fillText(`${cell.label}  x${cell.zoom}  ${cell.w}x${cell.h}`, 6, i * cellH + 15);
    const image = new Image();
    image.src = cell.url;
    await image.decode();
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(image, 0, i * cellH + 22, cell.w, cell.h - 22);
  }
  return sheet.toDataURL('image/png');
}, payload);
fs.writeFileSync(outFile, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
console.log(JSON.stringify({ out: outFile, count: rows.length, rows: rows.map((r) => `${r.label} ${path.basename(r.file)} x${r.zoom}`) }, null, 1));
await browser.close();
