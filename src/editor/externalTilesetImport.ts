import { createExternalTileset, externalRecipeExample, validateExternalRecipeExample, type ExternalTilesetPack } from '@/project/externalTilesetCatalog';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import { projectRepository } from '@/project/persistence/repository';
import { store } from '@/project/store';
import { recordProjectSnapshot } from '@/editor/mapEditHistory';
import { uploadedAssetForImport } from '@/editor/uploadedAssetStorage';
import { genId } from '@/util/id';
import { sha256HexBytes } from '@/util/sha256';
import { pixelArtWorldCityGuide } from '@/project/pixelArtWorldCity';
import { inspectExternalTileGrounding } from '@/project/externalTileGrounding';
import { pixelArtWorldSchoolBuildingGuide } from '@/project/pixelArtWorldSchoolBuilding';
import layoutGuidance from '@/assets/pixelArtWorldLayoutGuidance.json';
import { attachPixelArtWorldBathGymObjects } from '@/project/pixelArtWorldBathGym';
import { appendPixelArtWorldMansionInteriors } from './pixelArtWorldMansionInteriors';
import { appendPixelArtWorldJapaneseInteriors } from './pixelArtWorldJapaneseInteriors';
import { appendPixelArtWorldComposites } from './pixelArtWorldComposites';

export async function prepareExternalTileset(file: File, pack: ExternalTilesetPack) {
  if (file.size > 4_000_000) throw new Error('원본 PNG를 선택하세요. 파일이 너무 큽니다.');
  const sha = await sha256HexBytes(new Uint8Array(await file.arrayBuffer()));
  if (sha !== pack.sha256) throw new Error(`${pack.filename}의 확인된 원본과 다릅니다. 크기가 같아도 다른 판본에는 AI 조립 정보를 적용하지 않습니다.`);
  const dataUrl = await readPng(file);
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  if (image.naturalWidth !== pack.width || image.naturalHeight !== pack.height) throw new Error('원본 이미지 규격이 일치하지 않습니다.');
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = pack.width; sourceCanvas.height = pack.height;
  const sourceContext = sourceCanvas.getContext('2d')!;
  sourceContext.drawImage(image, 0, 0);
  const sourcePixels = sourceContext.getImageData(0, 0, pack.width, pack.height).data;
  for (const scene of pack.scenes ?? []) {
    const issue = inspectExternalTileGrounding(pack, scene, sourcePixels)[0];
    if (issue) throw new Error(`${scene.name}: ${issue.recipeId} 밑동 (${issue.x},${issue.y})이 바닥에 닿지 않습니다.`);
  }
  const assetId = genId('chipset_img');
  const tileset = createExternalTileset(pack, assetId, genId('ts'));
  tileset.referenceDocuments = [createReferences(pack, image, dataUrl, tileset.id)];
  const cityGuide = pixelArtWorldCityGuide(pack.filename, dataUrl);
  if (cityGuide) tileset.referenceDocuments.push(cityGuide);
  const schoolGuide = pixelArtWorldSchoolBuildingGuide(pack.filename, dataUrl);
  if (schoolGuide) tileset.referenceDocuments.push(schoolGuide);
  for (const scene of pack.scenes ?? []) {
    const picture = renderExample(image, scene);
    tileset.referenceDocuments.push({
      id: `scene-${scene.id}`, name: scene.name, description: '실제 원본 타일의 장면 조립 예제. 전체 하위/상위 배열과 접근칸.',
      documents: [{ id: 'layout', name: `${scene.name}.md`, markdown: [
        `# ${scene.name}`, `tilesetId: ${tileset.id} · ${pack.filename} · SHA-256: ${pack.sha256}`,
        scene.notes, `원본 32px, 8열. 0기준 tile=y*8+x. lowerTiles/upperTiles는 행 우선. -1은 빈 칸.`,
        '배치 전 해당 영역을 비우고 전체 하위 배열 → 전체 상위 배열 순서로 적용한다. 접근칸은 통로로 유지한다. 그림 속 문은 전이 이벤트가 아니다.',
        `\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\``,
        '![실제 타일 장면](image:assembled-scene)', `[원작·사용 안내](${pack.sourcePage}) · ${pack.credit}`,
      ].join('\n\n') }],
      images: [{ id: 'assembled-scene', name: `${scene.id}.png`, caption: `${scene.name} · 사용자 원본에서 32px 그대로 조립.`, dataUrl: picture.toDataURL('image/png') }],
    });
  }
  validateTilesetReferences(tileset.referenceDocuments);
  attachPixelArtWorldBathGymObjects(pack, tileset);
  const composed = appendPixelArtWorldMansionInteriors(pack, image, tileset, createReferences, renderExample) ?? appendPixelArtWorldJapaneseInteriors(pack, image, tileset, createReferences, renderExample) ?? appendPixelArtWorldComposites(pack, image, tileset, image);
  return { dataUrl: composed?.dataUrl ?? dataUrl, sourceDataUrl: dataUrl, assetId, tileset: composed?.tileset ?? tileset,
    imageWidth: composed?.imageWidth ?? pack.width, imageHeight: composed?.imageHeight ?? pack.height };
}

