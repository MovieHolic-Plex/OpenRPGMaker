import layouts from '@/assets/pixelArtWorldMansionInteriorsLayout.json';
import { createExternalTileset, validateExternalTileScenes, type ExternalTilesetPack } from '@/project/externalTilesetCatalog';
import { inspectExternalTileGrounding } from '@/project/externalTileGrounding';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import type { StructureKitDef, TilesetDef } from '@/project/types';

type Example = { width: number; height: number; lowerTiles: number[]; upperTiles: number[] };
/** Exact user-local source-over assembly. Original 440 tile indices and pixels remain unchanged. */
export function appendPixelArtWorldMansionInteriors(pack: ExternalTilesetPack, source: HTMLImageElement, target: TilesetDef,
  references: (pack: ExternalTilesetPack, image: CanvasImageSource, url: string, id: string) => TilesetReferenceCategory,
  render: (image: CanvasImageSource, example: Example) => HTMLCanvasElement) {
  const layout = layouts.find(p => p.packId === pack.id);
  if (!layout) return null;
  if (pack.sha256 !== layout.sourceSha256 || source.width !== 256 || source.height !== 1760 || target.count !== 440 || target.tilesPerRow !== 8 || target.tileSize !== 32) throw Error('저택 실내 원본 판본이 다릅니다.');
  const canvas = document.createElement('canvas'); canvas.width = layout.imageWidth; canvas.height = layout.imageHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true })!; context.imageSmoothingEnabled = false; context.drawImage(source, 0, 0);
  const rawCanvas=document.createElement('canvas');rawCanvas.width=256;rawCanvas.height=1760;rawCanvas.getContext('2d')!.drawImage(source,0,0);
  const sourcePixels=rawCanvas.getContext('2d')!.getImageData(0,0,256,1760).data;
  const alpha=(x:number,y:number)=>sourcePixels[(y*256+x)*4+3]!;
  for (const object of layout.composites) {
    const base=object.parts[0]!;
    for(const overlay of object.parts.slice(1)) {
      const r=overlay.sourceRect,o=overlay.offset;let bottom=-1;
      for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(alpha(r.x+x,r.y+y))bottom=y;
      if(bottom<0)throw Error('빈 상판 소품');
      for(let y=Math.max(0,bottom-1);y<=bottom;y++)for(let x=0;x<r.width;x++)if(alpha(r.x+x,r.y+y)) {
        const bx=o.x+x,by=o.y+y;
        if(by<16||by>32||alpha(base.sourceRect.x+bx,base.sourceRect.y+by)!==255)throw Error('소품 밑동이 검토 상판 밖입니다.');
      }
    }
    for (const part of object.parts) {
      const r = part.sourceRect, o = part.offset;
      if (![r.x,r.y,r.width,r.height,o.x,o.y].every(Number.isInteger) || r.x<0 || r.y<0 || r.width<1 || r.height<1 || r.x+r.width>source.width || r.y+r.height>source.height || o.x<0 || o.y<0 || o.x+r.width>object.canvas.width || o.y+r.height>object.canvas.height) throw Error('저택 실내 합성 범위 오류');
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
    category.id='paw-mansion-composites'; category.name='저택 상판 전체 픽셀 조립';
    category.documents=category.documents.filter(d=>compositeIds.has(d.id)); category.images=category.images.filter(i=>compositeIds.has(i.id));
    for(const doc of category.documents) {
      const c=layout.composites.find(c=>c.id===doc.id)!;
      doc.markdown=`# 원본 전체 물체를 사용자 로컬에서 조립\n\n원본 ${pack.filename}, SHA256 ${pack.sha256}. 아래 parts는 원본 픽셀 좌표이며 sourceRect/tiles는 원본 440칸 다음에 붙인 파생 아틀라스 칸이다. 원본에서 파생 행 좌표를 자르면 안 된다. source-over 순서대로, 무회전·무반전·무리사이즈.\n\n${c.notes}\n\n\`\`\`json\n${JSON.stringify(c,null,2)}\n\`\`\`\n\n${doc.markdown.replaceAll('원본 source_rect','파생 아틀라스 source_rect').replace('원본 타일 배열','파생 타일 배열')}`;
    }
    tileset.referenceDocuments.push(category);
  }
  const rawReferences = tileset.referenceDocuments.find(c=>c.id==='paw-furniture-pilot')!;
  rawReferences.documents.find(d=>d.id==='read-first')!.markdown += `\n\n## 다섯 판본의 실제 객체 비교\n\nB/P/Y/W/R을 색만 교체한 시트로 취급하지 않는다. P 인형/Y 소파/W·R 침구와 그림/R 보석상은 별도다. 아래 SHA는 sourceRect rawRGBA 바이트 SHA이고 원본PNG SHA와 다른 값이다. 투명RGB 차이도 포함하므로 RGBA불일치가 곧 눈에 보이는 모양차이는 아니다. 알파까지 비교했으며 모든 객체는 이 판본 원본에서 직접 자른다.\n\n\`\`\`json\n${JSON.stringify(layout.sourceComparisons,null,2)}\n\`\`\``;
  const sofaProof=document.createElement('canvas');sofaProof.width=200;sofaProof.height=64;
  const sofaContext=sofaProof.getContext('2d')!;sofaContext.drawImage(source,0,32*32,96,64,0,0,96,64);sofaContext.drawImage(source,0,35*32,96,64,104,0,96,64);
  const sofaImage={id:'sofa-facing-proof',name:'sofa-facing-proof.png',caption:'왼쪽: 원본32행 정면·남향(좌면/앞다리). 오른쪽:35행 뒷면·북향(등판). 반전하지 않는다.',dataUrl:sofaProof.toDataURL('image/png')};
  rawReferences.images.push(sofaImage);
  for(const doc of rawReferences.documents.filter(d=>d.id.endsWith('-sofa-front')||d.id.endsWith('-sofa-back'))) doc.markdown+='\n\n## 원본 앞뒤 비교\n\n공식 분홍/황색 응접실 샘플 https://yms.main.jp/dotartworld/sozai/tileset/smp_fantasy01/smp-msionI02.JPG 및 smp-msionI03.JPG의 위쪽 소파는32행 정면, 아래쪽은35행 등판이다. 35행은 좌면과 앞다리가 보이지 않는 북향 뒷면이므로 탁자 남쪽에 둔다. 같은 정면을 뒤집은 그림이 아니다.\n\n![앞뒤 직접 비교](image:sofa-facing-proof)';
  const deskProof=document.createElement('canvas');deskProof.width=224;deskProof.height=96;
  const deskContext=deskProof.getContext('2d')!;
  deskContext.drawImage(source,0,416,96,96,0,0,96,96);
  deskContext.drawImage(source,0,512,96,64,128,16,96,64);
  rawReferences.images.push({id:'table-panel-proof',name:'table-panel-proof.png',caption:'왼쪽(0,13)3×3: 다리 있는 탁자. 오른쪽(0,16)3×2: 목재 상판과 전면 패널. 서로 다른 전체 원본이며 오른쪽을 러그로 단정하거나 왼쪽의 다리로 교체하지 않는다.',dataUrl:deskProof.toDataURL('image/png')});
  for(const doc of rawReferences.documents.filter(d=>d.id.endsWith('-writing-desk')||d.id.endsWith('-dining-table')))doc.markdown+='\n\n## 서로 다른 상판 가구의 전체 경계\n\n(0,13)3×3은 상판과 다리가 있는 탁자, (0,16)3×2는 상판과 어두운 전면 패널이 보이는 별도 목재 가구다. 후자의 정확한 용도를 제작자가 명명한 근거는 없으므로 기존 writing-desk ID는 호환성을 위해 유지하고 이름은 관찰 가능한 형태로 표기한다. 러그라는 판정 역시 확인되지 않았다. (3,16)1×2의 문서가 놓인 별도 변형을 연장판이라고 단정하지 않는다. 다른 물체의 다리/패널을 붙이지 않고 지정 배열 전체를 사용한다. W의 문서+깃펜은 별도 합성 객체이며 source-over 원본과 좌표를 따른다.\n\n![전체 형태 직접 비교](image:table-panel-proof)';
  if(pack.id==='paw-mansion-r') {
    const proof=document.createElement('canvas');proof.width=168;proof.height=128;const draw=proof.getContext('2d')!;
    draw.drawImage(source,96,1440,96,64,0,0,96,64);draw.drawImage(source,192,1472,32,128,128,0,32,128);
    rawReferences.images.push({id:'display-shape-proof',name:'display-shape-proof.png',caption:'왼쪽 가로3×2/오른쪽 세로1×4 진열장. 양쪽 모두 유리 상판 아래 목재 전면 받침을 보존한다. 문/거울 아님.',dataUrl:proof.toDataURL('image/png')});
    for(const doc of rawReferences.documents.filter(d=>d.id.endsWith('-wide-display')||d.id.endsWith('-vertical-display')))doc.markdown+='\n\n## 유리 진열장 전체 형태\n\n공식 보석상 https://yms.main.jp/dotartworld/sozai/tileset/smp_fantasy01/smp-msionI04.JPG 의 좌측 세로 진열장과 위쪽 가로 진열장이다. 대각 반사 유리 아래 목재 전면/발판까지 보존한다. 세로 케이스는 원본(6,46)1×4이며 벽 문/거울로 세우지 않고 바닥 가구로 배치한다.\n\n![원본 진열장 비교](image:display-shape-proof)';
  }
  tileset.structureKits=effective.recipes.map((r):StructureKitDef=>{
    const category=tileset.referenceDocuments!.find(c=>c.documents.some(d=>d.id===r.id));
    if(!category) throw Error(`객체 문서 누락 ${r.id}`);
    const {width,height}=r.sourceRect;
    return {id:r.id,kind:'section',name:r.name,width,height,tileSize:32,rows:r.tiles.map(row=>({tiles:Array<number>(width).fill(-1),upperTiles:[...row]})),learnedFrom:'db-authored',
      ai:{description:r.name,placementRules:`전체 고정 배열. ${r.placementKind}; 지지칸 ${JSON.stringify(r.supportCells)}. ${r.facing} 접근을 비운다. 합성은 아틀라스에 이미 포함되므로 추가 upper로 덮지 않는다. 자동 착석/수면/구매/문 이벤트 없음.`,repeatability:'fixed',layerHome:'upper',origin:'ai'},
      referenceDocuments:[{id:'whole-object',name:r.name,description:'원본 판본·전체 배열·받침·방향과 정상/오류 그림.',documents:[{id:'assembly',name:'전체 객체 배열.md',markdown:`# ${r.name}\n\n현재 tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}. ${r.placementKind}, ${r.facing}. 0기준 좌상단, -1은 기존 바닥 보존. 파생 여부와 픽셀 조립은 함께 실린 근거 문서를 따른다.\n\n\`\`\`json\n${JSON.stringify({width,height,sourceRect:r.sourceRect,supportCells:r.supportCells,lowerTiles:Array(width*height).fill(-1),upperTiles:r.tiles.flat()},null,2)}\n\`\`\``},...category.documents.filter(d=>d.id===r.id)],images:category.images.filter(i=>i.id===r.id || (i.id==='table-panel-proof'&&(r.id.endsWith('-writing-desk')||r.id.endsWith('-dining-table'))) || (i.id==='sofa-facing-proof'&&(r.id.endsWith('-sofa-front')||r.id.endsWith('-sofa-back'))) || (i.id==='display-shape-proof'&&(r.id.endsWith('-wide-display')||r.id.endsWith('-vertical-display'))))}]};
  });
  for(const scene of effective.scenes!) tileset.referenceDocuments.push({id:`scene-${scene.id}`,name:scene.name,description:'전체 두 레이어·객체 배치·접근 좌표·방 역할.',documents:[{id:'layout',name:scene.name+'.md',markdown:`# ${scene.name}\n\n현재 tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}.\n\n${scene.notes}\n\n하위 전체 배열 후 상위 전체 배열을 배치한다. -1은 빈 칸. 상위 객체 사각형은 solid다. 접근칸은 통행용이며 수면·연주·판매/문 이벤트는 별도로 저작한다. 파생 타일은 원본440칸 뒤에 추가했다.\n\n\`\`\`json\n${JSON.stringify(scene,null,2)}\n\`\`\`\n\n![전체 조립](image:assembled-scene)`}],images:[{id:'assembled-scene',name:scene.id+'.png',caption:scene.name+' · 사용자 원본 전체 조각으로 조립.',dataUrl:render(canvas,scene).toDataURL('image/png')}]});
  validateTilesetReferences(tileset.referenceDocuments);
  return {tileset,dataUrl,imageWidth:canvas.width,imageHeight:canvas.height};
}
