import catalog from '@/assets/beodeulGroundCatalog.json';
import {createBeodeulGroundTileset} from '@/project/defaults/beodeulGround';
import {translateTiles} from '@/project/objectStamp';
import {layerTileAt,setLayerTileAt,compactMapLayers,remapExtraLayers} from '@/project/mapLayers';
import {computeReachableCells} from '@/project/lint/reachability';
import type {Project,StructureKitDef} from '@/project/types';
import {ToolError,type ToolDefinition} from './types';
import {dressBeodeulGround} from './beodeulGroundTools';
import {harmonizeBeodeulDaylight} from './beodeulLightTools';

export const COURTYARD_HOUSES=[
 {kit:'bd-house-village-cream',x:8,y:6,oldX:4,oldY:3},
 {kit:'bd-house-village-brick',x:17,y:5,oldX:17,oldY:2},
 {kit:'bd-house-village-stone',x:27,y:8,oldX:30,oldY:5},
 {kit:'bd-house-village-sage',x:7,y:21,oldX:5,oldY:18},
 {kit:'bd-house-village-ochre',x:29,y:23,oldX:27,oldY:20},
 {kit:'bd-house-village-church',x:41,y:5,oldX:41,oldY:3},
] as const;

export const COURTYARD_TREES=[
  ['03a8f7',1,1],['1a786c',4,0],['3e8732',7,2],['1a786c',10,0],['03a8f7',13,2],['03a8f7',24,1],['1a786c',27,0],['3e8732',30,2],['03a8f7',33,0],['1a786c',36,2],['03a8f7',45,1],['3e8732',48,0],['03a8f7',51,2],
  ['1a786c',0,6],['3e8732',4,5],['03a8f7',1,11],['3e8732',4,13],
  ['1a786c',0,21],['03a8f7',3,24],['3e8732',0,28],['03a8f7',4,30],
  ['1a786c',18,23],['03a8f7',22,26],['3e8732',17,30],['03a8f7',26,30],['1a786c',38,27],['3e8732',42,30],['03a8f7',48,29],['1a786c',50,24],
  ['1a786c',35,8],['03a8f7',37,13],['3e8732',42,24],['03a8f7',46,25],
  ['f4f319',3,9],['37f48b',6,11],['f4f319',21,2],['37f48b',25,5],['f4f319',32,6],['f4f319',34,13],['37f48b',38,10],
  ['37f48b',3,21],['f4f319',15,25],['37f48b',21,29],['f4f319',44,28],['37f48b',48,23],['f4f319',52,30],
 ] as const;

