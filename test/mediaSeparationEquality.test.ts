import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { isMediaSeparationOnly } from '@/project/mediaSeparationEquality';
import { sha256HexBytes } from '@/util/sha256';

async function separated() {
  const before = createBlankProject();
  before.assets.uploaded = { art: { id: 'art', name: 'Opening', kind: 'picture', dataUrl: 'data:image/png;base64,AQID', meta: {} } };
  const after = structuredClone(before);
  delete after.assets.uploaded.art!.dataUrl;
  after.assets.uploaded.art!.ref = { sha256: await sha256HexBytes(new Uint8Array([1, 2, 3])), mime: 'image/png', bytes: 3, extension: 'png' };
  return { before, after };
}
describe('storage-only media adoption during an assistant turn', () => {
  it('recognizes identical verified bytes and leaves both input documents intact', async () => {
    const { before, after } = await separated(), source = JSON.stringify(before), target = JSON.stringify(after);
    expect(await isMediaSeparationOnly(before, after)).toBe(true);
    expect(JSON.stringify(before)).toBe(source); expect(JSON.stringify(after)).toBe(target);
  });
  it('keeps real asset and story edits outside this exemption', async () => {
    const { before, after } = await separated();
    after.assets.uploaded.art!.ref = { ...after.assets.uploaded.art!.ref!, sha256: 'a'.repeat(64) };
    expect(await isMediaSeparationOnly(before, after)).toBe(false);
    after.assets.uploaded.art!.ref = { ...after.assets.uploaded.art!.ref!, sha256: await sha256HexBytes(new Uint8Array([1, 2, 3])) };
    after.system.opening = { enabled: false, skippable: true, scenes: [] };
    expect(await isMediaSeparationOnly(before, after)).toBe(false);
  });
});
