import catalog from '@/assets/beodeulGroundCatalog.json';
import {createBeodeulGroundTileset,ensureBeodeulGroundReferences} from '@/project/defaults/beodeulGround';
import {installBeodeulArchitecture} from '@/project/defaults/beodeulArchitecture';
import {translateTiles} from '@/project/objectStamp';
import {layerTileAt,setLayerTileAt,compactMapLayers} from '@/project/mapLayers';
import {computeReachableCells} from '@/project/lint/reachability';
import type {Project,StructureKitDef} from '@/project/types';
import {COURTYARD_HOUSES,COURTYARD_TREES} from './beodeulCourtyardTools';
import {ToolError,type ToolDefinition} from './types';

export const COURTYARD_GROVES=[{recipe:'north',x:0,y:0},{recipe:'north-open',x:23,y:0},{recipe:'north',x:46,y:0},
 {recipe:'west',x:0,y:5},{recipe:'west',x:0,y:24},{recipe:'east',x:34,y:7},{recipe:'east',x:47,y:25},{recipe:'north-open',x:38,y:29}] as const;

/** Improve the known courtyard's vegetation in place; buildings, roads, events and landings stay fixed. */
export function refineBeodeulVegetation(project:Project,mapId:string){
 const m=project.maps[mapId],ts=m&&project.tilesets[m.tilesetId];
 if(!m||ts?.id!=='beodeul_city'||m.width!==54||m.height!==34||m.relief)throw new ToolError('인식된 평지 공동마당 마을 54×34가 필요합니다.');
 const kits=new Map(ts.structureKits?.map(k=>[k.id,k]));
 const match=(k:StructureKitDef,x:number,y:number)=>k.rows.every((r,dy)=>r.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,(y+dy)*m.width+x+dx)===n));
 if(!COURTYARD_HOUSES.every(h=>{const k=kits.get(h.kit);return k&&match(k,h.x,h.y);}))throw new ToolError('공동마당의 건물 전체 배열이 일치하지 않습니다.');
 const grafts=new Map(ts.tileGrafts?.map(g=>[g.targetTile,g]));
 const previousRecipes=new Map(catalog.recipes.flatMap(r=>r.rows.flat().map(n=>[n,r] as const)));
 const own=(n:number)=>{const g=grafts.get(n);return g?.sourceChipset==='tex_beodeul_ground'?previousRecipes.get(g.sourceTile):undefined;};
 if(Array.from({length:m.width*m.height},(_,i)=>own(layerTileAt(m,3,i))?.id.startsWith('bdg-woodland-')).some(Boolean))return{summary:'숲 겹침·연결 울타리 보정이 이미 적용됐습니다.',data:{mapId,alreadyApplied:true}};
 if(m.events.length||m.terrainDesign||m.doodadGroups?.length)throw new ToolError('이 예제 보정은 이벤트/별도 지형·기물 없는 맵에서만 실행합니다.');
 const hasTransfer=(v:unknown):boolean=>!!v&&typeof v==='object'&&(Array.isArray(v)?v.some(hasTransfer):((v as Record<string,unknown>).kind==='transfer'&&(v as Record<string,unknown>).mapId===mapId)||Object.values(v).some(hasTransfer));
 if(hasTransfer(project.commonEvents)||Object.values(project.maps).some(other=>other.id!==mapId&&hasTransfer(other.events)))throw new ToolError('다른 이벤트의 전이 도착점을 보존하려면 식생을 개별 보정해야 합니다.');
 if(project.startMapId===mapId&&(project.startPos.x!==18||project.startPos.y!==17))throw new ToolError('이 예제의 우물 시작점(18,17)만 지원합니다.');
 if(!COURTYARD_TREES.every(([id,x,y])=>{const k=kits.get(`bd-tree-${id}`);return k&&match(k,x,y);}))throw new ToolError('기존 예제의 나무/덤불 전체 배열이 일치하지 않습니다.');
 const common=project.tilesets.beodeul_ground??=createBeodeulGroundTileset();ensureBeodeulGroundReferences(common);
 const newRecipes=catalog.recipes.filter(r=>'woodland' in r&&r.woodland);
 const translated=translateTiles(common,ts,newRecipes.flatMap(r=>r.rows.flat()));
 // Reapply exact source passage/priority for new canopy cells and native trunk footprints.
 for(const [source,target] of translated.map){ts.priority[target]=common.priority[source]!;ts.passability[target]=structuredClone(common.passability[source]!);}
 const keepTrees=new Set(['18,23','22,26','17,30','26,30']);
 let removedTrees=0;
 for(const [id,x,y] of COURTYARD_TREES){if(keepTrees.has(`${x},${y}`))continue;const k=kits.get(`bd-tree-${id}`)!;for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++)if(k.rows[dy]!.upperTiles[dx]!>=0)setLayerTileAt(m,3,(y+dy)*m.width+x+dx,-1);removedTrees++;}
 // Old roots/cast shadows and scattered tiny plants belong to the removed vegetation, not the buildings.
 for(let i=0;i<m.width*m.height;i++)for(const layer of [2,4] as const){
  const r=own(layerTileAt(m,layer,i));if(!r)continue;
  if(/^bdg-(light-tree-|tree-neck|roots|root-shadow|grass-|flowers-|litter)/.test(r.id)){
   if([...keepTrees].some(key=>{const [x,y]=key.split(',').map(Number);return i%m.width>=x!&&i%m.width<x!+3&&Math.floor(i/m.width)>=y!&&Math.floor(i/m.width)<=y!+4;}))continue;
   setLayerTileAt(m,layer,i,-1);
  }
 }
 for(const [x,y] of [[7,32],[30,32]]){const k=kits.get('bd-out-fence-run')!;if(!match(k,x!,y!))throw new ToolError('원본 짧은 울타리가 변경되어 보정을 중단합니다.');for(let dx=0;dx<k.width;dx++)setLayerTileAt(m,3,y!*m.width+x!+dx,-1);}
 const placements:Array<{recipe:string;x:number;y:number;layer:number}>=[];
 const stamp=(name:string,x:number,y:number)=>{const r=newRecipes.find(r=>r.id===`bdg-woodland-${name}`)!;
  if(x<0||y<0||x+r.width>m.width||y+r.height>m.height)throw new ToolError('숲 조각이 경계 밖입니다.');
  for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++){const n=r.rows[dy]![dx]!;if(n<0)continue;const i=(y+dy)*m.width+x+dx;if(layerTileAt(m,r.layer as 2|3|4,i)>=0)throw new ToolError(`숲/울타리 자리 점유 (${x+dx},${y+dy})`);}
  for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++){const n=r.rows[dy]![dx]!;if(n>=0)setLayerTileAt(m,r.layer as 2|3|4,(y+dy)*m.width+x+dx,translated.map.get(n)!);}
  placements.push({recipe:r.id,x,y,layer:r.layer});
 };
 for(const g of COURTYARD_GROVES){stamp(g.recipe+'-shadow',g.x,g.y);stamp(g.recipe,g.x,g.y);}
 // Three connected edges enclose the actual vegetable bed; the north side opens onto the main lane.
 for(let x=30;x<=35;x++)stamp('fence-horizontal',x,22);
 stamp('fence-corner',29,22);stamp('fence-corner',36,22);
 for(let y=20;y<=21;y++){stamp('fence-vertical',29,y);stamp('fence-vertical',36,y);}
 for(const [j,[x,y]] of [[1,3],[26,3],[49,3],[3,12],[3,31],[35,12],[48,30],[41,32]].entries()){
  const r=newRecipes.find(r=>r.id===`bdg-woodland-fringe-${j%2}`)!;
  const woodlandTargets=new Set(translated.map.values());
  if(r.rows.every((row,dy)=>row.every((n,dx)=>{const i=(y!+dy)*m.width+x!+dx;return n<0||layerTileAt(m,4,i)<0&&(layerTileAt(m,3,i)<0||woodlandTargets.has(layerTileAt(m,3,i)));})))stamp(`fringe-${j%2}`,x!,y!);
 }
 installBeodeulArchitecture(project); // Stable graft numbers; stone's gable now shares facade masonry.
 compactMapLayers(m);
 const fronts=COURTYARD_HOUSES.map(h=>{const k=kits.get(h.kit)!,e=k.parts!.find(e=>e.kind==='entrance')!;return{kit:h.kit,x:h.x+e.dx,y:h.y+e.dy+e.h};});
 const reachable=computeReachableCells(project,m,18,17);if(fronts.some(p=>!reachable.has(`${p.x},${p.y}`)))throw new ToolError('울타리가 문 앞 통행을 막습니다.');
 return{summary:'흩어진 나무/덤불을 앞뒤 수관이 겹치는 숲으로 묶고 높이 있는 풀 군락·텃밭 연결 울타리·단일 돌벽 박공을 보정했습니다.',data:{mapId,removedTrees,groves:COURTYARD_GROVES.length,placements,fronts,doorsReachable:true,buildingPositionsAndRoadsPreserved:true}};
}
export const BEODEUL_VEGETATION_TOOLS:readonly ToolDefinition[]=[{
 name:'refine_beodeul_courtyard_vegetation',mode:'write',domains:['map','tile'],preservesAuthoredRaster:true,
 description:'인식된 54×34 공동마당 예제의 식생 깊이/울타리 보정. 건물·길·마당·시작점 유지, 흩어진 나무/덤불을 원본 수관을 겹친 공용 숲으로 교체. 높이 있는 풀 군락과 텃밭 실제 경계의 연결 울타리. stone 박공도 아래 돌벽과 같은 재질. 이벤트/높이/변경된 나무가 있는 임의 맵은 거부. 참고문서 beodeul-ground-dressing의 식생 깊이 자료를 읽고 사용.',
 parameters:{type:'object',properties:{mapId:{type:'string'}},required:['mapId'],additionalProperties:false},run:(p,a)=>refineBeodeulVegetation(p,String(a.mapId)),
}];