/** Prepare first, then one undoable project mutation. No network fetches of source art. */
export async function importExternalTileset(file: File, pack: ExternalTilesetPack, signal?: AbortSignal): Promise<string> {
  const lineage = store.getVersionToken().lineage;
  const repository = projectRepository();
  const target = JSON.stringify(repository.currentTarget());
  const ensureCurrent = () => {
    if (signal?.aborted) throw new Error('가져오기가 취소되었습니다.');
    if (lineage !== store.getVersionToken().lineage || JSON.stringify(repository.currentTarget()) !== target) throw new Error('프로젝트가 바뀌었습니다. 대상 프로젝트에서 다시 가져오세요.');
  };
  ensureCurrent();
  const prepared = await prepareExternalTileset(file, pack);
  ensureCurrent();
  const asset = await uploadedAssetForImport({
    repository, id: prepared.assetId, name: pack.filename, kind: 'chipset', dataUrl: prepared.dataUrl,
    meta: { tileSize: 32, frameWidth: 32, frameHeight: 32, width: prepared.imageWidth, height: prepared.imageHeight, frames: prepared.tileset.count },
  });
  ensureCurrent();
  recordProjectSnapshot();
  store.update(project => {
    project.assets.uploaded[asset.id] = asset;
    project.tilesets[prepared.tileset.id] = prepared.tileset;
    project.resourceProfiles.push({ kind: 'chipset', name: pack.name, tileWidth: 32, tileHeight: 32, imageWidth: prepared.imageWidth, imageHeight: prepared.imageHeight, assetId: asset.id });
  });
  return prepared.tileset.id;
}

function readPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('PNG 파일을 읽지 못했습니다.'));
    reader.onload = () => resolve(`data:image/png;base64,${String(reader.result).split(',')[1]}`);
    reader.readAsDataURL(file);
  });
}

