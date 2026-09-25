import layouts from '@/assets/pixelArtWorldJapaneseInteriorsLayout.json';
import { createExternalTileset, validateExternalTileScenes, type ExternalTilesetPack } from '@/project/externalTilesetCatalog';
import { inspectExternalTileGrounding } from '@/project/externalTileGrounding';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import type { StructureKitDef, TilesetDef } from '@/project/types';

type Example = { width: number; height: number; lowerTiles: number[]; upperTiles: number[] };
/** Exact user-local source-over assembly. Original 400 tile indices and pixels remain unchanged. */
export function appendPixelArtWorldJapaneseInteriors(pack: ExternalTilesetPack, source: HTMLImageElement, target: TilesetDef,
  references: (pack: ExternalTilesetPack, image: CanvasImageSource, url: string, id: string) => TilesetReferenceCategory,
  render: (image: CanvasImageSource, example: Example) => HTMLCanvasElement) {
  const layout = layouts.find(p => p.packId === pack.id);
  if (!layout) return null;
  if (pack.sha256 !== layout.sourceSha256 || source.width !== 256 || source.height !== 1600 || target.count !== 400 || target.tilesPerRow !== 8 || target.tileSize !== 32) throw Error('일본식 실내 원본 판본이 다릅니다.');
  const canvas = document.createElement('canvas'); canvas.width = layout.imageWidth; canvas.height = layout.imageHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true })!; context.imageSmoothingEnabled = false; context.drawImage(source, 0, 0);
  for (const object of layout.composites) {
    for (const part of object.parts) {
      const r = part.sourceRect, o = part.offset;
      if (![r.x,r.y,r.width,r.height,o.x,o.y].every(Number.isInteger) || r.x<0 || r.y<0 || r.width<1 || r.height<1 || r.x+r.width>source.width || r.y+r.height>source.height || o.x<0 || o.y<0 || o.x+r.width>object.canvas.width || o.y+r.height>object.canvas.height) throw Error('일본식 실내 합성 범위 오류');
      context.drawImage(source, r.x, r.y, r.width, r.height, o.x, object.sourceRect.y*32+o.y, r.width, r.height);
    }
  }
  const effective: ExternalTilesetPack = { ...pack, height: canvas.height, recipes: layout.recipes, scenes: layout.scenes };
  validateExternalTileScenes(effective);
  const pixels = context.getImageData(0,0,canvas.width,canvas.height).data;
  for (const scene of effective.scenes!) {
    const issue = inspectExternalTileGrounding(effective, scene, pixels)[0];
    if (issue) throw Error(`${scene.id}: ${issue.recipeId} 밑동이 바닥에 닿지 않습니다 (${issue.x},${issue.y}).`);
    for (let i=0;i<scene.lowerTiles.length;i++) {
      const t=scene.lowerTiles[i]!;
      for(let y=0;y<32;y++) for(let x=0;x<32;x++) if(pixels[((Math.floor(t/8)*32+y)*256+t%8*32+x)*4+3]!==255) throw Error(`${scene.id}: 투명한 하위 받침 ${t}`);
    }
  }
  const tileset = createExternalTileset(effective, target.image.type === 'uploaded' ? target.image.id : (() => { throw Error('업로드 원본만 허용'); })(), target.id);
  tileset.referenceDocuments = structuredClone(target.referenceDocuments ?? []);
  const dataUrl = canvas.toDataURL('image/png');
  if(layout.composites.length) {
    const compositeIds = new Set(layout.composites.map(c=>c.id));
    const category = references({...effective,recipes:effective.recipes.filter(r=>compositeIds.has(r.id))},canvas,dataUrl,target.id);
    category.id='paw-japanese-composites'; category.name='부스·좌식석 전체 픽셀 조립';
    category.documents=category.documents.filter(d=>compositeIds.has(d.id)); category.images=category.images.filter(i=>compositeIds.has(i.id));
    for(const doc of category.documents) {
      const c=layout.composites.find(c=>c.id===doc.id)!;
      doc.markdown=`# 원본 3층을 사용자 로컬에서 조립\n\n원본 ${pack.filename}, SHA256 ${pack.sha256}. 아래 parts는 원본 픽셀 좌표이며 sourceRect/tiles는 원본 400칸 다음에 붙인 파생 아틀라스 칸이다. 원본에서 파생 행 좌표를 자르면 안 된다. source-over 순서대로, 무회전·무반전·무리사이즈.\n\n${c.notes}\n\n\`\`\`json\n${JSON.stringify(c,null,2)}\n\`\`\`\n\n${doc.markdown.replaceAll('원본 source_rect','파생 아틀라스 source_rect').replace('원본 타일 배열','파생 타일 배열')}`;
    }
    tileset.referenceDocuments.push(category);
  }
  tileset.structureKits=effective.recipes.map((r):StructureKitDef=>{
    const category=tileset.referenceDocuments!.find(c=>c.documents.some(d=>d.id===r.id));
    if(!category) throw Error(`객체 문서 누락 ${r.id}`);
    const {width,height}=r.sourceRect;
    return {id:r.id,kind:'section',name:r.name,width,height,tileSize:32,rows:r.tiles.map(row=>({tiles:Array<number>(width).fill(-1),upperTiles:[...row]})),learnedFrom:'db-authored',
      ai:{description:r.name,placementRules:`전체 고정 배열. ${r.placementKind}; 지지칸 ${JSON.stringify(r.supportCells)}. ${r.facing} 접근을 비운다. 합성은 아틀라스에 이미 포함되므로 추가 upper로 덮지 않는다. 내부 착석/문 이벤트 없음.`,repeatability:'fixed',layerHome:'upper',origin:'ai'},
      referenceDocuments:[{id:'whole-object',name:r.name,description:'원본 판본·전체 배열·받침·방향과 정상/오류 그림.',documents:[{id:'assembly',name:'전체 객체 배열.md',markdown:`# ${r.name}\n\n현재 tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}. ${r.placementKind}, ${r.facing}. 0기준 좌상단, -1은 기존 바닥 보존. 파생 여부와 픽셀 조립은 함께 실린 근거 문서를 따른다.\n\n\`\`\`json\n${JSON.stringify({width,height,sourceRect:r.sourceRect,supportCells:r.supportCells,lowerTiles:Array(width*height).fill(-1),upperTiles:r.tiles.flat()},null,2)}\n\`\`\``},...category.documents.filter(d=>d.id===r.id)],images:category.images.filter(i=>i.id===r.id)}]};
  });
  for(const scene of effective.scenes!) tileset.referenceDocuments.push({id:`scene-${scene.id}`,name:scene.name,description:'전체 두 레이어·객체 배치·접근 좌표·방 역할.',documents:[{id:'layout',name:scene.name+'.md',markdown:`# ${scene.name}\n\n현재 tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}.\n\n${scene.notes}\n\n하위 전체 배열 후 상위 전체 배열을 배치한다. -1은 빈 칸. 상위 객체 사각형은 solid다. 접근칸은 통행용이며 수면·식사·쇼지/문 이벤트는 별도로 저작한다. 파생 타일은 원본400칸 뒤에 추가했다.\n\n\`\`\`json\n${JSON.stringify(scene,null,2)}\n\`\`\`\n\n![전체 조립](image:assembled-scene)`}],images:[{id:'assembled-scene',name:scene.id+'.png',caption:scene.name+' · 사용자 원본 전체 조각으로 조립.',dataUrl:render(canvas,scene).toDataURL('image/png')}]});
  validateTilesetReferences(tileset.referenceDocuments);
  return {tileset,dataUrl,imageWidth:canvas.width,imageHeight:canvas.height};
}
