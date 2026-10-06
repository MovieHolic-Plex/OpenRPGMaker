import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerExportAssetBase } from '@/assets/inlineAssetStore';
import { installExportUploadedAssets } from '@/player/exportUploadedAssets';
import { setUploadedAssetResolver, uploadedAssetBytes, uploadedAssetUrl } from '@/project/persistence/assetAccessors';
import { webUploadedAssetPath } from '@/project/webUploadedAssetPath';
import type { Project, UploadedAsset } from '@/project/types';

const media: UploadedAsset = { id: '회중 시계/그림', name: '시계', kind: 'picture', meta: { width: 1, height: 1 },
  ref: { sha256: 'a'.repeat(64), mime: 'image/webp', bytes: 3, extension: 'webp' } };
const project = (uploaded: Record<string, UploadedAsset>) => ({ assets: { uploaded } }) as Project;
afterEach(() => { setUploadedAssetResolver(null); registerExportAssetBase(null); vi.unstubAllGlobals(); });

describe('exported SQLite media', () => {
  it('resolves refs to the exact packaged path under the game directory', async () => {
    registerExportAssetBase(new URL('https://games.example/game/'));
    installExportUploadedAssets(project({ [media.id]: media }));
    const expected = new URL(webUploadedAssetPath(media), 'https://games.example/game/').href;
    expect(uploadedAssetUrl(media)).toBe(expected);
    const fetchBytes = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchBytes);
    expect(await uploadedAssetBytes(media)).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchBytes).toHaveBeenCalledWith(expected);
  });
  it('reports a missing packaged file instead of accepting error bytes', async () => {
    installExportUploadedAssets(project({ [media.id]: media }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(uploadedAssetBytes(media)).rejects.toThrow('404');
  });
  it('opening an inline game clears the previous game ref resolver', () => {
    installExportUploadedAssets(project({ [media.id]: media }));
    const inline = { ...media, ref: undefined, dataUrl: 'data:image/png;base64,AQID' };
    installExportUploadedAssets(project({ [inline.id]: inline }));
    expect(uploadedAssetUrl(inline)).toBe(inline.dataUrl);
    expect(uploadedAssetUrl(media)).toBe('');
  });
});
