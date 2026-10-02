// Derive exact native idle cells for whole-image consumers; no source painting is used.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { PIXEL_ENEMY_SHEETS, pixelEnemyCell } from "../../src/assets/pixelEnemySheets";
import { pixelEnemyPortraitPath } from "../../src/assets/pixelEnemyPortraits";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const sheet of PIXEL_ENEMY_SHEETS) {
  const cell = pixelEnemyCell(sheet);
  const source = PNG.sync.read(readFileSync(path.join(root, "public", sheet.path)));
  if (source.width !== cell * 3 || source.height !== cell * 3) throw new Error(`Invalid pose sheet ${sheet.path}`);
  const portrait = new PNG({width:cell,height:cell});
  for (let y=0;y<cell;y++) {
    const sourceOffset=y*source.width*4;
    source.data.copy(portrait.data,y*cell*4,sourceOffset,sourceOffset+cell*4);
  }
  const out=path.join(root,"public",pixelEnemyPortraitPath(sheet));
  mkdirSync(path.dirname(out),{recursive:true});
  writeFileSync(out,PNG.sync.write(portrait));
  const saved=PNG.sync.read(readFileSync(out));
  if (!saved.data.equals(portrait.data)) throw new Error(`Portrait reload mismatch: ${out}`);
}
console.log(`Native idle portraits: ${PIXEL_ENEMY_SHEETS.length}`);
