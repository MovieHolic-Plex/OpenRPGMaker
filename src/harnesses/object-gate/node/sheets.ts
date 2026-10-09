/** 관문이 지키는 시트 목록 — 번들 칩셋과 공용 DB 아틀라스. 기준선 생성과 출구 확인이 같은 목록을 쓴다. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetTileSize } from '../../../assets/bundled';

export type GateSheet = { label: string; width: number; height: number; data: Uint8Array; tileSize: number };

export function decodePng(bytes: Buffer): { width: number; height: number; data: Uint8Array } {
  const image = PNG.sync.read(bytes);
  return { width: image.width, height: image.height, data: new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length) };
}

/** 번들 칩셋 시트(public/ 아래 파일). 없는 파일은 건너뛴다(빌드 산출물만 있는 경우). */
export function bundledSheets(root = process.cwd()): GateSheet[] {
  const out: GateSheet[] = [];
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    const file = [resolve(root, 'public', asset.path), resolve(root, asset.path)].find(existsSync);
    if (!file || !file.endsWith('.png')) continue;
    out.push({ label: `bundle:${asset.textureKey}`, tileSize: bundledChipsetTileSize(asset.textureKey), ...decodePng(readFileSync(file)) });
  }
  return out;
}

type LibraryLike = { tilesets?: Record<string, { id?: string; image?: { type?: string; id?: string }; tileSize?: number }>; assets?: Record<string, unknown> };

const assetDataUrl = (asset: unknown): string | null => {
  if (typeof asset === 'string') return asset.startsWith('data:image/png') ? asset : null;
  if (asset && typeof asset === 'object') for (const key of ['dataUrl', 'url', 'src', 'data']) {
    const v = (asset as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.startsWith('data:image/png')) return v;
  }
  return null;
};

/** 공용 라이브러리 한 행의 업로드 아틀라스(PNG data URL). 번들 그림을 가리키는 타일셋은 번들 확인이 맡는다. */
export function librarySheets(libraryId: string, library: LibraryLike): GateSheet[] {
  const out: GateSheet[] = [];
  for (const [id, tileset] of Object.entries(library.tilesets ?? {})) {
    if (tileset.image?.type !== 'uploaded' || !tileset.image.id) continue;
    const url = assetDataUrl(library.assets?.[tileset.image.id]);
    if (!url) continue;
    out.push({ label: `shared:${libraryId}/${id}`, tileSize: tileset.tileSize ?? 16, ...decodePng(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')) });
  }
  return out;
}
