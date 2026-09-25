import layouts from '@/assets/pixelArtWorldRetrotownExteriorsLayout.json';
import { createExternalTileset, validateExternalTileScenes, type ExternalTilesetPack } from '@/project/externalTilesetCatalog';
import { inspectExternalTileGrounding } from '@/project/externalTileGrounding';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import type { StructureKitDef, TilesetDef } from '@/project/types';

type Example = { width: number; height: number; lowerTiles: number[]; upperTiles: number[] };
const assemblyRule = '건물은 벽과 기둥 밑동→지붕 윗마루/기와면→전면 처마→전체 문/창/간판 순서로 원본에서 합성한다. 상위 한 칸에 다른 조각을 찍어 벽을 삭제하지 않는다. roof/building-part 단독 비교는 전체 조각 경계 근거이며 독립 지상가구 승인이 아니다. 전체 건물 배열/그림을 함께 읽는다. 그림의 문과 노렌은 자동 전이/개폐가 아니다.';

/** Appends user-local whole assemblies; original 400 tiles remain at their native indices. */
export function appendPixelArtWorldRetrotownExteriors(
  pack: ExternalTilesetPack, source: HTMLImageElement, target: TilesetDef,
  references: (pack: ExternalTilesetPack, image: CanvasImageSource, url: string, id: string) => TilesetReferenceCategory,
  render: (image: CanvasImageSource, example: Example) => HTMLCanvasElement,
) {
  const layout = layouts.find(p => p.packId === pack.id);
  if (!layout) return null;
  if (pack.sha256 !== layout.sourceSha256 || source.width !== 256 || source.height !== 1600
    || target.count !== 400 || target.tilesPerRow !== 8 || target.tileSize !== 32) throw Error('레트로 외관 원본 판본 오류');
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = layout.imageHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.imageSmoothingEnabled = false; context.drawImage(source, 0, 0);
  for (const object of layout.composites) {
    for (const part of object.parts) {
      const r = part.sourceRect, o = part.offset;
      if (![r.x, r.y, r.width, r.height, o.x, o.y].every(Number.isInteger)
        || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x + r.width > 256 || r.y + r.height > 1600
        || o.x < 0 || o.y < 0 || o.x + r.width > object.canvas.width || o.y + r.height > object.canvas.height) {
        throw Error(`외관 합성 범위 오류: ${object.id}`);
      }
      context.drawImage(source, r.x, r.y, r.width, r.height, o.x, object.sourceRect.y * 32 + o.y, r.width, r.height);
    }
  }
  const effective: ExternalTilesetPack = { ...pack, height: canvas.height, recipes: layout.recipes, scenes: layout.scenes };
  validateExternalTileScenes(effective);
  const pixels = context.getImageData(0, 0, 256, canvas.height).data;
  for (const scene of effective.scenes!) {
    const issue = inspectExternalTileGrounding(effective, scene, pixels)[0];
    if (issue) throw Error(`${scene.id}/${issue.recipeId}: 밑동이 지면 받침과 다릅니다.`);
    for (const t of scene.lowerTiles) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (pixels[((Math.floor(t / 8) * 32 + y) * 256 + t % 8 * 32 + x) * 4 + 3] !== 255) throw Error('외관 지면 받침이 투명합니다.');
    }
  }
  if (target.image.type !== 'uploaded') throw Error('사용자 업로드 원본만 허용');
  const tileset = createExternalTileset(effective, target.image.id, target.id);
  const dataUrl = canvas.toDataURL('image/png');
  tileset.referenceDocuments = structuredClone(target.referenceDocuments ?? []);
  const compositeIds = new Set(layout.composites.map(c => c.id));
  const composed = references({ ...effective, recipes: effective.recipes.filter(r => compositeIds.has(r.id)) }, canvas, dataUrl, tileset.id);
  composed.id = 'paw-retrotown-assemblies'; composed.name = '목욕탕·상점 전체 지붕과 출입 전면';
  composed.documents = composed.documents.filter(d => compositeIds.has(d.id));
  composed.images = composed.images.filter(i => compositeIds.has(i.id));
  for (const doc of composed.documents) {
    const plan = layout.composites.find(c => c.id === doc.id)!;
    doc.markdown = `# ${plan.name}\n\n원본 ${pack.filename}, SHA256 ${pack.sha256}. parts.sourceRect/offset은 원본 픽셀, sourceRect/tiles는 400칸 뒤 파생 atlas의 32px 칸이다. 파생 행을 원본에서 자르지 않는다.\n\n${plan.notes}\n\n${assemblyRule}\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\n${doc.markdown.replaceAll('원본 source_rect', '파생 atlas source_rect').replace('원본 타일 배열', '파생 타일 배열')}`;
  }
  // The tile-aligned source rectangles contain separate loose stepping stones below these doors.
  // Show that rejected boundary explicitly instead of teaching the stone as part of a door frame.
  for (const plan of layout.composites.filter(c => c.id.endsWith('-shop-front') || c.id.endsWith('-paper-doors'))) {
    const sourceRect = plan.parts[0]!.sourceRect, w = plan.canvas.width, h = plan.canvas.height;
    const panelWidth = Math.max(w + 16, 128);
    const proof = document.createElement('canvas'); proof.width = panelWidth * 2; proof.height = h + 32;
    const ctx = proof.getContext('2d')!; ctx.fillStyle = '#536b70'; ctx.fillRect(0, 0, proof.width, proof.height);
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText('OK: FRAME', 8, 15); ctx.fillText('BAD: + STONE', panelWidth + 8, 15);
    ctx.drawImage(source, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, 8, 24, sourceRect.width, sourceRect.height);
    ctx.drawImage(source, sourceRect.x, sourceRect.y, sourceRect.width, h, panelWidth + 8, 24, sourceRect.width, h);
    const proofId = plan.id + '-bounds';
    composed.images.push({ id: proofId, name: proofId + '.png', caption: '왼쪽 전체 문틀 / 오른쪽 잘못된 3칸 사각: 분리된 디딤돌이 아래에 섞임.', dataUrl: proof.toDataURL('image/png') });
    composed.documents.find(d => d.id === plan.id)!.markdown += `\n\n## 원본 경계의 정상/오류\n\n왼쪽은 원본 전체 문틀 ${sourceRect.width}×${sourceRect.height}px, 오른쪽은 높이96px로 잘라 독립 돌까지 포함한 잘못된 사각이다. 전체 문틀의 발/문턱/기둥을 유지하고 돌은 다른 객체로 분리한다. 추가 캔버스만 투명 패딩하며 소스 알파를 지우지 않는다.\n\n![문틀 경계 정상/오류](image:${proofId})`;
  }
  tileset.referenceDocuments.push(composed);
  const raw = tileset.referenceDocuments.find(c => c.id === 'paw-furniture-pilot')!;
  raw.documents.find(d => d.id === 'read-first')!.markdown += `\n\n## 판본별 전체 객체 비교\n\n두 시트는 같은 색변형이 아니다. 목욕탕 입구/간판/굴뚝과 목조 상점 출입구/우편함은 다른 그림이다. 아래 rawRGBA SHA는 PNG파일 SHA와 다르다. Sento와 비교한 일치 여부에 투명 RGB도 포함한다.\n\n\`\`\`json\n${JSON.stringify(layout.sourceComparisons, null, 2)}\n\`\`\`\n\n${assemblyRule}\n\nST-Sento-I02의 탈의/욕실 내부는 향후 연결 후보다. 이 자료는 실내와 연결하는 이벤트나 런타임 전이를 만들지 않는다.`;
  const house = layout.composites.find(c => c.id.endsWith('-whole-building'))!;
  const image = document.createElement('canvas'); image.width = house.canvas.width; image.height = house.canvas.height;
  image.getContext('2d')!.drawImage(canvas, 0, house.sourceRect.y * 32, image.width, image.height, 0, 0, image.width, image.height);
  const supportImage = { id: 'whole-building-support', name: 'whole-building-support.png', caption: '전체 원본 결합: 지붕 마루/기와면/처마와 벽 기둥/문틀/밑동. 건물 전체는 정적 solid.', dataUrl: image.toDataURL('image/png') };
  raw.images.push(supportImage);
  for (const doc of raw.documents) {
    const recipe = effective.recipes.find(r => r.id === doc.id);
    if (recipe?.placementKind === 'building-part' || recipe?.placementKind === 'wall-mounted') {
      doc.markdown += `\n\n## 실제 건물 받침\n\n${assemblyRule}\n\n${recipe.placementKind === 'wall-mounted' ? '이 객체는 벽/지붕 받침에 부착한다. 예제의 목재 벽은 받침이며 지상 보도가 아니다.' : '이것은 건물 구성품이다. 단독 정상/오류 그림은 잘림/배열 경계를 비교하며 지상 독립 배치를 승인하지 않는다.'}\n\n![전체 건물](image:whole-building-support)`;
    }
  }
  tileset.structureKits = effective.recipes.map((r): StructureKitDef => {
    const evidence = tileset.referenceDocuments!.find(c => c.documents.some(d => d.id === r.id));
    if (!evidence) throw Error('객체 소유 문서 누락');
    const { width, height } = r.sourceRect;
    const rules = `${r.placementKind}. 상위 고정 전체 배열; 받침 ${JSON.stringify(r.supportCells)}. ${r.facing} 쪽 빈 접근칸. ${r.placementKind === 'building-part' || r.placementKind === 'wall-mounted' || r.id.endsWith('-whole-building') ? assemblyRule : '전체 밑동은 지면에 놓는다. 그림은 자동 상호작용을 만들지 않는다.'}`;
    return {
      id: r.id, kind: 'section', name: r.name, width, height, tileSize: 32,
      rows: r.tiles.map(row => ({ tiles: Array<number>(width).fill(-1), upperTiles: [...row] })), learnedFrom: 'db-authored',
      ai: { description: r.name, placementRules: rules, repeatability: 'fixed', layerHome: 'upper', origin: 'ai' },
      referenceDocuments: [{ id: 'whole-object', name: r.name, description: '전체 원본 경계·배열·받침·정상/오류 그림.',
        documents: [{ id: 'assembly', name: '전체배열.md', markdown: `# ${r.name}\n\n현재 tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}.\n\n${rules}\n\n\`\`\`json\n${JSON.stringify({ width, height, sourceRect: r.sourceRect, lowerTiles: Array(width * height).fill(-1), upperTiles: r.tiles.flat(), supportCells: r.supportCells }, null, 2)}\n\`\`\`` }, ...evidence.documents.filter(d => d.id === r.id)],
        images: [...evidence.images.filter(i => i.id === r.id || i.id === r.id + '-bounds'), ...(r.placementKind === 'building-part' || r.placementKind === 'wall-mounted' ? [supportImage] : [])],
      }],
    };
  });
  for (const scene of effective.scenes!) tileset.referenceDocuments.push({
    id: `scene-${scene.id}`, name: scene.name, description: '정적 전체 건물과 문 앞 짧은 보도.',
    documents: [{ id: 'layout', name: scene.name + '.md', markdown: `# ${scene.name}\n\n현재 tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}.\n\n${scene.notes}\n\n전체 lower 후 upper. approachCells는 빈 보도이며 전이 이벤트가 아니다. ST-Sento-I02 연결 후보는 미실행이다.\n\n\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\`\n\n![실제 전체 장면](image:assembled-scene)` }],
    images: [{ id: 'assembled-scene', name: scene.id + '.png', caption: scene.name, dataUrl: render(canvas, scene).toDataURL('image/png') }],
  });
  validateTilesetReferences(tileset.referenceDocuments);
  return { tileset, dataUrl, imageWidth: 256, imageHeight: canvas.height };
}
