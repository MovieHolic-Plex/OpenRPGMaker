import { canAppendPixelArtWorldAutotile, XP_AUTOTILE_MASKS, xpAutotileGroup, type PixelArtWorldAutotilePack } from '@/project/pixelArtWorldAutotiles';
import { validateTileset } from '@/project/io/shapeResourceFields';
import { validateTilesetReferences } from '@/project/tilesetReferences';
import type { TilesetDef } from '@/project/types';
import { sha256HexBytes } from '@/util/sha256';
import { genId } from '@/util/id';
import { uploadedAssetUrl } from '@/project/persistence/assetAccessors';
import { projectRepository } from '@/project/persistence/repository';
import { store } from '@/project/store';
import { uploadedAssetForImport } from '@/editor/uploadedAssetStorage';
import { recordProjectSnapshot } from '@/editor/mapEditHistory';
import { createPixelArtWorldAutotileReferences, drawXpAutotile } from './pixelArtWorldAutotileReferences';

/** Decode only the user's file. The app never fetches third-party source PNGs. */
export async function preparePixelArtWorldAutotile(file: File, pack: PixelArtWorldAutotilePack, target: TilesetDef, base: HTMLImageElement) {
  if (!canAppendPixelArtWorldAutotile(target)) throw new Error('32px 사용자 타일셋을 선택하세요. 이식·투명색·공유 참고문서가 있는 타일셋은 먼저 별도로 정리하세요.');
  if (target.autotileGroups?.some(group => group.id === pack.id) || target.tileGroups?.some(group => group.id === pack.id) || target.referenceDocuments?.some(category => category.id === pack.id)) throw new Error('이 자동타일은 이미 추가되어 있습니다.');
  if (file.size > 4_000_000) throw new Error('확인된 원본 PNG를 선택하세요.');
  const sha = await sha256HexBytes(new Uint8Array(await file.arrayBuffer()));
  if (sha !== pack.sha256) throw new Error(`${pack.filename}의 확인된 원본과 다릅니다. 다른 판본에는 연결 정보를 적용하지 않습니다.`);
  const url = URL.createObjectURL(file);
  let source: HTMLImageElement;
  try { source = await decodeImage(url); } finally { URL.revokeObjectURL(url); }
  if (source.naturalWidth !== 96 || source.naturalHeight !== 128) throw new Error('96×128px 정적 XP 원본만 지원합니다.');
  const columns = target.tilesPerRow;
  const offset = Math.ceil(target.count / columns) * columns;
  if (base.naturalWidth !== columns * 32 || base.naturalHeight !== offset / columns * 32) throw new Error('대상 타일셋의 실제 이미지와 등록된 칸 수가 다릅니다. 설정을 확인하세요.');
  const count = Math.ceil((offset + XP_AUTOTILE_MASKS.length) / columns) * columns;
  if (count / columns * 32 > 16384) throw new Error('대상 타일셋이 너무 큽니다. 다른 타일셋을 선택하세요.');
  const canvas = document.createElement('canvas');
  canvas.width = columns * 32; canvas.height = count / columns * 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('자동타일 이미지를 만들지 못했습니다.');
  context.imageSmoothingEnabled = false;
  context.drawImage(base, 0, 0);
  XP_AUTOTILE_MASKS.forEach((mask, index) => {
    const tile = offset + index;
    drawXpAutotile(context, source, mask, tile % columns * 32, Math.floor(tile / columns) * 32);
  });
  const assetId = genId('chipset_img');
  const tileset = structuredClone(target);
  tileset.image = { type: 'uploaded', id: assetId };
  tileset.count = count;
  const pass = pack.passage === 'passable';
  for (let tile = target.count; tile < count; tile++) {
    const variant = tile >= offset && tile < offset + XP_AUTOTILE_MASKS.length;
    tileset.passability[tile] = { up: variant && pass, down: variant && pass, left: variant && pass, right: variant && pass };
    tileset.priority[tile] = 'lower'; tileset.terrain[tile] = 0;
    (tileset.tileMeta ??= [])[tile] = variant ? {
      label: pack.name, description: `${pack.description} 8방향 mask=${XP_AUTOTILE_MASKS[tile - offset]}. ${pack.id} 자동 연결.`,
      defaultLayer: 'lower', passage: pack.passage, repeatability: 'auto', source: 'imported',
    } : { label: '빈 칸', description: '아틀라스 행 정렬용 공백. 배치하지 않는다.', source: 'unknown' };
  }
  (tileset.autotileGroups ??= []).push(xpAutotileGroup(pack, offset));
  (tileset.tileGroups ??= []).push({
    id: pack.id, name: pack.name, role: pack.role, defaultLayer: 'lower',
    tileIds: XP_AUTOTILE_MASKS.map((_, index) => offset + index), source: 'imported', confidence: 'high',
    description: pack.description, placementRules: '같은 그룹을 lower에 칠해 8방향 자동 성형. 원본을 12칸으로 잘라 배치하지 않는다. 다른 재료와 자동 연결하지 않는다.',
  });
  const raw = document.createElement('canvas'); raw.width = 96; raw.height = 128;
  raw.getContext('2d')!.drawImage(source, 0, 0);
  (tileset.referenceDocuments ??= []).push(createPixelArtWorldAutotileReferences(pack, source, raw.toDataURL('image/png'), offset, tileset.id));
  validateTilesetReferences(tileset.referenceDocuments);
  validateTileset(tileset.id, tileset);
  return { tileset, assetId, dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, offset };
}

