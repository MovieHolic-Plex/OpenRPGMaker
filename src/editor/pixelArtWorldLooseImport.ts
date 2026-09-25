import { PIXEL_ART_WORLD_LOOSE_SUPPORT as support, createLooseTileset, fixedLooseRecipes, looseExample, type LoosePack } from '@/project/pixelArtWorldLoose';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import { sha256HexBytes } from '@/util/sha256';
import { genId } from '@/util/id';
import { projectRepository } from '@/project/persistence/repository';
import { store } from '@/project/store';
import { recordProjectSnapshot } from '@/editor/mapEditHistory';
import { uploadedAssetForImport } from '@/editor/uploadedAssetStorage';
function canvas(width: number, height: number) { const image = document.createElement('canvas'); image.width = width; image.height = height; const ctx = image.getContext('2d'); if (!ctx)
    throw Error('이미지 캔버스를 만들지 못했습니다.'); ctx.imageSmoothingEnabled = false; return { image, ctx }; }
async function original(file: File, expected: {
    filename: string;
    sha256: string;
    width: number;
    height: number;
}) {
    if (file.size > 4000000 || await sha256HexBytes(new Uint8Array(await file.arrayBuffer())) !== expected.sha256)
        throw Error(`${expected.filename}의 확인된 원본과 다릅니다.`);
    const url = URL.createObjectURL(file), image = new Image();
    try {
        image.src = url;
        await image.decode();
    }
    finally {
        URL.revokeObjectURL(url);
    }
    if (image.naturalWidth !== expected.width || image.naturalHeight !== expected.height)
        throw Error('원본 규격이 다릅니다.');
    const result = canvas(expected.width, expected.height);
    result.ctx.drawImage(image, 0, 0);
    return result;
}
function render(atlas: HTMLCanvasElement, value: ReturnType<typeof looseExample>) { const out = canvas(value.width * 32, value.height * 32); for (const layer of [value.lowerTiles, value.upperTiles])
    layer.forEach((tile, index) => { if (tile >= 0)
        out.ctx.drawImage(atlas, tile % 8 * 32, Math.floor(tile / 8) * 32, 32, 32, index % value.width * 32, Math.floor(index / value.width) * 32, 32, 32); }); return out.image; }
