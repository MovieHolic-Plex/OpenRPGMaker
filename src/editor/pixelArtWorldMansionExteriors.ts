import layouts from '@/assets/pixelArtWorldMansionExteriorsLayout.json';
import { createExternalTileset, validateExternalTileScenes, type ExternalTilesetPack } from '@/project/externalTilesetCatalog';
import { inspectExternalTileGrounding } from '@/project/externalTileGrounding';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';
import type { StructureKitDef, TilesetDef } from '@/project/types';
type Example={width:number;height:number;lowerTiles:number[];upperTiles:number[]};
/** Metadata-only plan; pixel source is the user's exactly verified PNG. */
export function appendPixelArtWorldMansionExteriors(pack:ExternalTilesetPack,source:HTMLImageElement,target:TilesetDef,
 references:(pack:ExternalTilesetPack,image:CanvasImageSource,url:string,id:string)=>TilesetReferenceCategory,
 render:(image:CanvasImageSource,example:Example)=>HTMLCanvasElement) {
 const layout=layouts.find(p=>p.packId===pack.id);if(!layout)return null;
 if(pack.sha256!==layout.sourceSha256||source.width!==256||source.height!==1632||target.count!==408||target.tilesPerRow!==8||target.tileSize!==32)throw Error('저택 외관 원본 판본 오류');
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=layout.imageHeight;
 const context=canvas.getContext('2d',{willReadFrequently:true})!;context.imageSmoothingEnabled=false;context.drawImage(source,0,0);
 const raw=context.getImageData(0,0,256,1632).data,alpha=(x:number,y:number)=>raw[(y*256+x)*4+3]!;
 for(const object of layout.composites) {
  for(const part of object.parts) {
   const r=part.sourceRect,o=part.offset;
   if(![r.x,r.y,r.width,r.height,o.x,o.y].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>256||r.y+r.height>1632||o.x<0||o.y<0||o.x+r.width>object.canvas.width||o.y+r.height>object.canvas.height)throw Error('외관 합성 범위 오류');
   context.drawImage(source,r.x,r.y,r.width,r.height,o.x,object.sourceRect.y*32+o.y,r.width,r.height);
  }
  if(object.id.endsWith('-tea-table-cups')) {
   const base=object.parts[0]!.sourceRect;
   for(const overlay of object.parts.slice(1)) {
    const r=overlay.sourceRect,o=overlay.offset;let bottom=-1;
    for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(alpha(r.x+x,r.y+y))bottom=y;
    if(bottom<0)throw Error('빈 찻잔');
    for(let y=bottom-1;y<=bottom;y++)for(let x=0;x<r.width;x++)if(alpha(r.x+x,r.y+y)){
     const bx=o.x+x,by=o.y+y;if(by<24||by>62||alpha(base.x+bx,base.y+by)!==255)throw Error('찻잔 밑동이 상판 밖입니다.');
    }
   }
  }
 }
 const effective:ExternalTilesetPack={...pack,height:canvas.height,recipes:layout.recipes,scenes:layout.scenes};validateExternalTileScenes(effective);
 const pixels=context.getImageData(0,0,256,canvas.height).data;
 for(const scene of effective.scenes!) {
  const issue=inspectExternalTileGrounding(effective,scene,pixels)[0];if(issue)throw Error(`${scene.id}/${issue.recipeId}: 밑동이 바닥에 닿지 않습니다.`);
  for(const t of scene.lowerTiles)for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(pixels[((Math.floor(t/8)*32+y)*256+t%8*32+x)*4+3]!==255)throw Error('외관 하위 받침이 투명합니다.');
 }
 const tileset=createExternalTileset(effective,target.image.type==='uploaded'?target.image.id:(()=>{throw Error('사용자 업로드만 허용');})(),target.id);
 const dataUrl=canvas.toDataURL('image/png');tileset.referenceDocuments=structuredClone(target.referenceDocuments??[]);
 const compositeIds=new Set(layout.composites.map(c=>c.id));
 const category=references({...effective,recipes:effective.recipes.filter(r=>compositeIds.has(r.id))},canvas,dataUrl,tileset.id);
 category.id='paw-mansion-exterior-assemblies';category.name='저택 전체 지붕·외벽·현관과 상판';category.documents=category.documents.filter(d=>compositeIds.has(d.id));category.images=category.images.filter(i=>compositeIds.has(i.id));
 for(const doc of category.documents){const c=layout.composites.find(c=>c.id===doc.id)!;doc.markdown=`# ${c.name}\n\n원본 ${pack.filename}, SHA256 ${pack.sha256}. parts.sourceRect/offset은 원본픽셀, 아래 sourceRect/tiles는 원본408칸 뒤에 붙인 파생아틀라스 칸이다. 파생 행을 원본에서 자르지 않는다.\n\n${c.notes}\n\n\`\`\`json\n${JSON.stringify(c,null,2)}\n\`\`\`\n\n${doc.markdown.replaceAll('원본 source_rect','파생 아틀라스 source_rect').replace('원본 타일 배열','파생 타일 배열')}`;}
 tileset.referenceDocuments.push(category);
 const rawRefs=tileset.referenceDocuments.find(c=>c.id==='paw-furniture-pilot')!;
 rawRefs.documents.find(d=>d.id==='read-first')!.markdown+=`\n\n## 판본별 객체 픽셀 비교\n\n공식상 색상변형이며 실제3시트 alpha는 동일하다. RGBA 바이트는 다르므로 각 원본을 직접 사용한다. 아래 rawRGBA hash는 PNG파일 SHA가 아니다. 투명RGB 차이도 포함한다.\n\n\`\`\`json\n${JSON.stringify(layout.sourceComparisons,null,2)}\n\`\`\``;
 const house=layout.composites.find(c=>c.id.endsWith('-whole-house'))!;
 const houseImage=document.createElement('canvas');houseImage.width=house.canvas.width;houseImage.height=house.canvas.height;houseImage.getContext('2d')!.drawImage(canvas,0,house.sourceRect.y*32,house.canvas.width,house.canvas.height,0,0,house.canvas.width,house.canvas.height);
 rawRefs.images.push({id:'whole-house-support',name:'whole-house-support.png',caption:'지붕 전면처마→외벽 cornice→기둥/벽→석축기단과 현관 전체. 원본 중앙셀만 반복하고 곡면양끝을 보존했다.',dataUrl:houseImage.toDataURL('image/png')});
 for(const doc of rawRefs.documents.filter(d=>d.id.endsWith('-tea-stool')))doc.markdown+='\n\n등받이가 없는 원형 좌판/원형 받침인 스툴이다. 좌우 방향을 가진 등받이 의자가 아니다. 원본(6,11)1×1을 회전/반전 없이 탁자 양옆에 두며 앞뒤 그림을 날조하지 않는다. 예제남쪽 접근은 하나의 빈 통행예이며 실제표본은 스툴남쪽/옆칸 접근을 남긴다.';
 const structureNotes=(id:string)=>id.endsWith('-roof-whole')?'지붕5×5 전체가 단독 지상건물이 아니다. 처마 아래 외벽cornice행33을 이어야 한다. 원본중앙x2열만수평반복가능하며 양쪽곡면/전면처마를늘이거나잘라내지않는다.':id.endsWith('-wall-bay')?'외벽5×3의 기둥/상단cornice/하단석축끝전체. 높이확장은원본34행몸통만반복하고33행윗장식과35행기단을유지한다.':id.endsWith('-facade-door-window')?'전체2층아치창/1층현관전면3×5. 위창밑석재턱과 아래현관기둥/검은문틀은일체다. 그림은개폐·전이이벤트가아니다.':id.endsWith('-balcony-portico')?'기둥발까지전체3×5인장식발코니. 건물창앞에겹치는장식이며캐릭터발판아님. 공식보행발코니는건물1+창2+발코니3층이필요하므로이번two-layer범위밖이다. 단독그림의투명가운데를걸을수있다고추정하지않는다.':id.endsWith('-balcony-enclosure')?'북쪽뒷난간/양측기둥/남쪽앞난간/전면토대전체3×4. 중앙투명부분은바닥이아니라뒤받침이보이는영역이다. 다른난간변형을수직으로이어복층통행을만들지않는다. 보행발코니/계단교차는미지원이다.':'';
 for(const doc of rawRefs.documents){const notes=structureNotes(doc.id);if(notes)doc.markdown+=`\n\n## 전체 구조 받침\n\n${notes}\n\n단독 정상/오류 그림은 원본 전체조각 비교이며 완성 지상배치 승인이 아니다. 지붕/벽/창은 아래 전체건물배열로 조립한다. 장식발코니/난간은 별도 구조이며 이 완성 건물에 임의 덧붙이지 않는다.\n\n![완성 건물 받침 관계](image:whole-house-support)`;}
 tileset.structureKits=effective.recipes.map((r):StructureKitDef=>{
  const evidence=tileset.referenceDocuments!.find(c=>c.documents.some(d=>d.id===r.id));if(!evidence)throw Error('객체문서 누락');const{width,height}=r.sourceRect;
  const rules=`${r.placementKind}. ${structureNotes(r.id)} 전체고정배열 upper, 밑동/받침 ${JSON.stringify(r.supportCells)}. ${r.facing} 접근. 원본/파생좌표를구분한다. 자동문/발코니통행이벤트없음.`;
  return{id:r.id,kind:'section',name:r.name,width,height,tileSize:32,rows:r.tiles.map(row=>({tiles:Array<number>(width).fill(-1),upperTiles:[...row]})),learnedFrom:'db-authored',ai:{description:r.name,placementRules:rules,repeatability:'fixed',layerHome:'upper',origin:'ai'},referenceDocuments:[{id:'whole-object',name:r.name,description:'원본 전체배열·받침·방향과 정상/오류 근거.',documents:[{id:'assembly',name:'전체배열.md',markdown:`# ${r.name}\n\n현재 tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}.\n\n${rules}\n\n\`\`\`json\n${JSON.stringify({width,height,sourceRect:r.sourceRect,lowerTiles:Array(width*height).fill(-1),upperTiles:r.tiles.flat(),supportCells:r.supportCells},null,2)}\n\`\`\``},...evidence.documents.filter(d=>d.id===r.id)],images:evidence.images.filter(i=>i.id===r.id||(i.id==='whole-house-support'&&!!structureNotes(r.id)))}]};
 });
 for(const scene of effective.scenes!)tileset.referenceDocuments.push({id:`scene-${scene.id}`,name:scene.name,description:'실제 전체건물과 짧은 정원접근.',documents:[{id:'layout',name:scene.name+'.md',markdown:`# ${scene.name}\n\n현재 tilesetId:${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}.\n\n${scene.notes}\n\n전체lower 후 upper. 접근칸은 빈통행칸이며 전이/문이벤트는별도.\n\n\`\`\`json\n${JSON.stringify(scene,null,2)}\n\`\`\`\n\n![실제 전체장면](image:assembled-scene)`}],images:[{id:'assembled-scene',name:scene.id+'.png',caption:scene.name+' · 원본 whole 조립.',dataUrl:render(canvas,scene).toDataURL('image/png')}]});
 validateTilesetReferences(tileset.referenceDocuments);return{tileset,dataUrl,imageWidth:256,imageHeight:canvas.height};
}
