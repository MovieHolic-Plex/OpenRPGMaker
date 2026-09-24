import { resolvePixelArtWorldAutotileEdition, canAppendPixelArtWorldAutotile, XP_AUTOTILE_MASKS, xpAutotileAtlasLayout, xpAutotileGroup, type PixelArtWorldAutotilePack } from '@/project/pixelArtWorldAutotiles';
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
import { createPixelArtWorldAutotileReferences, drawXpAutotile, type PixelArtWorldAutotileReferenceOptions } from './pixelArtWorldAutotileReferences';

/** Decode only the user's file. The app never fetches third-party source PNGs. */
export async function preparePixelArtWorldAutotile(file: File, pack: PixelArtWorldAutotilePack, target: TilesetDef, base: HTMLImageElement, options?: PixelArtWorldAutotileReferenceOptions) {
  if (!canAppendPixelArtWorldAutotile(target)) throw new Error('32px 사용자 타일셋을 선택하세요. 이식·투명색·공유 참고문서가 있는 타일셋은 먼저 별도로 정리하세요.');
  if (target.autotileGroups?.some(group => group.id === pack.id) || target.tileGroups?.some(group => group.id === pack.id) || target.referenceDocuments?.some(category => category.id === pack.id)) throw new Error('이 자동타일은 이미 추가되어 있습니다.');
  if (file.size > 4_000_000) throw new Error('확인된 원본 PNG를 선택하세요.');
  const sha = await sha256HexBytes(new Uint8Array(await file.arrayBuffer()));
  const edition = resolvePixelArtWorldAutotileEdition(pack, sha);
  if (!edition) throw new Error(`${pack.filename}의 확인된 원본과 다릅니다. 다른 판본에는 연결 정보를 적용하지 않습니다.`);
  pack = edition;
  const url = URL.createObjectURL(file);
  let source: HTMLImageElement;
  try { source = await decodeImage(url); } finally { URL.revokeObjectURL(url); }
  if (source.naturalWidth !== pack.sourceWidth || source.naturalHeight !== pack.sourceHeight) throw new Error(`${pack.sourceWidth}×${pack.sourceHeight}px 확인된 XP 원본이 필요합니다.`);
  const columns = target.tilesPerRow;
  const offset = Math.ceil(target.count / columns) * columns;
  if (base.naturalWidth !== columns * 32 || base.naturalHeight !== offset / columns * 32) throw new Error('대상 타일셋의 실제 이미지와 등록된 칸 수가 다릅니다. 설정을 확인하세요.');
  const { tileIds, count } = xpAutotileAtlasLayout(offset, columns, pack.frames);
  if (count / columns * 32 > 16384) throw new Error('대상 타일셋이 너무 큽니다. 다른 타일셋을 선택하세요.');
  const canvas = document.createElement('canvas');
  canvas.width = columns * 32; canvas.height = count / columns * 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('자동타일 이미지를 만들지 못했습니다.');
  context.imageSmoothingEnabled = false;
  context.drawImage(base, 0, 0);
  XP_AUTOTILE_MASKS.forEach((mask, index) => {
    for (let frame = 0; frame < pack.frames; frame++) {
      const tile = tileIds[index] + frame;
      drawXpAutotile(context, source, mask, tile % columns * 32, Math.floor(tile / columns) * 32, frame);
    }
  });
  const assetId = genId('chipset_img');
  const tileset = structuredClone(target);
  tileset.image = { type: 'uploaded', id: assetId };
  tileset.count = count;
  const pass = pack.passage === 'passable';
  const variants = new Map(tileIds.flatMap((baseTile, index) => Array.from({ length: pack.frames }, (_, frame) => [baseTile + frame, { index, frame }] as const)));
  for (let tile = target.count; tile < count; tile++) {
    const variant = variants.get(tile);
    tileset.passability[tile] = { up: !!variant && pass, down: !!variant && pass, left: !!variant && pass, right: !!variant && pass };
    tileset.priority[tile] = variant ? pack.defaultLayer : 'lower'; tileset.terrain[tile] = pack.terrainTag;
    (tileset.tileMeta ??= [])[tile] = variant ? {
      label: pack.name, description: `${pack.description} 8방향 mask=${XP_AUTOTILE_MASKS[variant.index]}, frame=${variant.frame}/${pack.frames}. ${pack.placement}.`,
      defaultLayer: pack.defaultLayer, passage: pack.passage, repeatability: pack.placement === 'lower-autoshape' ? 'auto' : 'fixed', source: 'imported',
      role: pack.role, terrainTag: pack.terrainTag, tags: [pack.surface, pack.id, `underlay:${pack.underlay}`],
    } : { label: '빈 칸', description: '아틀라스 행 정렬용 공백. 배치하지 않는다.', source: 'unknown' };
  }
  if (pack.placement === 'lower-autoshape') {
    const group = xpAutotileGroup(pack, offset, tileIds);
    group.memberTileIds = [...variants.keys()];
    (tileset.autotileGroups ??= []).push(group);
  }
  if (pack.frames > 1) (tileset.animationStrips ??= []).push(...tileIds.map(baseTile => ({ baseTile, frames: pack.frames, fps: pack.fps! })));
  (tileset.tileGroups ??= []).push({
    id: pack.id, name: pack.name, role: pack.role, defaultLayer: pack.defaultLayer,
    tileIds, source: 'imported', confidence: 'high',
    description: pack.description, placementRules: `${pack.placement === 'lower-autoshape' ? '같은 그룹을 lower에 칠해 8방향 자동 성형.' : '홈 레이어의 전체 마스크 배열로 수동 배치. 자동 성형 그룹 없음.'} 받침: ${pack.underlay}. ${pack.restrictions.join(' ')} 원본을 12칸으로 잘라 배치하지 않는다.`,
  });
  const raw = document.createElement('canvas'); raw.width = pack.sourceWidth; raw.height = pack.sourceHeight;
  raw.getContext('2d')!.drawImage(source, 0, 0);
  (tileset.referenceDocuments ??= []).push(createPixelArtWorldAutotileReferences(pack, source, raw.toDataURL('image/png'), offset, tileset.id, tileIds, { image: base, tileset: target }, options));
  validateTilesetReferences(tileset.referenceDocuments);
  validateTileset(tileset.id, tileset);
  return { tileset, assetId, dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, offset, tileIds };
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