/** User-owned exact source Files only. No network or project mutation during preparation. */
export async function preparePixelArtWorldLoose(file: File, pack: LoosePack, supportFile: File) {
    const source = await original(file, pack), backing = await original(supportFile, support), atlas = canvas(pack.atlas.width, pack.atlas.height);
    atlas.ctx.drawImage(backing.image, 0, 0, 32, 32, 0, 0, 32, 32);
    atlas.ctx.drawImage(backing.image, 32, 96, 32, 32, 32, 0, 32, 32);
    atlas.ctx.drawImage(backing.image, 32, 64, 32, 32, 64, 0, 32, 32);
    const sourceId = genId('chipset_img'), atlasId = genId('chipset_img'), rawTileset = createLooseTileset(pack, sourceId, genId('ts'), true), tileset = createLooseTileset(pack, atlasId, genId('ts'));
    const first = `# ${pack.name} · 원본과 받침\n\n원본:${pack.filename} ${pack.width}×${pack.height}px SHA-256:${pack.sha256}\n\n[제작자](${pack.sourcePage}) · [규약](${pack.termsUrl}) · ${pack.credit}. 소재 재배포 금지, 공개 게임 크레딧.\n\n원본의 전체 객체 경계는 pixelRect이며 캔버스 배수를16/32/48px규격으로 추정하지 않는다. source 참고 타일셋의16px분할은 전체 그림을 표시하기 위한 보존용 격자이며 객체 경계가 아니다. 실제 객체는 원본 픽셀을 확대/축소하지 않고32px칸에 투명 여백을 더해 포장한다. 원본과 출력 타일번호는 다르다.\n\n받침 원본:${support.filename} SHA:${support.sha256}. [받침 제작자](${support.sourcePage}). 바닥=(0,0)32×32, 벽몸통=(32,96)32×32, 벽상단=(32,64)32×32. 상판 소품은 식탁(0,512)96×64를3×3객체의(0,32)에 먼저 그리고 음식처럼 소품 alpha밑변 중심을(48,55)에 합성한다. 이미 상위에 있는 식탁에 소품만 찍으면 식탁이 지워진다.\n\n다른 객체는 pixelRect를 크기변경 없이 복사하고 가로중앙/세로하단에 투명 여백만 추가한다. 벽 장식은 기존벽 위, 나무/문틀은 직접 지정한 blockingCells를 우선하며, 없을 때 반투명 그림자·캔버스 여백을 제외한 마지막 완전불투명 줄이 있는 칸 차단, 일반가구는 알파가 있는 칸을 보수적으로 차단, 지면장식/효과/아이콘은 통과한다. 효과·인물·프레임은 정적그림만이며 작동/비행/애니메이션/문/출입이벤트가 아니다.\n\n원본영역:${pack.coverage.sourceRegions}, 완전객체:${pack.coverage.fixedObjects}, 고정점보류:${pack.coverage.sourceOnly}, 잔여불투명픽셀:${pack.coverage.unassignedOpaquePixels}. 보류는 source-only나 holds를 따르며 전체시트를모두이해했다고 주장하지 않는다.`;
    const raw: TilesetReferenceCategory = { id: 'paw-loose-source', name: '개별 소품 원본·판본·보류', description: '원본 전체와 정확한 수동 픽셀 사각형. 원본 보존용16px격자를 객체단위로 간주하지 않는다.', documents: [{ id: 'read-first', name: '원본 먼저 읽기.md', markdown: first }, { id: 'source-inventory', name: '전체 영역과 보류.md', markdown: `# 전체 수동 영역\n\n등록 객체를 제외한 잔여영역은 추가검토 전 사용하지 않는다.\n\n\`\`\`json\n${JSON.stringify(pack, null, 2)}\n\`\`\`\n\n![원본](image:source)` }], images: [{ id: 'source', name: pack.filename, caption: '사용자 원본 전체. 리사이즈/자동분해하지 않음.', dataUrl: source.image.toDataURL() }] };
    const refs: TilesetReferenceCategory = { id: 'paw-loose-objects', name: '완전 객체·받침·조립', description: '수동 확인한 원본 전체객체의 고정 조립. 전체배열/실제그림/오류좌표.', documents: [{ id: 'read-first', name: '원본·받침 먼저 읽기.md', markdown: first }], images: [] };
    for (const recipe of pack.recipes) {
        const q = recipe.pixelRect, b = recipe.alphaBounds, p = source.ctx.getImageData(q.x, q.y, q.width, q.height).data;
        let x0 = q.width, y0 = q.height, x1 = -1, y1 = -1;
        for (let y = 0; y < q.height; y++)
            for (let x = 0; x < q.width; x++)
                if (p[(y * q.width + x) * 4 + 3]) {
                    x0 = Math.min(x0, x);
                    y0 = Math.min(y0, y);
                    x1 = Math.max(x1, x);
                    y1 = Math.max(y1, y);
                }
        if (x0 !== b.x || y0 !== b.y || x1 - x0 + 1 !== b.width || y1 - y0 + 1 !== b.height)
            throw Error(`원본투명경계 불일치 ${recipe.id}`);
        if (recipe.supportStatus === 'source-only')
            continue;
        const r = recipe.outputRect!, offset = recipe.pixelOffset!, dx = r.x * 32, dy = r.y * 32;
        if (recipe.placementKind === 'surface') {
            atlas.ctx.drawImage(backing.image, 0, 512, 96, 64, dx, dy + 32, 96, 64);
            atlas.ctx.drawImage(source.image, q.x + b.x, q.y + b.y, b.width, b.height, dx + offset.x, dy + offset.y, b.width, b.height);
        }
        else
            atlas.ctx.drawImage(source.image, q.x, q.y, q.width, q.height, dx + offset.x, dy + offset.y, q.width, q.height);
        // Find the last fully opaque source row, ignoring translucent shadows and canvas padding.
        let feetY = -1;
        if (recipe.collision === 'opaque-feet')
            for (let yy = 0; yy < q.height; yy++)
                for (let xx = 0; xx < q.width; xx++)
                    if (p[(yy * q.width + xx) * 4 + 3] === 255)
                        feetY = Math.max(feetY, yy + offset.y);
        const feetRow = feetY < 0 ? -1 : Math.floor(feetY / 32);
        // Collision and transparent holes are separate from manual source object boundaries.
        for (let y = 0; y < r.height; y++)
            for (let x = 0; x < r.width; x++) {
                const tile = (r.y + y) * 8 + r.x + x, pixels = atlas.ctx.getImageData(dx + x * 32, dy + y * 32, 32, 32).data;
                const any = pixels.some((v, i) => i % 4 === 3 && v > 0), opaque = pixels.some((v, i) => i % 4 === 3 && v === 255);
                let blocked = recipe.collision === 'conservative-rectangle' && any;
                if (recipe.collision === 'opaque-feet')
                    blocked = y === feetRow && opaque;
                if (recipe.placementKind === 'surface')
                    blocked = y > 0;
                if (recipe.blockingCells)
                    blocked = recipe.blockingCells.some(([cx, cy]) => cx === x && cy === y);
                tileset.passability[tile] = { up: !blocked, down: !blocked, left: !blocked, right: !blocked };
                tileset.tileMeta![tile].passage = blocked ? 'solid' : 'passable';
            }
    }
    for (const recipe of fixedLooseRecipes(pack)) {
        const example = looseExample(recipe), incorrect = structuredClone(example), r = recipe.outputRect!, q = recipe.pixelRect;
        const occupied = example.upperTiles.map((tile, index) => ({ tile, index })).filter(({ tile }) => { if (tile < 0)
            return false; const p = atlas.ctx.getImageData(tile % 8 * 32, Math.floor(tile / 8) * 32, 32, 32).data; return p.some((v, i) => i % 4 === 3 && v > 0); });
        const removed = occupied.at(-1);
        if (!removed)
            throw Error('빈 객체');
        incorrect.upperTiles[removed.index] = -1;
        incorrect.upperTiles[example.approach.y * example.width + example.approach.x] = occupied[0].tile;
        const errors = example.upperTiles.flatMap((v, i) => v === incorrect.upperTiles[i] ? [] : [{ code: i === example.approach.y * example.width + example.approach.x ? 'APPROACH_OCCUPIED' : 'OBJECT_CELL', x: i % example.width, y: Math.floor(i / example.width) }]);
        const good = render(atlas.image, example), bad = render(atlas.image, incorrect), comparison = canvas(good.width * 2 + 8, good.height);
        comparison.ctx.drawImage(good, 0, 0);
        comparison.ctx.drawImage(bad, good.width + 8, 0);
        const crop = canvas(q.width, q.height);
        crop.ctx.drawImage(source.image, q.x, q.y, q.width, q.height, 0, 0, q.width, q.height);
        const sourceImage = { id: `${recipe.id}-source`, name: `${recipe.id}-source.png`, caption: `${recipe.name} · 원본 전체 픽셀 사각`, dataUrl: crop.image.toDataURL() }, exampleImage = { id: `${recipe.id}-example`, name: `${recipe.id}-example.png`, caption: '왼쪽 정상 전체객체/받침, 오른쪽 조각삭제/접근칸침범. 방이나게임맵이아닌고정조립표본.', dataUrl: comparison.image.toDataURL() };
        refs.images.push(sourceImage, exampleImage);
        const doc = { id: recipe.id, name: `${recipe.name}.md`, markdown: `# ${recipe.name}\n\n${recipe.notes}\n\n종류:${recipe.placementKind},방향:${recipe.facing},충돌:${recipe.collision}. 실제출력tilesetId:${tileset.id}.\n\n하위전체→상위전체 순서의 학습예제다. 실제오브젝트스탬프는외곽바닥을제외한${r.width}×${r.height}전체상위이며하위-1로기존바닥/벽을보존한다. ${recipe.placementKind === 'surface' ? '상판은이미합성되어있다.' : '원본크기불변, pixelOffset만큼여백에위치한다.'} 대상 상위 영역을 먼저 비운다. 투명 칸도 전체 배열에 포함되므로 기존 상위 가구와 겹쳐 찍지 않는다. 반복/좌우반전/이벤트 자동생성 없음.\n\n\`\`\`json\n${JSON.stringify({ recipe, expected: example, incorrect, errors }, null, 2)}\n\`\`\`\n\n![원본 전체 객체](image:${sourceImage.id})\n\n![정상/오류](image:${exampleImage.id})` };
        refs.documents.push(doc);
        const kit = tileset.structureKits!.find(k => k.id === recipe.id)!;
        kit.referenceDocuments = [{ ...refs, documents: [refs.documents[0], doc], images: [sourceImage, exampleImage] }];
        validateTilesetReferences(kit.referenceDocuments);
    }
    rawTileset.referenceDocuments = [raw];
    validateTilesetReferences([raw]);
    tileset.referenceDocuments = [refs];
    validateTilesetReferences([refs]);
    const prepared = [{ assetId: sourceId, dataUrl: source.image.toDataURL(), tileset: rawTileset, imageWidth: pack.width, imageHeight: pack.height, filename: pack.filename }];
    if (fixedLooseRecipes(pack).length)
        prepared.push({ assetId: atlasId, dataUrl: atlas.image.toDataURL(), tileset, imageWidth: pack.atlas.width, imageHeight: pack.atlas.height, filename: `${pack.id}-objects.png` });
    return { packId: pack.id, sourceSha256: pack.sha256, supportSha256: support.sha256, prepared, coverage: pack.coverage, holds: pack.holds, sourceOnlyRecipeIds: pack.recipes.filter(r => r.supportStatus === 'source-only').map(r => r.id) };
}
export async function importPixelArtWorldLoose(file: File, pack: LoosePack, supportFile: File, signal?: AbortSignal) {
    const lineage = store.getVersionToken().lineage, repository = projectRepository(), target = JSON.stringify(repository.currentTarget());
    const ensure = () => { if (signal?.aborted || lineage !== store.getVersionToken().lineage || JSON.stringify(repository.currentTarget()) !== target)
        throw Error('프로젝트가 바뀌었거나 가져오기가 취소되었습니다.'); };
    ensure();
    const value = await preparePixelArtWorldLoose(file, pack, supportFile);
    ensure();
    const assets = [];
    for (const p of value.prepared) {
        assets.push(await uploadedAssetForImport({ repository, id: p.assetId, name: p.filename, kind: 'chipset', dataUrl: p.dataUrl, meta: { tileSize: p.tileset.tileSize, frameWidth: p.tileset.tileSize, frameHeight: p.tileset.tileSize, width: p.imageWidth, height: p.imageHeight, frames: p.tileset.count } }));
        ensure();
    }
    recordProjectSnapshot();
    store.update(project => { value.prepared.forEach((p, i) => { project.assets.uploaded[assets[i].id] = assets[i]; project.tilesets[p.tileset.id] = p.tileset; project.resourceProfiles.push({ kind: 'chipset', name: p.tileset.name, tileWidth: p.tileset.tileSize, tileHeight: p.tileset.tileSize, imageWidth: p.imageWidth, imageHeight: p.imageHeight, assetId: p.assetId }); }); });
    return value.prepared.at(-1)!.tileset.id;
}
