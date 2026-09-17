import Jimp from 'jimp';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Reproducible import from preserved user masters. Never interpolate colors.
const root = fileURLToPath(new URL('../', import.meta.url));
const sets = JSON.parse(await readFile(new URL('./shared-face-expression-sources.json', import.meta.url), 'utf8'));
const requested = process.argv[2] ?? 'blue-traveler-expressions';
const selected = requested === '--all' ? sets : sets.filter(set => set.stem === requested);
assert(selected.length > 0, `Unknown expression set: ${requested}`);
const bounds = {
  'pink-hat-expressions': { x:[[4,311],[317,624],[631,938],[944,1251]], y:[[3,311],[316,625],[630,939],[943,1251]] },
  'black-martial-expressions': { x:[[7,314],[320,628],[634,941],[947,1254]], y:[[7,312],[321,625],[634,939],[948,1254]] },
  'blue-headband-expressions': { x:[[14,314],[327,628],[641,941],[954,1252]], y:[[8,309],[321,622],[635,936],[948,1249]] },
};
for (const set of selected) {
  const bytes = await readFile(path.join(root, 'public/assets/shared/faceset/source', `${set.stem}.png`));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), set.sha256, `Master changed: ${set.stem}`);
  const image = await Jimp.read(bytes);
  const {width, height} = image.bitmap;
  assert.equal(width, height); assert(width >= 192);
  const output = new Jimp(192, 192, 0);
  for(let row=0;row<4;row++) for(let col=0;col<4;col++) {
    const [left,right] = bounds[set.stem]?.x[col] ?? [col*width/4,(col+1)*width/4];
    const [top,bottom] = bounds[set.stem]?.y[row] ?? [row*height/4,(row+1)*height/4];
    for(let y=0;y<48;y++) for(let x=0;x<48;x++) {
      const sx=Math.floor(left+(x+.5)/48*(right-left));
      const sy=Math.floor(top+(y+.5)/48*(bottom-top));
      output.setPixelColor(image.getPixelColor(sx,sy),col*48+x,row*48+y);
    }
  }
  await output.writeAsync(path.join(root, 'public/assets/shared/faceset', `${set.stem}.png`));
  console.log(`Prepared ${set.stem}: ${width}x${height} -> 192x192 (16 x 48px)`);
}
