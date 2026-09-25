import { PIXEL_ART_WORLD_FOOD_SUPPORT as support, createFoodTileset, foodCompositionRecipes, foodCompositionRect, foodCompositionExample, validateFoodCompositionExample, type PixelArtWorldFoodPack } from '@/project/pixelArtWorldFood';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import { sha256HexBytes } from '@/util/sha256';
import { genId } from '@/util/id';
import { projectRepository } from '@/project/persistence/repository';
import { store } from '@/project/store';
import { recordProjectSnapshot } from '@/editor/mapEditHistory';
import { uploadedAssetForImport } from '@/editor/uploadedAssetStorage';
import type { UploadedAsset } from '@/project/types';
function canvas(width: number, height: number) {
    const image = document.createElement('canvas');
    image.width = width;
    image.height = height;
    const ctx = image.getContext('2d');
    if (!ctx)
        throw new Error('이미지 합성 캔버스를 만들지 못했습니다.');
    ctx.imageSmoothingEnabled = false;
    return { image, ctx };
}
async function original(file: File, expected: {
    filename: string;
    sha256: string;
    width: number;
    height: number;
}) {
    if (file.size > 4000000 || await sha256HexBytes(new Uint8Array(await file.arrayBuffer())) !== expected.sha256)
        throw new Error(`${expected.filename}의 확인된 원본과 다릅니다.`);
    const url = URL.createObjectURL(file), image = new Image();
    try {
        image.src = url;
        await image.decode();
    }
    finally {
        URL.revokeObjectURL(url);
    }
    if (image.naturalWidth !== expected.width || image.naturalHeight !== expected.height)
        throw new Error('원본 이미지 규격이 다릅니다.');
    const value = canvas(expected.width, expected.height);
    value.ctx.drawImage(image, 0, 0);
    return value;
}
function renderExample(atlas: HTMLCanvasElement, value: ReturnType<typeof foodCompositionExample>) {
    const result = canvas(value.width * 32, value.height * 32);
    for (const layer of [value.lowerTiles, value.upperTiles])
        layer.forEach((tile, i) => {
            if (tile >= 0)
                result.ctx.drawImage(atlas, tile % 12 * 32, Math.floor(tile / 12) * 32, 32, 32, i % value.width * 32, Math.floor(i / value.width) * 32, 32, 32);
        });
    return result.image;
}
/** Pure preparation: source pixels remain in user-owned assets, never bundled or fetched. */
export async function preparePixelArtWorldFood(file: File, pack: PixelArtWorldFoodPack, tableFile: File) {
    const source = await original(file, pack), table = await original(tableFile, support);
    const recipes = foodCompositionRecipes(pack), rows = 1 + Math.ceil(recipes.length / 4) * 3;
    const atlas = canvas(384, rows * 32), f = support.floorRect, t = support.sourceRect;
    atlas.ctx.drawImage(table.image, f.x, f.y, f.width, f.height, 0, 0, 32, 32);
    const sourceId = genId('chipset_img'), composedId = genId('chipset_img');
    const rawTileset = createFoodTileset(pack, sourceId, genId('ts'), false), tileset = createFoodTileset(pack, composedId, genId('ts'), true);
    const raw: TilesetReferenceCategory = { id: 'paw-food-source', name: '음식 원본·상태·전체 객체', description: '4열 실제 판본. 식탁 없는 투명 소품은 배경이나 독립 가구가 아니다.', images: [{ id: 'source', name: pack.filename, caption: `${pack.filename} · ${pack.width}×${pack.height} · 원본4열`, dataUrl: source.image.toDataURL() }], documents: [{ id: 'read-first', name: '먼저 읽기.md', markdown: `# ${pack.name}\n\n원본 SHA-256: ${pack.sha256}\n\n32px·4열, tile=y*4+x. 전체 ${pack.coverage.cells}칸을 ${pack.recipes.length}개 고정 그림 묶음으로 구분한다. 빈 접시·포장·식후도 별도 상태이며 애니메이션이 아니다. 그림 하나에 여러 소품이 있으면 분리하지 않는다. 이름은 보이는 형상의 기술이며 음식의 재료/종류를 확정하는 사전이 아니다.\n\n음식만 기존 상위 식탁에 찍으면 식탁이 지워진다. 함께 준비된 합성 타일셋의 전체 객체를 사용한다. 원본은 upper/passable, 받침이 충돌을 소유한다.\n\n매달린 고기·소시지·장갑은 식탁 합성에서 제외한다. 원본 조각/받침 고정점 미검토를 혼동하지 않는다.\n\n[제작자](${pack.sourcePage}) · [규약](${pack.termsUrl}) · ${pack.credit}. 원본/가공 소재 재배포 금지. 공개 게임에 크레딧.\n\n![원본](image:source)` }] };
    for (const recipe of pack.recipes) {
        const q = recipe.pixelRect, b = recipe.alphaBounds;
        const pixels = source.ctx.getImageData(q.x, q.y, q.width, q.height).data;
        let minX = q.width, minY = q.height, maxX = -1, maxY = -1;
        for (let y = 0; y < q.height; y++)
            for (let x = 0; x < q.width; x++)
                if (pixels[(y * q.width + x) * 4 + 3]) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
        if (minX !== b.x || minY !== b.y || maxX - minX + 1 !== b.width || maxY - minY + 1 !== b.height)
            throw new Error(`${recipe.id} 투명 경계가 메타데이터와 다릅니다.`);
        const crop = canvas(q.width, q.height);
        crop.ctx.drawImage(source.image, q.x, q.y, q.width, q.height, 0, 0, q.width, q.height);
        raw.images.push({ id: recipe.id, name: `${recipe.id}.png`, caption: `${recipe.name} · 원본 사각형 전체`, dataUrl: crop.image.toDataURL() });
        raw.documents.push({ id: recipe.id, name: `${recipe.name}.md`, markdown: `# ${recipe.name}\n\n${recipe.notes}\n\n원본의 실제 비투명 경계/기준점은 픽셀 단위이며 sourceRect는32px칸이다. lowerTiles는 전부-1(바닥 없음), upperTiles는 아래 tiles를 행 우선으로 펼친다. 이 추출 배열은 방 배치 정답이 아니다.\n\n\`\`\`json\n${JSON.stringify({ ...recipe, lowerTiles: Array<number>(q.width * q.height / 1024).fill(-1), upperTiles: recipe.tiles.flat() }, null, 2)}\n\`\`\`\n\n![전체 객체](image:${recipe.id})` });
    }
    recipes.forEach((recipe, index) => {
        const r = foodCompositionRect(index), b = recipe.alphaBounds, q = recipe.pixelRect;
        const dx = r.x * 32, dy = r.y * 32;
        atlas.ctx.drawImage(table.image, t.x, t.y, t.width, t.height, dx + support.tableOrigin.x, dy + support.tableOrigin.y, t.width, t.height);
        const px = support.foodAnchor.x - Math.floor(b.width / 2), py = support.foodAnchor.y + 1 - b.height;
        if (px < 0 || py < 0 || px + b.width > 96 || py + b.height > 64)
            throw new Error('음식이 상판 합성 영역을 벗어납니다.');
        atlas.ctx.drawImage(source.image, q.x + b.x, q.y + b.y, b.width, b.height, dx + px, dy + py, b.width, b.height);
    });
    const composite: TilesetReferenceCategory = { id: 'paw-food-table', name: '식탁 받침·음식 합성 조립', description: '식탁을 지우지 않는 실제 픽셀 합성. 전체배열/정상·오류/남쪽 접근.', images: [], documents: [{ id: 'read-first', name: '합성 먼저 읽기.md', markdown: `# ${pack.name} · 식탁 합성\n\n원본 음식:${pack.filename} SHA:${pack.sha256}\n\n별도 받침:${support.filename} SHA:${support.sha256}\n\n받침 출처:[제작자](${support.sourcePage}). 원본 식탁(0,512)96×64픽셀을 합성 객체의(0,32)에 먼저 그린다. 음식의 alphaBounds를 원본에서 잘라 하단 중심(48,55)에 올린다. 확대/축소/팔레트 교체 없음.\n\n합성 atlas는32px·12열이며 원본4열 번호와 다르다. 0번은 식탁 원본 바닥; 첫 행 나머지 예약칸은 사용하지 않는다. 각 객체3×3 전체를 상위에 찍는다. 위 첫 행은 투명/음식 돌출부 통과, 아래 두 행은 식탁 차단. 하위 바닥 보존, 남쪽 한 칸 접근. 별도 음식은 다시 겹치지 않는다.\n\n${recipes.length}개 식탁 합성. 제외:${pack.coverage.excludedCompositionIds.join(', ') || '없음'}. ${pack.credit}. 이벤트/먹기/상태변화 자동 생성 없음.` }] };
    recipes.forEach((recipe, index) => {
        const example = foodCompositionExample(index), incorrect = structuredClone(example);
        // Deliberately remove the table legs and obstruct the south interaction approach.
        for (let x = 1; x <= 3; x++)
            incorrect.upperTiles[3 * 5 + x] = -1;
        incorrect.upperTiles[4 * 5 + 2] = example.upperTiles[2 * 5 + 2];
        const errors = validateFoodCompositionExample(index, incorrect);
        const good = renderExample(atlas.image, example), bad = renderExample(atlas.image, incorrect), comparison = canvas(328, 160);
        comparison.ctx.drawImage(good, 0, 0);
        comparison.ctx.drawImage(bad, 168, 0);
        composite.images.push({ id: recipe.id, name: `${recipe.id}-comparison.png`, caption: '왼쪽: 음식+식탁 전체와 바닥/접근. 오른쪽: 식탁 다리 삭제와 남쪽 접근 차단.', dataUrl: comparison.image.toDataURL() });
        composite.documents.push({ id: recipe.id, name: `${recipe.name} 식탁.md`, markdown: `# ${recipe.name} · 실제 식탁 합성\n\n먼저 하위 전체 배열 → 상위 전체3×3. 남쪽(2,4)는 비운다. 상위 음식만 찍어 식탁을 교체하지 않는다.\n\n합성 타일셋:${tileset.id}. 원본 식탁과 소품 SHA는 먼저 읽기를 따른다.\n\n\`\`\`json\n${JSON.stringify({ recipeId: recipe.id, sourceRect: recipe.pixelRect, alphaBounds: recipe.alphaBounds, atlasRect: foodCompositionRect(index), expected: example, incorrect, errors }, null, 2)}\n\`\`\`\n\n![정상/오류 비교](image:${recipe.id})\n\n구조 검사: 배열/누락/접근칸. 이벤트 실행이나 미적 평가를 대신하지 않는다.` });
    });
    validateTilesetReferences([raw]);
    validateTilesetReferences([composite]);
    rawTileset.referenceDocuments = [raw];
    tileset.referenceDocuments = [composite];
    // Object records own their exact recipe references, so the Object tab does not
    // depend on looking up a sibling tileset-wide document after ordinary import.
    const referencesFor = (category: TilesetReferenceCategory, recipeId: string) => ({
        ...category,
        documents: category.documents.filter(document => document.id === 'read-first' || document.id === recipeId),
        images: category.images.filter(image => image.id === 'source' || image.id === recipeId),
    });
    rawTileset.structureKits = pack.recipes.map(recipe => ({
        id: recipe.id, kind: 'section', name: `${recipe.name} · ${recipe.composition === 'table' ? '원본·받침 필요' : '원본·고정점 미검토'}`,
        width: recipe.sourceRect.width, height: recipe.sourceRect.height, tileSize: 32,
        rows: recipe.tiles.map(row => ({ tiles: row.map(() => -1), upperTiles: [...row] })),
        learnedFrom: 'db-authored',
        ai: {
            description: `${recipe.placementKind}. ${recipe.notes}`,
            placementRules: '원본 소품 추출 객체. 기존 하위 바닥 보존. 기존 상위 식탁을 덮지 않는다. 식탁 합성 객체를 우선 사용하며 매달린 객체의 고정점은 미검토.',
            role: 'prop', repeatability: 'fixed', layerHome: 'upper',
            tags: ['paw-food', 'source-only', recipe.composition === 'table' ? 'requires-support' : 'unreviewed-anchor'],
        },
        referenceDocuments: [referencesFor(raw, recipe.id)],
    }));
    tileset.structureKits = recipes.map((recipe, index) => {
        const rect = foodCompositionRect(index);
        return {
            id: `${recipe.id}-table`, kind: 'section', name: `${recipe.name} · 식탁 합성`,
            width: 3, height: 3, tileSize: 32,
            rows: Array.from({ length: 3 }, (_, y) => ({ tiles: [-1, -1, -1], upperTiles: Array.from({ length: 3 }, (_, x) => (rect.y + y) * 12 + rect.x + x) })),
            learnedFrom: 'db-authored',
            ai: {
                description: '음식과 원본 식탁 전체를 픽셀 합성한 완전3×3 객체. 아래 두 행은 식탁, 위 행은 음식 돌출 여백.',
                placementRules: '전체3×3을 상위에 한 번 배치한다. 하위-1은 기존 바닥 보존이다. 남쪽 로컬(1,3) 접근칸을 비우고 식탁 위에 원본 음식 타일을 다시 덮지 않는다. 5×5참고그림은 바닥과 접근을 포함한 학습 예제다.',
                role: 'prop', repeatability: 'fixed', layerHome: 'upper', tags: ['paw-food', 'table-composite'],
            },
            referenceDocuments: [referencesFor(raw, recipe.id), referencesFor(composite, recipe.id)],
        };
    });
    for (const kit of [...rawTileset.structureKits, ...tileset.structureKits]) validateTilesetReferences(kit.referenceDocuments);
    return { packId: pack.id, sourceSha256: pack.sha256, supportSha256: support.sha256,
        prepared: [{ assetId: sourceId, dataUrl: source.image.toDataURL(), tileset: rawTileset, imageWidth: pack.width, imageHeight: pack.height, filename: pack.filename }, { assetId: composedId, dataUrl: atlas.image.toDataURL(), tileset, imageWidth: 384, imageHeight: rows * 32, filename: `${pack.id}-table.png` }],
        kits: recipes.map((recipe, index) => ({ id: `${recipe.id}-table`, name: recipe.name, tilesetId: tileset.id, sourceRecipeId: recipe.id, objectKitId: tileset.structureKits![index].id, referenceDocuments: tileset.structureKits![index].referenceDocuments, ...foodCompositionExample(index) })),
        excludedCompositionIds: pack.coverage.excludedCompositionIds };
}
export async function importPixelArtWorldFood(file: File, pack: PixelArtWorldFoodPack, tableFile: File, signal?: AbortSignal) {
    const lineage = store.getVersionToken().lineage, repository = projectRepository(), target = JSON.stringify(repository.currentTarget());
    const ensure = () => { if (signal?.aborted || lineage !== store.getVersionToken().lineage || JSON.stringify(repository.currentTarget()) !== target)
        throw new Error('프로젝트가 바뀌었거나 가져오기가 취소되었습니다.'); };
    ensure();
    const value = await preparePixelArtWorldFood(file, pack, tableFile);
    ensure();
    const assets: UploadedAsset[] = [];
    for (const prepared of value.prepared) {
        assets.push(await uploadedAssetForImport({ repository, id: prepared.assetId, name: prepared.filename, kind: 'chipset', dataUrl: prepared.dataUrl, meta: { tileSize: 32, frameWidth: 32, frameHeight: 32, width: prepared.imageWidth, height: prepared.imageHeight, frames: prepared.tileset.count } }));
        ensure();
    }
    recordProjectSnapshot();
    store.update(project => { value.prepared.forEach((prepared, i) => { project.assets.uploaded[assets[i].id] = assets[i]; project.tilesets[prepared.tileset.id] = prepared.tileset; project.resourceProfiles.push({ kind: 'chipset', name: prepared.tileset.name, tileWidth: 32, tileHeight: 32, imageWidth: prepared.imageWidth, imageHeight: prepared.imageHeight, assetId: prepared.assetId }); }); });
    return value.prepared[1].tileset.id;
}
