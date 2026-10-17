/** Records the legacy-fixture golden hashes from the renderer of the checkout it runs in.
 * The committed goldens/legacy-golden.json was recorded from origin/agent/opening-assistant's renderer (the pre-change baseline,
 * re-verified 2026-10-16 in a detached checkout: 6/6 hashes identical). To re-prove it, run this in a checkout of that base; scripts/qa/opening-animatic/probe.mjs then proves the
 * pre-existing feature set still renders byte-identically.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { boot, here, root, writePng } from './bundle.mjs';

const out = path.resolve(process.argv[2] ?? path.join(here, 'goldens'));
fs.mkdirSync(out, { recursive: true });
const fixturePath = p => path.join(here, 'fixtures.ts');
const src = p => path.join(root, p);

const { browser, page, errors } = await boot({
  out,
  globalName: 'animaticProbe',
  imports: [
    `import { drawAnimaticFrame } from ${JSON.stringify(src('src/player/openingAnimaticRenderer.ts'))};`,
    `import { validateOpeningAnimatic } from ${JSON.stringify(src('src/project/openingAnimatic.ts'))};`,
    `import * as fixtures from ${JSON.stringify(fixturePath())};`,
    'const animaticProbe = { drawAnimaticFrame, validateOpeningAnimatic, ...fixtures };',
  ],
});

const result = await page.evaluate(async () => {
  const { drawAnimaticFrame, validateOpeningAnimatic, ...f } = window.animaticProbe;
  const images = f.makeImages();
  await Promise.all([...images.values()].map(image => image.decode()));
  const a = f.legacyFixture();
  validateOpeningAnimatic(a, f.LEGACY_DURATION);
  const frames = f.LEGACY_TIMES.map(t => ({ t, canvas: f.renderFrame(a, images, t, { size: f.CANVAS, durationMs: f.LEGACY_DURATION }) }));
  return { times: f.LEGACY_TIMES, urls: frames.map(frame => frame.canvas.toDataURL('image/png')), duration: f.LEGACY_DURATION };
});

const hashes = result.urls.map((url, i) => ({ atMs: result.times[i], sha256: crypto.createHash('sha256').update(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')).digest('hex') }));
fs.writeFileSync(path.join(out, 'legacy-golden.json'), `${JSON.stringify({ fixture: 'legacyFixture', stage: '384x216', hashedPixels: 'sha256(png bytes)', frames: hashes }, null, 2)}\n`);
result.urls.forEach((url, i) => writePng(path.join(out, `legacy_t${String(result.times[i]).padStart(4, '0')}ms.png`), url));
await browser.close();
if (errors.length) { console.error('page errors', errors); process.exit(1); }
console.log(JSON.stringify({ golden: path.join(out, 'legacy-golden.json'), frames: hashes }, null, 2));
