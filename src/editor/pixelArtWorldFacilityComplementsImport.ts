import { createFacilityComplementTileset, facilityComplementExample, type FacilityComplementPack, type FacilityComplementPart } from '@/project/pixelArtWorldFacilityComplements';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import { sha256HexBytes } from '@/util/sha256';
import { genId } from '@/util/id';
import { projectRepository } from '@/project/persistence/repository';
import { store } from '@/project/store';
import { recordProjectSnapshot } from '@/editor/mapEditHistory';
import { uploadedAssetForImport } from '@/editor/uploadedAssetStorage';
function canvas(w: number, h: number) { const image = document.createElement('canvas'); image.width = w; image.height = h; const ctx = image.getContext('2d'); if (!ctx)
    throw Error('이미지 캔버스를 만들지 못했습니다.'); ctx.imageSmoothingEnabled = false; return { image, ctx }; }
function render(atlas: HTMLCanvasElement, m: {
    width: number;
    height: number;
    lowerTiles: number[];
    upperTiles: number[];
}) { const c = canvas(m.width * 32, m.height * 32); for (const a of [m.lowerTiles, m.upperTiles])
    a.forEach((t, i) => { if (t >= 0)
        c.ctx.drawImage(atlas, t % 8 * 32, Math.floor(t / 8) * 32, 32, 32, i % m.width * 32, Math.floor(i / m.width) * 32, 32, 32); }); return c.image; }