/** Explicit spatial rebuild of the recognized five-house example, preserving its complete native building arrays. */
export function composeBeodeulCourtyard(project:Project,mapId:string){
 const m=project.maps[mapId],ts=m&&project.tilesets[m.tilesetId];
 if(!m||ts?.id!=='beodeul_city')throw new ToolError('버들항 작은 마을이 필요합니다.');
 const kits=new Map(ts.structureKits?.map(k=>[k.id,k]));
 const matches=(k:StructureKitDef,x:number,y:number)=>x>=0&&y>=0&&x+k.width<=m.width&&y+k.height<=m.height&&k.rows.every((r,dy)=>r.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,(y+dy)*m.width+x+dx)===n));
 if(COURTYARD_HOUSES.every(h=>{const k=kits.get(h.kit);return k&&matches(k,h.x,h.y);}))return{summary:'우물 공동마당 배치가 이미 있습니다.',data:{mapId,alreadyApplied:true}};
 if(m.width!==54||m.height!==30||!COURTYARD_HOUSES.every(h=>{const k=kits.get(h.kit);return k&&matches(k,h.oldX,h.oldY);}))throw new ToolError('기존 54×30 예제의 집 5채와 교회 전체 배열이 일치해야 합니다. 임의 맵을 지우지 않습니다.');
 if(m.events.length||m.relief||m.terrainDesign||m.doodadGroups?.length)throw new ToolError('이 재배치는 이벤트·높이·별도 지형/기물 없는 예제만 지원합니다.');
 const hasTransfer=(v:unknown):boolean=>!!v&&typeof v==='object'&&(Array.isArray(v)?v.some(hasTransfer):((v as Record<string,unknown>).kind==='transfer'&&(v as Record<string,unknown>).mapId===mapId)||Object.values(v).some(hasTransfer));
 if(hasTransfer(project.commonEvents)||Object.values(project.maps).some(other=>other.id!==mapId&&hasTransfer(other.events)))throw new ToolError('공통 이벤트/다른 맵의 전이 도착점이 있어 자동 재배치할 수 없습니다.');
 if(project.startMapId===mapId&&(project.startPos.x!==18||project.startPos.y!==17))throw new ToolError('예제의 우물 시작점(18,17)만 지원합니다.');
 remapExtraLayers(m,54,34,i=>i<54*30?i:-1);
 m.width=54;m.height=34;m.lowerTiles=Array(54*34).fill(737);m.upperTiles=Array(54*34).fill(-1);
 delete m.lowerOverlayTiles;delete m.upperOverlayTiles;delete m.shadowBits;
 const placements:Array<{kit:string;x:number;y:number;kind:string}>=[];
 const stamp=(id:string,x:number,y:number,kind='prop')=>{
  const k=kits.get(id);if(!k)throw new ToolError(`공용 조각 없음: ${id}`);
  if(x<0||y<0||x+k.width>m.width||y+k.height>m.height)throw new ToolError(`경계 밖 조각: ${id}`);
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){const n=k.rows[dy]!.upperTiles[dx]!;if(n>=0&&layerTileAt(m,3,(y+dy)*m.width+x+dx)>=0)throw new ToolError(`조각 겹침: ${id} (${x+dx},${y+dy})`);}
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){const n=k.rows[dy]!.upperTiles[dx]!;if(n>=0)setLayerTileAt(m,3,(y+dy)*m.width+x+dx,n);}
  placements.push({kit:id,x,y,kind});
 };
 for(const h of COURTYARD_HOUSES)stamp(h.kit,h.x,h.y,'house');
 const fronts=COURTYARD_HOUSES.map(h=>{const k=kits.get(h.kit)!,e=k.parts!.find(p=>p.kind==='entrance')!;return{kit:h.kit,x:h.x+e.dx,y:h.y+e.dy+e.h};});
 // A settlement has an outer edge: irregular full trees form groves, with intentional gaps at both road entries.
 for(const [id,x,y] of COURTYARD_TREES)stamp(`bd-tree-${id}`,x,y,'tree');
 stamp('bd-prop-well_roofed',19,15);
 stamp('bd-prop-bench_wood',22,16);stamp('bd-prop-laundry_rack',24,14);
 stamp('bd-out-woodpile',15,23);stamp('bd-prop-flowerbox_long',44,20);
 stamp('bd-prop-bench_wood',47,21);stamp('bd-out-fence-run',7,32);stamp('bd-out-fence-run',30,32);
 const common=project.tilesets.beodeul_ground??=createBeodeulGroundTileset();
 const translated=translateTiles(common,ts,catalog.recipes.flatMap(r=>r.rows.flat()));
 const recipe=(id:string)=>catalog.recipes.find(r=>r.id===id)!;
 const stampRecipe=(id:string,x:number,y:number)=>{const r=recipe(id);for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++){const n=r.rows[dy]![dx]!;if(n>=0)setLayerTileAt(m,r.layer as 1|2|3|4,(y+dy)*m.width+x+dx,translated.map.get(n)!);}};
 // Pre-existing deliberate beds keep the support pass from scattering random living props.
 stampRecipe('bdg-hamlet-vegetable-bed',30,20);stampRecipe('bdg-hamlet-vegetable-bed',33,20);
 const support=dressBeodeulGround(project,mapId,'natural');
 const soil=new Set<number>(),stone=new Set<number>(),meadow=new Set<number>();
 const add=(set:Set<number>,x:number,y:number)=>{if(x>=0&&y>=0&&x<m.width&&y<m.height)set.add(y*m.width+x);};
 const oval=(set:Set<number>,cx:number,cy:number,rx:number,ry:number)=>{for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<1)add(set,x,y);};
 const path=(set:Set<number>,pts:number[][],width=1)=>{for(let n=1;n<pts.length;n++){const [ax,ay]=pts[n-1]!,[bx,by]=pts[n]!;const steps=Math.max(Math.abs(bx!-ax!),Math.abs(by!-ay!));let py=ay!;for(let t=0;t<=steps;t++){const x=Math.round(ax!+(bx!-ax!)*t/(steps||1)),y=Math.round(ay!+(by!-ay!)*t/(steps||1));for(let dy=0;dy<width;dy++)for(let dx=0;dx<width;dx++){add(set,x+dx,y+dy);add(set,x+dx,py+dy);}py=y;}}};
 // One shared worn courtyard connects the three northern homes; paving concentrates at the communal well.
 oval(soil,20,16,11.5,4.7);path(soil,[[10,12],[10,16],[13,18]],2);path(soil,[[29,14],[29,18]],2);
 oval(stone,19.5,16,3.6,2.4);
 path(soil,[[0,18],[7,18],[12,18]],2);path(stone,[[23,18],[31,18],[35,19],[39,19],[43,19],[48,18]],2);
 oval(stone,47,19,5.7,2.2);
 path(soil,[[18,20],[17,22],[16,27],[13,29],[8,29]],2);oval(soil,11,30,5,1.7);
 path(soil,[[35,19],[37,22],[37,28],[35,29],[32,29]],2);oval(soil,33,30,4.3,1.7);
 oval(soil,32,21,4.4,1.6);
 // Larger low-contrast ground masses follow woodland, leaving the court and routes legible.
 for(const zone of [[3,7,4.5,7],[29,3,12,2.8],[3,27,4.5,6],[21,28,5.5,5],[45,28,8,4.5],[37,10,3.8,7]])oval(meadow,...zone as [number,number,number,number]);
 const paint=(set:Set<number>,kind:'soil'|'stone'|'meadow')=>{for(const i of set){if(kind==='meadow'&&(soil.has(i)||stone.has(i))||kind==='soil'&&stone.has(i))continue;const x=i%m.width,y=Math.floor(i/m.width);let mask=0;for(const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(x+dx!>=0&&x+dx!<m.width&&y+dy!>=0&&y+dy!<m.height&&set.has((y+dy!)*m.width+x+dx!))mask|=bit!;const r=catalog.recipes.find(r=>'kind'in r&&r.kind===kind&&'mask'in r&&r.mask===mask)!;setLayerTileAt(m,1,i,translated.map.get(r.rows[0]![0]!)!);}};
 paint(meadow,'meadow');paint(soil,'soil');paint(stone,'stone');
 for(const [id,x,y] of [['bdg-barrel',15,14],['bdg-firewood',11,31],['bdg-barrel',35,30],['bdg-firewood',36,31]] as const)stampRecipe(id,x,y);
 for(const [x,y] of [[10,12],[10,13],[29,14],[8,29],[9,29],[32,29]])stampRecipe(`bdg-hamlet-steps-${(x!+y!)%4}`,x!,y!);
 for(const [j,[x,y]] of [[5,10],[6,16],[8,4],[13,5],[25,4],[32,5],[33,14],[38,15],[3,26],[5,29],[16,30],[23,29],[25,32],[39,25],[43,27],[48,28],[51,31],[28,21],[37,24],[43,22]].entries()){
  const r=recipe(j%5===0?'bdg-flowers-white':`bdg-grass-${j%3}`);
  if(r.rows[0]!.every((_,dx)=>{const i=y!*m.width+x!+dx;return !soil.has(i)&&!stone.has(i)&&layerTileAt(m,3,i)<0&&layerTileAt(m,4,i)<0;}))stampRecipe(r.id,x!,y!);
 }
 const light=harmonizeBeodeulDaylight(project,mapId,{roads:false,meadow:false});compactMapLayers(m);
 const reachable=computeReachableCells(project,m,18,17);
 if(fronts.some(p=>!reachable.has(`${p.x},${p.y}`)))throw new ToolError('공동마당에서 도달할 수 없는 문이 있습니다.');
 return{summary:'원본 민가 5채와 교회를 우물 공동마당·숲 가장자리·텃밭의 생활 공간으로 재배치했습니다.',data:{mapId,width:m.width,height:m.height,fronts,placements,support:support.data,daylight:light.data,doorsReachable:true,nativeBuildingArraysPreserved:true,start:{x:18,y:17}}};
}

export const BEODEUL_COURTYARD_TOOLS:readonly ToolDefinition[]=[{
 name:'compose_beodeul_courtyard_village',mode:'write',domains:['map','tile'],preservesAuthoredRaster:true,
 description:'인식된 54×30 버들항 예제(민가 5채+교회)를 54×34 우물 공동마당 마을로 재배치. 세 집의 공유 마당·숲/텃밭 가장자리 두 집·교회 길·숲 경계. 원본 건물 전체 칸을 그대로 옮긴다. 기존 맵 배치 변경이 명시적으로 요청됐을 때만 사용. 이벤트/높이/다른 맵 전이가 있으면 거부. 임의 맵 지원 아님. beodeul-ground-dressing의 공동마당 문서와 실제 그림부터 읽는다.',
 parameters:{type:'object',properties:{mapId:{type:'string'}},required:['mapId'],additionalProperties:false},run:(p,a)=>composeBeodeulCourtyard(p,String(a.mapId)),
}];
