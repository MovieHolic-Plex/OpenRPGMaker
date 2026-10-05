import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { CHARSET_ASSETS } from '@/assets/charsetCatalog';
import { CHARSET_SEMANTICS } from '@/assets/charsetSemantics';

// Inspect the shipped pixels independently of crop/render helpers. A new sheet
// or newly occupied slot must not silently disappear from assistant discovery.
const templates = new Set([0, 1, 2].map(index => `tex_easyrpg_charset_template#${index}`));
const occupied = new Set<string>();
for (const asset of CHARSET_ASSETS) {
  const file = [resolve(asset.path), resolve('public', asset.path)].find(existsSync);
  if (!file) throw Error(`Missing original charset: ${asset.textureKey}`);
  const image = PNG.sync.read(readFileSync(file));
  if (image.width !== 288 || image.height !== 256) throw Error(`Unexpected RM2K3 sheet: ${asset.textureKey}`);
  const alphaSheet = image.data.some((value, index) => index % 4 === 3 && value < 255);
  for (let slot = 0; slot < 8; slot++) {
    let visible = false;
    for (let y = Math.floor(slot / 4) * 128; y < Math.floor(slot / 4) * 128 + 128 && !visible; y++) {
      for (let x = slot % 4 * 72; x < slot % 4 * 72 + 72; x++) {
        const offset = (y * 288 + x) * 4;
        if (image.data[offset + 3]! > 0 && (alphaSheet ||
          image.data[offset] !== image.data[0] || image.data[offset + 1] !== image.data[1] || image.data[offset + 2] !== image.data[2])) {
          visible = true; break;
        }
      }
    }
    if (visible) occupied.add(`${asset.textureKey}#${slot}`);
  }
}
const named = CHARSET_SEMANTICS.map(entry => `${entry.textureKey}#${entry.characterIndex}`);

describe('Bundled charset discovery covers original occupied pixels', () => {
  it('names every occupied slot except the three authoring templates', () => {
    expect([...occupied].filter(key => !templates.has(key) && !named.includes(key))).toEqual([]);
    expect([...templates].filter(key => !occupied.has(key))).toEqual([]);
  });
  it('does not label an empty slot or map two descriptions to one slot', () => {
    expect(named.filter(key => !occupied.has(key))).toEqual([]);
    expect(new Set(named).size).toBe(named.length);
  });
});