function pair(a: HTMLCanvasElement, b: HTMLCanvasElement) { const c = canvas(a.width + b.width + 8, Math.max(a.height, b.height)); c.ctx.drawImage(a, 0, 0); c.ctx.drawImage(b, a.width + 8, 0); return c.image.toDataURL(); }
/** Exact local user sources. Pure preparation; no network/store/DB writes. */
export async function preparePixelArtWorldFacilityComplements(files: File[], pack: FacilityComplementPack) {
    const originals = new Map<string, HTMLCanvasElement>(), sourceHashes: Record<string, string> = {};
    for (const s of pack.sources) {
        const f = files.find(f => f.name === s.filename);
        if (!f)
            throw Error(`${s.filename} 원본을 함께 선택하세요.`);
        if (f.size > 4000000 || await sha256HexBytes(new Uint8Array(await f.arrayBuffer())) !== s.sha256)
            throw Error(`${s.filename}의 확인된 원본과 다릅니다.`);
        const url = URL.createObjectURL(f), im = new Image();
        try {
            im.src = url;
            await im.decode();
        }
        finally {
            URL.revokeObjectURL(url);
        }
        if (im.naturalWidth !== s.width || im.naturalHeight !== s.height)
            throw Error('원본 규격 불일치');
        const c = canvas(s.width, s.height);
        c.ctx.drawImage(im, 0, 0);
        originals.set(s.id, c.image);
        sourceHashes[s.filename] = s.sha256;
    }
    const compose = (parts: FacilityComplementPart[], w: number, h: number) => { const c = canvas(w, h); for (const p of parts) {
        const r = p.sourceRect, o = p.target;
        if (p.mode === 'replace')
            c.ctx.clearRect(o.x, o.y, r.width, r.height);
        c.ctx.drawImage(originals.get(p.sourceId)!, r.x, r.y, r.width, r.height, o.x, o.y, r.width, r.height);
    } return c.image; };
    const atlas = canvas(pack.atlas.width, pack.atlas.height);
    for (const p of pack.palette)
        atlas.ctx.drawImage(compose([p.part], 32, 32), p.tile % 8 * 32, Math.floor(p.tile / 8) * 32);
    const assembled = new Map<string, HTMLCanvasElement>();
    for (const r of pack.recipes) {
        const image = compose(r.parts, r.width, r.height);
        assembled.set(r.id, image);
        atlas.ctx.drawImage(image, r.outputRect.x * 32, r.outputRect.y * 32);
    }
    const assetId = genId('chipset_img'), tileset = createFacilityComplementTileset(pack, assetId, genId('ts'));
    const first = `# ${pack.name} · 전체 조립 보충\n\n기존 소품 atlas의 번호·그림·문서를 변경하지 않는 시설 보완 독립 atlas다. 타일셋:${tileset.id},32px·8열. whole sourceRect/bbox와32px패딩을 보존한다. 아래 원본 픽셀을 크기변경하지 않고 sourceParts 순서로 먼저 합성한 뒤 전체 배열로 사용한다. sourceRect/target/anchor는 픽셀, outputRect/supportCells/blockingCells는32px칸이다.\n\n[제작자](${pack.sourcePage}) · [규약](${pack.termsUrl}) · ${pack.credit}. 소재/파생 소재 재배포 금지. 공개 게임에 크레딧.\n\n${pack.sources.map(s => `${s.filename} ${s.width}×${s.height}px SHA-256:${s.sha256} [출처](${s.sourcePage})`).join('\n\n')}\n\n하위 받침→전체 상위 객체 순서로 배치한다. standing은 실제 밑동을 바닥에, wall-mounted 창은 전체를 벽에 둔다. wall-floor-composite 주방은 상부장 뒤 벽과 싱크/레인지 밑동의 바닥을 함께 보존한다. 불투명 그림자와 반투명 상판을 통행 기준으로 추정하지 않는다. 각sourcePart를 상위 타일에 하나씩 겹쳐 찍으면 이전 조각이 지워진다. 파트의 base/back/front는 합성 순서이며 엔진에3개의맵레이어를 추가한다는 뜻이 아니다. 고정점/방향/충돌/받침은 별개다. 빈 상위 영역에 전체kit를 사용하고 하위-1로 기존 바닥을 보존한다. sourceParts의replace는 기존 상태 그림자를 지운 뒤 새 상태를 붙인다.\n\n완전 해결한 고정 조합:${pack.coverage.resolved.join('; ')}. 여전히보류:${pack.coverage.remaining.join('; ')}. 이5개예시는 완성 시설/도로/플레이공간이 아닌 방향·지지 조립 표본이다. 모든 상태는 정적이며 애니메이션/fps/출입/착석/상호작용 이벤트를 생성하지 않는다.\n\n정본선행읽기:프로젝트6ae74f7a-23a2-449b-8171-5afb5dff532b revision54의사무실/주택/목조학교/체육관/아이스크림/상가 원본·받침문서. 제작자 각 시설 페이지의 별도 보완 설명과 실제5원본을 직접 검토했다.`;
    const sources = pack.sources.map(s => ({ id: 'source-' + s.id, name: s.filename, caption: `사용자 원본 전체 ${s.width}×${s.height} / SHA:${s.sha256}`, dataUrl: originals.get(s.id)!.toDataURL() }));
    const refs: TilesetReferenceCategory = { id: 'paw-facility-assemblies', name: '원본·완전 조립·정상과 오류', description: '수동 sourceParts·고정점·앞뒤·전체 배열. 독립 보충 atlas.', documents: [{ id: 'read-first', name: '원본·범위 먼저 읽기.md', markdown: first }], images: [...sources] };
    const hasPixels = (t: number) => atlas.ctx.getImageData(t % 8 * 32, Math.floor(t / 8) * 32, 32, 32).data.some((v, i) => i % 4 === 3 && v > 0);
    for (const r of pack.recipes) {
        const expected = facilityComplementExample(r), incorrect = structuredClone(expected), indices = expected.upperTiles.map((v, i) => ({ v, i })).filter(a => a.v >= 0 && hasPixels(a.v));
        const errorIndex = (r.errorCell[1] + 1) * expected.width + r.errorCell[0] + 1;
        const removed = indices.find(c => c.i === errorIndex);
        if (!removed)
            throw Error('빈 조립');
        incorrect.upperTiles[removed.i] = -1;
        const errors = [{ code: 'OBJECT_CELL_MISSING', x: removed.i % expected.width, y: Math.floor(removed.i / expected.width) }];
        const a = assembled.get(r.id)!, b = compose(r.counterexampleParts, r.width, r.height);
        const stageImage = { id: r.id + '-parts', name: r.id + '-composition.png', caption: '왼쪽 완성 합성 / 오른쪽 실제 잘못된 sourceParts 순서·누락·고정점. 투명 배경.', dataUrl: pair(a, b) };
        const arrayImage = { id: r.id + '-arrays', name: r.id + '-arrays.png', caption: '왼쪽 정상 전체 배열 / 오른쪽 지정된 조각 삭제 오류. 실제 하위 받침 포함.', dataUrl: pair(render(atlas.image, expected), render(atlas.image, incorrect)) };
        const doc = { id: r.id, name: r.name + '.md', markdown: `# ${r.name}\n\n${r.notes}\n\n실제tilesetId:${tileset.id}. 방향:${r.facing}. 상위 전체 객체 ${r.outputRect.width}×${r.outputRect.height}, 하위 전체-1. 설치:${r.placementKind}. 예제 벽 행 수:${r.wallRowsForExample ?? 0}. 지지칸:${JSON.stringify(r.supportCells)}, 차단칸:${JSON.stringify(r.blockingCells)}. 지정 접근:${JSON.stringify(expected.approach)}. 조각번호는 이 독립atlas 전용이다.\n\n## 조립 순서·고정점·전체 배열\n\n\`\`\`json\n${JSON.stringify({ recipe: r, expected, incorrect, errors }, null, 2)}\n\`\`\`\n\n![원본 조합 정상/반례](image:${stageImage.id})\n\n![전체 배열 정상/오류](image:${arrayImage.id})` };
        refs.documents.push(doc);
        refs.images.push(stageImage, arrayImage);
        const kit = tileset.structureKits!.find(k => k.id === r.id)!;
        kit.referenceDocuments = [{ ...refs, documents: [refs.documents[0], doc], images: [...sources, stageImage, arrayImage] }];
        validateTilesetReferences(kit.referenceDocuments);
    }
    const s = pack.scene, bad = structuredClone(s), entry = s.entry.y * s.width + s.entry.x, solid = pack.recipes.flatMap(r => r.upperRows.flat()).find(t => t >= 0 && !tileset.passability[t].down && hasPixels(t));
    if (solid === undefined)
        throw Error('차단 표본 없음');
    bad.upperTiles[entry] = solid;
    const sceneImage = { id: 'assembled-scene', name: s.id + '.png', caption: `${s.width}×${s.height} 정적 조립 표본 전체. 실행 이벤트 없음.`, dataUrl: render(atlas.image, s).toDataURL() }, sceneError = { id: 'scene-errors', name: s.id + '-errors.png', caption: '왼쪽 정상 / 오른쪽 출입 접근을 막은 실제 오류.', dataUrl: pair(render(atlas.image, s), render(atlas.image, bad)) };
    const sceneRefs: TilesetReferenceCategory = { id: 'scene-' + s.id, name: s.name, description: '작은 실제 받침 조립·방/출입구/동선·전체 배열. 실행 게임맵이 아님.', documents: [{ id: 'read-first', name: '원본·범위 먼저 읽기.md', markdown: first }, { id: 'layout', name: s.name + '.md', markdown: `# ${s.name}\n\n${s.notes}\n\n실제tilesetId:${tileset.id}. 하위 전체→상위 전체 순서. entry부터approachCells까지 연결을 확인했다. rooms/doorways는 공간구조이며 events는빈배열이다. 맵전이·앉기·문개폐 기능을 뜻하지 않는다.\n\n\`\`\`json\n${JSON.stringify({ expected: s, incorrect: bad, errors: [{ code: 'ENTRY_BLOCKED', ...s.entry }] }, null, 2)}\n\`\`\`\n\n![조립 표본 전체](image:assembled-scene)\n\n![정상/오류](image:scene-errors)` }], images: [...sources, sceneImage, sceneError] };
    tileset.referenceDocuments = [refs, sceneRefs];
    tileset.structureKits!.find(k => k.id === s.id)!.referenceDocuments = [sceneRefs];
    validateTilesetReferences(tileset.referenceDocuments);
    validateTilesetReferences([sceneRefs]);
    return { packId: pack.id, sourceHashes, prepared: [{ assetId, dataUrl: atlas.image.toDataURL(), tileset, imageWidth: pack.atlas.width, imageHeight: pack.atlas.height, filename: pack.id + '-atlas.png' }], scenes: [s], coverage: pack.coverage, originalCatalogMutation: false };
}
export async function importPixelArtWorldFacilityComplements(files: File[], pack: FacilityComplementPack, signal?: AbortSignal) {
    const lineage = store.getVersionToken().lineage, repository = projectRepository(), target = JSON.stringify(repository.currentTarget()), ensure = () => { if (signal?.aborted || lineage !== store.getVersionToken().lineage || target !== JSON.stringify(repository.currentTarget()))
        throw Error('프로젝트가 바뀌었거나 가져오기가 취소되었습니다.'); };
    ensure();
    const result = await preparePixelArtWorldFacilityComplements(files, pack);
    ensure();
    const p = result.prepared[0], asset = await uploadedAssetForImport({ repository, id: p.assetId, name: p.filename, kind: 'chipset', dataUrl: p.dataUrl, meta: { tileSize: 32, frameWidth: 32, frameHeight: 32, width: p.imageWidth, height: p.imageHeight, frames: p.tileset.count } });
    ensure();
    recordProjectSnapshot();
    store.update(project => { project.assets.uploaded[asset.id] = asset; project.tilesets[p.tileset.id] = p.tileset; project.resourceProfiles.push({ kind: 'chipset', name: p.tileset.name, tileWidth: 32, tileHeight: 32, imageWidth: p.imageWidth, imageHeight: p.imageHeight, assetId: asset.id }); }, { scope: 'project', label: '시설 보완 원본 가져오기', origin: 'human' });
    return p.tileset.id;
}
