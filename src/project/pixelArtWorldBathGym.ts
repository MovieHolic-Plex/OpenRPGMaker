import type { StructureKitDef, TilesetDef } from './types';
import type { ExternalTilesetPack } from './externalTilesetCatalog';

/** New packs expose object-level AI documents at import time, not only after local publication. */
export function attachPixelArtWorldBathGymObjects(pack: ExternalTilesetPack, tileset: TilesetDef): void {
  if (pack.id !== 'paw-home-bath' && pack.id !== 'paw-school-gym') return;
  const evidence = tileset.referenceDocuments?.find(category => category.id === 'paw-furniture-pilot');
  if (!evidence) throw new Error('욕실·체육관 원본 조립 문서가 없습니다.');
  tileset.structureKits = pack.recipes.map((recipe): StructureKitDef => {
    const documents = evidence.documents.filter(document => document.id === recipe.id);
    const images = evidence.images.filter(image => image.id === recipe.id);
    if (documents.length !== 1 || images.length !== 1) throw new Error(`완전체 근거가 없습니다: ${recipe.id}`);
    const { width, height } = recipe.sourceRect;
    const rules = `원본 ${pack.filename}, SHA256 ${pack.sha256}, sourceRect(32px 칸) ${JSON.stringify(recipe.sourceRect)}. 전체 배열을 상위에 배치하고 기존 받침을 보존한다. ${recipe.placementKind} 지지칸 ${JSON.stringify(recipe.supportCells)}. ${recipe.facing} 접근칸을 비운다. 자르기·반전·늘이기와 자동 문/스포츠 이벤트 추정 금지.`;
    return {
      id: recipe.id, kind: 'section', name: recipe.name, width, height, tileSize: 32,
      rows: recipe.tiles.map(row => ({ tiles: Array<number>(width).fill(-1), upperTiles: [...row] })),
      learnedFrom: 'db-authored',
      ai: { description: recipe.name, placementRules: rules, repeatability: 'fixed', layerHome: 'upper', origin: 'ai', tags: ['Pixel Art World', '원본32px', '사용자 다운로드'] },
      referenceDocuments: [{
        id: 'whole-object', name: recipe.name, description: '원본 전체 조각·받침·방향 및 실제 정상/오류 그림.',
        documents: [{ id: 'assembly', name: '전체 객체 배열.md', markdown: `# ${recipe.name}\n\n${rules}\n\n현재 tilesetId: ${tileset.id}. 0기준 좌상단, -1은 기존 받침 보존.\n\n\`\`\`json\n${JSON.stringify({ width, height, lowerTiles: Array(width * height).fill(-1), upperTiles: recipe.tiles.flat() }, null, 2)}\n\`\`\`` }, ...documents],
        images: [...images],
      }],
    };
  });
}