function createReferences(pack: ExternalTilesetPack, image: CanvasImageSource, dataUrl: string, tilesetId: string): TilesetReferenceCategory {
  const category: TilesetReferenceCategory = {
    id: 'paw-furniture-pilot', name: '구조·소품 조립 · 시범 지원',
    description: '원본 식별을 통과한 구조·소품과 별도 장면 예제만 지원. 시트 전체/문 이벤트는 미검토. 이미지는 사용자가 가져온 원본으로 이 프로젝트에서 생성.',
    images: [{ id: 'source-sheet', name: pack.filename, caption: `사용자가 가져온 ${pack.width}×${pack.height}px 원본. 32px, 8열, 타일 ID=y×8+x. ${pack.credit}`, dataUrl }],
    documents: [{ id: 'read-first', name: '먼저 읽기.md', markdown: [
      `# ${pack.name} — 구조·소품 조립 시범`,
      `tilesetId: ${tilesetId}\n\n원본: ${pack.filename}\n\nSHA-256: ${pack.sha256}\n\n확인일: ${pack.checkedAt}`,
      `[제작자 페이지](${pack.sourcePage}) · [이용 조건](${pack.termsUrl})\n\n크레딧: ${pack.credit}`,
      '원본/가공 소재 재배포 금지. 이 자료의 그림은 사용자 원본에서 프로젝트 안에 생성했다. 소재 배포용으로 추출하지 않는다. 공개 게임의 크레딧에는 제작자를 표시한다.',
      '## 범위와 좌표',
      '모든 좌표는 0기준 원본 칸. 1칸=32px, 8열. tile=y*8+x, source_rect의 픽셀 좌표는 각 값을 32배. 원본을 리사이즈하거나 다른 시트 번호를 섞지 않는다.',
      `검토된 바닥: ${pack.floorTile} (하위·통행 허용). 검토된 구조·소품: 아래 ${pack.recipes.length}종. 나머지는 미검토·통행 차단으로 시작한다.`,
      '## 배치 순서',
      '1. 이 용도의 모든 문서와 그림을 읽는다.\n2. 바닥을 하위에 반복한다.\n3. 가구의 원점을 정하고 배열 전체를 상위에 배치한다. 한 칸씩 추측하지 않는다.\n4. 가구 사각 영역 전체는 막힘, 접근칸과 통로는 비워 둔다.\n5. validateExternalRecipeExample은 아래 고정 예제의 구조/접근칸만 검사한다. AI 도구의 실제 배치 후에도 배열과 통행을 확인한다.',
      '가구는 고정 조각이다. 잘라서 반복·좌우 반전하거나 한 칸에 다른 상위 가구를 겹치지 않는다. 바닥(하위) + 가구(상위)의 두 배열을 그대로 사용한다. 상위 레이어와 ★ 통행은 다르다: 가구는 상위지만 사각 점유 범위 전체 solid다. 투명 여백도 이번 시범에서는 보수적으로 막는다.',
      '출입구/문/상호작용은 그림만으로 생기지 않는다. approach는 접근을 위해 비워 둘 좌표이며 이벤트가 아니다. 별도 장면 용도가 있으면 그 전체 배열과 지침을 읽는다. 이 묶음에 없는 구조·자동 연결은 다른 번호로 대체하지 않는다.',
      pack.notes,
      '## 확인의 한계',
      '실제 원본 픽셀의 가구 사각 영역을 검토했다. 이벤트 실행, 앉기, 장면 미학, AI 모델의 배치 성공률은 검증하지 않았다. 미검토 타일은 따로 학습한 뒤 사용한다.',
      '![원본](image:source-sheet)',
    ].join('\n\n') }],
  };
  category.documents.push({ id: 'spatial-layout', name: '공간 설계와 배치 근거.md', markdown: layoutGuidance.markdown });
  for (const recipe of pack.recipes) {
    const example = externalRecipeExample(pack, recipe);
    const bad = { ...example, lowerTiles: [...example.lowerTiles], upperTiles: [...example.upperTiles] };
    // Remove an actual bottom fragment and obstruct the actual approach cell.
    const missing = recipe.sourceRect.height * example.width + 1;
    bad.upperTiles[missing] = -1;
    bad.upperTiles[example.approach.y * example.width + example.approach.x] = recipe.tiles[0]![0]!;
    const errors = validateExternalRecipeExample(pack, recipe, bad);
    const goodCanvas = renderExample(image, example);
    const badCanvas = renderExample(image, bad);
    const comparison = document.createElement('canvas');
    comparison.width = goodCanvas.width * 2 + 8;
    comparison.height = goodCanvas.height;
    const context = comparison.getContext('2d')!;
    context.drawImage(goodCanvas, 0, 0);
    context.drawImage(badCanvas, goodCanvas.width + 8, 0);
    category.images.push({ id: recipe.id, name: `${recipe.id}-comparison.png`, caption: '왼쪽: 전체 배열. 오른쪽: 하단 조각 누락 + 접근칸 막힘. 원본 32px 그대로 합성.', dataUrl: comparison.toDataURL('image/png') });
    const { approach, ...arrays } = example;
    category.documents.push({ id: recipe.id, name: `${recipe.name}.md`, markdown: [
      `# ${recipe.name}`,
      `방향: ${recipe.facing}. 가구 원점: 예제 (1,1). 기준점: 좌상단. 접근칸: (${approach.x},${approach.y}).`,
      `설치 종류: ${recipe.placementKind ?? '미분류'}. 바닥 가구(standing)는 윗부분이 벽에 겹쳐도 되지만 실제 불투명 밑동은 바닥에 닿아야 한다. 벽 부착물(wall-mounted)과 상판 소품(countertop)을 이 규칙으로 내리지 않는다. 지지칸: ${JSON.stringify(recipe.supportCells ?? [])}. 지정 받침 타일: ${JSON.stringify(recipe.supportTileIds ?? [])}.`,
      `원본 source_rect(칸): ${JSON.stringify(recipe.sourceRect)}\n\n원본 source_rect(px): ${JSON.stringify(Object.fromEntries(Object.entries(recipe.sourceRect).map(([k, v]) => [k, v * 32])))}`,
      `원본 타일 배열:\n\n\`\`\`json\n${JSON.stringify(recipe.tiles)}\n\`\`\``,
      '최소 크기와 완성 배열(행 우선): 아래 width×height. -1은 상위 공백. 위치 (ox,oy)에 놓을 때 원본 (x,y)의 조각은 (ox+x,oy+y). 반복 없이 사각 배열 전체를 사용한다.',
      `\`\`\`json\n${JSON.stringify(arrays, null, 2)}\n\`\`\``,
      `![정상과 오류](image:${recipe.id})`,
      `오른쪽 오류 좌표(예제 기준):\n\n\`\`\`json\n${JSON.stringify(errors)}\n\`\`\``,
      '상위 가구를 하위로 옮기면 FLOOR_REPLACED, 조각 누락/변경은 OBJECT_CELL, 접근칸 점유는 APPROACH_BLOCKED. 구조만 검사하며 임의의 방 전체 경로 탐색을 대신하지 않는다.',
    ].join('\n\n') });
  }
  return category;
}

function renderExample(image: CanvasImageSource, example: { width: number; height: number; lowerTiles: number[]; upperTiles: number[] }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = example.width * 32; canvas.height = example.height * 32;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  for (const layer of [example.lowerTiles, example.upperTiles]) layer.forEach((tile, index) => {
    if (tile < 0) return;
    context.drawImage(image, tile % 8 * 32, Math.floor(tile / 8) * 32, 32, 32, index % example.width * 32, Math.floor(index / example.width) * 32, 32, 32);
  });
  return canvas;
}