/** Append once, without changing previous tile IDs or overwriting concurrent target edits. */
export async function importPixelArtWorldAutotile(file: File, pack: PixelArtWorldAutotilePack, tilesetId: string, signal?: AbortSignal): Promise<string> {
  const project = store.getCurrent();
  const target = project.tilesets[tilesetId];
  if (!target || !canAppendPixelArtWorldAutotile(target)) throw new Error('추가할 32px 사용자 타일셋을 선택하세요.');
  const baseAsset = project.assets.uploaded[target.image.id];
  const baseUrl = baseAsset && uploadedAssetUrl(baseAsset);
  if (!baseUrl) throw new Error('대상 타일셋 이미지를 불러올 수 없습니다.');
  const lineage = store.getVersionToken().lineage;
  const signature = JSON.stringify(target), assetSignature = JSON.stringify(baseAsset);
  const repository = projectRepository(), repositoryTarget = JSON.stringify(repository.currentTarget());
  const ensureCurrent = () => {
    if (signal?.aborted) throw new Error('가져오기가 취소되었습니다.');
    const current = store.getCurrent();
    if (store.getVersionToken().lineage !== lineage || JSON.stringify(repository.currentTarget()) !== repositoryTarget
      || JSON.stringify(current.tilesets[tilesetId]) !== signature
      || JSON.stringify(current.assets.uploaded[target.image.id]) !== assetSignature) throw new Error('대상 프로젝트 또는 타일셋이 변경되었습니다. 다시 가져오세요.');
  };
  ensureCurrent();
  const base = await decodeImage(baseUrl);
  ensureCurrent();
  const prepared = await preparePixelArtWorldAutotile(file, pack, target, base);
  ensureCurrent();
  const asset = await uploadedAssetForImport({ repository, id: prepared.assetId, name: `${target.name}-${pack.id}.png`, kind: 'chipset', dataUrl: prepared.dataUrl,
    meta: { tileSize: 32, frameWidth: 32, frameHeight: 32, width: prepared.width, height: prepared.height, frames: prepared.tileset.count } });
  ensureCurrent();
  recordProjectSnapshot();
  store.update(current => {
    current.assets.uploaded[asset.id] = asset;
    current.tilesets[tilesetId] = prepared.tileset;
    current.resourceProfiles.push({ kind: 'chipset', name: `${target.name} + ${pack.name}`, tileWidth: 32, tileHeight: 32, imageWidth: prepared.width, imageHeight: prepared.height, assetId: asset.id });
  });
  return tilesetId;
}

async function decodeImage(url: string): Promise<HTMLImageElement> {
  const image = new Image(); image.src = url; await image.decode(); return image;
}
