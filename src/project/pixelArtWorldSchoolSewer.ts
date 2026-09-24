import catalog from '@/assets/pixelArtWorldSchoolSewerCatalog.json';
import type { ExternalTilesetPack } from './externalTilesetCatalog';
import type { TilesetDef } from './types';
import { validateTilesetReferences, type TilesetReferenceCategory } from './tilesetReferences';

type Layout = { id: string; name: string; width: number; height: number; lowerTiles: number[]; upperTiles: number[]; notes: string; approachCells: {x:number;y:number}[]; passableTiles: number[]; lowerTileIds: number[]; errorEdits: {layer: 'lowerTiles'|'upperTiles';index:number;tile:number;code:string}[] };
type CatalogPack = ExternalTilesetPack & { assemblies: Layout[]; scenes: Layout[] };
/** User-local actual images and complete arrays. Does not fetch or install external events. */
export function attachPixelArtWorldSchoolSewer(pack: ExternalTilesetPack, image: HTMLImageElement, tileset: TilesetDef): void {
  const spec = catalog.find(p => p.id === pack.id) as CatalogPack | undefined;
  if (!spec) return;
  if (spec.sha256 !== pack.sha256 || image.naturalWidth !== spec.width || image.naturalHeight !== spec.height) throw Error('학교·하수도 원본 판본 불일치');
  const raw=document.createElement('canvas');raw.width=spec.width;raw.height=spec.height;
  raw.getContext('2d')!.drawImage(image,0,0);
  const pixels=raw.getContext('2d')!.getImageData(0,0,raw.width,raw.height).data;
  const layouts=[...spec.scenes,...spec.assemblies];
  const sourceCategory=tileset.referenceDocuments?.find(c=>c.id==='paw-furniture-pilot');
  if(sourceCategory){
    sourceCategory.name='원본과 지원 범위';sourceCategory.description='원본 판본·좌표. 완전 구조는 별도 이름의 용도와 객체 참고문서를 읽는다.';
    sourceCategory.documents=sourceCategory.documents.filter(d=>d.id==='spatial-layout');
    sourceCategory.documents.unshift({id:'read-first',name:'원본과 지원 범위.md',markdown:[`# ${spec.name}`,`tilesetId: ${tileset.id}. ${spec.filename} · ${spec.width}×${spec.height}px · SHA256 ${spec.sha256}.`,spec.notes,'원본32px·8열, 0기준 tile=y*8+x. 기존 번호를 보존하며 재색칠/확대/다른 시트 혼용 없음. 이 원본 카테고리는 판본 확인용이다. 배치할 구조의 별도 용도 전체 MD/그림과 구조객체 소유 참고문서를 먼저 읽는다. 시트 전체가 검토된 것은 아니다.',`지원 구조: ${layouts.map(s=>s.name+' ('+s.width+'×'+s.height+')').join(', ')}.`, '정상은 두 레이어 전체 배열, 오류는 문서에 적힌 좌표 변경이다. 문/계단/수위 등 이벤트는 자동 생성하지 않는다. 물 연출 별도 원본은 이 팩의 설치 자산이 아니다.', '![사용자 원본](image:source-sheet)',`[제작자](${spec.sourcePage}) · [이용 조건](${spec.termsUrl}). ${spec.credit}. 사용자 로컬에서만 생성·보관하고 원본/가공 소재를 재배포하지 않는다.`].join('\n\n')});
  }
  const lower=new Set(layouts.flatMap(s=>s.lowerTileIds));
  const upper=new Set(layouts.flatMap(s=>s.upperTiles).filter(t=>t>=0));
  for(const tile of lower){
    if(upper.has(tile))throw Error(`상·하위 홈 중복 ${tile}`);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(pixels[((Math.floor(tile/8)*32+y)*raw.width+tile%8*32+x)*4+3]!==255)throw Error(`받침 없는 투명 하위 ${tile}`);
  }
  const passable=new Set(layouts.flatMap(s=>s.passableTiles));
  for(const tile of new Set([...lower,...upper])){
    const pass=passable.has(tile),layer=upper.has(tile)?'upper':'lower';
    tileset.priority[tile]=layer;tileset.passability[tile]={up:pass,down:pass,left:pass,right:pass};
    (tileset.tileMeta??=[])[tile]={label:pass?'검토된 마른 발판/개구부':'검토된 구조/차단 수면',description:'학교·하수도 전체 조립 배열을 읽는다. 그림의 고도·수면은 자동 이벤트가 아니다.',defaultLayer:layer,passage:pass?'passable':'solid',source:'imported'};
  }
  // Passable upper art inherits lower floor (engine star contract); solid rail cells bound the stair corridor.
  const render=(s:Layout)=>{const c=document.createElement('canvas');c.width=s.width*32;c.height=s.height*32;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;for(const layer of[s.lowerTiles,s.upperTiles])layer.forEach((t,i)=>{if(t>=0)ctx.drawImage(image,t%8*32,Math.floor(t/8)*32,32,32,i%s.width*32,Math.floor(i/s.width)*32,32,32);});return c;};
  tileset.referenceDocuments=(tileset.referenceDocuments??[]).filter(c=>!spec.scenes.some(s=>c.id===`scene-${s.id}`));
  for(const layout of layouts){
    const incorrect=structuredClone(layout);
    for(const edit of layout.errorEdits){if(edit.index<0||edit.index>=layout.width*layout.height||incorrect[edit.layer][edit.index]===edit.tile)throw Error('무효 오류 좌표');incorrect[edit.layer][edit.index]=edit.tile;}
    const errors=layout.errorEdits.map(e=>({code:e.code,layer:e.layer,x:e.index%layout.width,y:Math.floor(e.index/layout.width),expected:layout[e.layer][e.index],actual:e.tile}));
    const normal=render(layout),wrong=render(incorrect),comparison=document.createElement('canvas');comparison.width=normal.width*2+8;comparison.height=normal.height;comparison.getContext('2d')!.drawImage(normal,0,0);comparison.getContext('2d')!.drawImage(wrong,normal.width+8,0);
    const arrays={width:layout.width,height:layout.height,lowerTiles:layout.lowerTiles,upperTiles:layout.upperTiles};
    const doc:TilesetReferenceCategory={id:`school-sewer-${layout.id}`,name:layout.name,description:'정적 전체 조립. 원본32px·8열, 실제 정상/오류와 배열. 이벤트 별도.',documents:[{id:'layout',name:layout.name+'.md',markdown:[`# ${layout.name}`,`tilesetId: ${tileset.id}. ${spec.filename} · SHA256 ${spec.sha256}. 원본 번호0..${tileset.count-1} 보존, 0기준 tile=y*8+x.`,layout.notes,'먼저 하위 전체 배열 → 상위 전체 배열. -1은 빈 칸. 부분 조각을 임의 반복/반전하거나 물을 마른 바닥으로 바꾸지 않는다. 상위와 통행허용은 별개다. 아래 passability는 실제 타일 충돌이며 계단 높이/문 열림/물 애니메이션 명령이 아니다.',`\`\`\`json\n${JSON.stringify({expected:arrays,incorrect:{width:incorrect.width,height:incorrect.height,lowerTiles:incorrect.lowerTiles,upperTiles:incorrect.upperTiles},approachCells:layout.approachCells,passability:[...new Set([...layout.lowerTiles,...layout.upperTiles])].filter(t=>t>=0).map(tile=>({tile,...tileset.passability[tile]})),errors},null,2)}\n\`\`\``,'자동 좌표 검사: 배열 길이·번호 범위·불투명 하위 받침·오류 변경 좌표를 대조한다. 통행/동선은 준비 CLI가 엔진 canMove로 별도 관찰하며 이 픽셀 그림만으로 게임 이벤트 검증을 대신하지 않는다.','![실제 정상](image:assembled)\n![왼쪽 정상 / 오른쪽 오류](image:comparison)',spec.id==='paw-sewer'?'별도 연출 SC-Water01.png / SC-Water02.png는 미설치·이 장소의 프레임/반복/길이조절 미지원. SC-Fountain류는 대체품이 아니다. 실제 문 열림도 별도 door 카탈로그와 조건/전이 저작이 필요하다.':'실내 전이 대상은 별도로 가져온 목조학교 내부를 확인한 뒤 저작한다. 이 정적 외관만으로 내부 맵이나 문 이벤트를 만들지 않는다.',`[제작자 사용 예](${spec.sourcePage}) · [이용 조건](${spec.termsUrl}). ${spec.credit}. 사용자 제공 원본과 로컬 합성, 소재 재배포 금지.`].join('\n\n')}],images:[{id:'assembled',name:layout.id+'.png',caption:'사용자 원본 타일 전체 조립.',dataUrl:normal.toDataURL('image/png')},{id:'comparison',name:layout.id+'-comparison.png',caption:'왼쪽 정상, 오른쪽 문서의 정확한 좌표 오류.',dataUrl:comparison.toDataURL('image/png')}]};
    validateTilesetReferences([doc]);tileset.referenceDocuments.push(doc);
    (tileset.structureKits??=[]).push({id:layout.id,kind:'section',name:layout.name,width:layout.width,height:layout.height,tileSize:32,rows:Array.from({length:layout.height},(_,y)=>({tiles:layout.lowerTiles.slice(y*layout.width,(y+1)*layout.width),upperTiles:layout.upperTiles.slice(y*layout.width,(y+1)*layout.width)})),learnedFrom:'db-authored',ai:{description:layout.notes,placementRules:'고정 전체 배열과 소유 참고문서를 읽고 두 레이어 모두 배치한다. 원본 번호와 통행을 보존. 자동 이벤트 없음.',repeatability:'fixed',layerHome:'lower',origin:'ai',tags:['Pixel Art World','전체 구조','원본32px']},referenceDocuments:[doc]});
  }
  validateTilesetReferences(tileset.referenceDocuments);
}
