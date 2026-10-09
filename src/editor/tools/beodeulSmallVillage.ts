// Small grass hamlet: five distinct native house silhouettes, two levels of winding streets.
import type { Project } from '@/project/types';
import { layerTileAt } from '@/project/mapLayers';
import { computeReachableCells } from '@/project/lint/reachability';
import { MAP_TOOLS } from './mapTools';
import { CONSTRUCTION_TOOLS_V3 } from './v3/constructionTools';
import { SHARED_OBJECT_TOOLS } from './sharedObjectTools';
import { ToolError, type ToolExecResult } from './types';
import { installBeodeulArchitecture } from '@/project/defaults/beodeulArchitecture';

export const SMALL_BEODEUL_HOUSES=[
  {kit:'bd-house-village-cream',form:'원본 회벽·목골 별채 집',x:4,y:3},
  {kit:'bd-house-village-brick',form:'원본 회벽·목골 이층집',x:17,y:2},
  {kit:'bd-house-village-stone',form:'원본 사암 돌벽 박공집',x:30,y:5},
  {kit:'bd-house-village-sage',form:'원본 회벽·목골 ㄱ자집',x:5,y:18},
  {kit:'bd-house-village-ochre',form:'원본 회벽·목골 낮은 집',x:27,y:20},
] as const;

export function buildSmallBeodeulVillage(project:Project,args:Record<string,unknown>):ToolExecResult {
  const count=Number(args.houseCount);
  if(!Number.isInteger(count)||count<3||count>5) throw new ToolError('소규모 잔디 마을은 집 3~5채를 지정합니다.');
  if(args.theme&&!['river','city'].includes(String(args.theme))) throw new ToolError('소규모 배치는 밝은 잔디 마을 전용입니다. 기후/포구는 houseCount 없이 해당 theme을 사용하세요.');
  installBeodeulArchitecture(project);
  const ts=project.tilesets.beodeul_city;
  if(!ts) throw new ToolError('버들항 타일셋이 없습니다.');
  const kits=new Map((ts.structureKits??[]).map(k=>[k.id,k]));
  for(const h of SMALL_BEODEUL_HOUSES.slice(0,count)) if(!kits.has(h.kit)) throw new ToolError(`필요한 집 키트가 없습니다: ${h.kit}`);
  const width=Math.max(40,Math.min(48,Number(args.width??40))),height=Math.max(30,Math.min(38,Number(args.height??30)));
  if(!Number.isInteger(width)||!Number.isInteger(height)) throw new ToolError('맵 크기는 정수입니다.');
  const create=MAP_TOOLS.find(t=>t.name==='create_map')!,fill=CONSTRUCTION_TOOLS_V3.find(t=>t.name==='fill_region')!;
  const stampTool=SHARED_OBJECT_TOOLS.find(t=>t.name==='stamp_object')!;
  let mapId=String(args.mapId??'');
  if(mapId){
    const existing=project.maps[mapId];
    if(!existing||existing.tilesetId!=='beodeul_city'||existing.width<40||existing.height<30)
      throw new ToolError('기존 대상은 40×30 이상 버들항 맵이어야 합니다.');
  } else {
    mapId=String(args.id??'map_beodeul_small_village');
    if(!args.id){let n=2;while(project.maps[mapId])mapId=`map_beodeul_small_village_${n++}`;}
    create.run(project,{id:mapId,name:String(args.name??'버들 작은 마을'),width,height,tilesetId:'beodeul_city',border:'none'});
  }
  const m=project.maps[mapId]!,ox=Math.floor((m.width-40)/2),oy=Math.floor((m.height-30)/2);
  fill.run(project,{mapId,rect:{x:0,y:0,w:m.width,h:m.height},material:'버들항 풀밭',clearUpper:true});
  const paint=(x:number,y:number,w:number,h:number,material='버들항 길 포석')=>fill.run(project,{mapId,rect:{x:x+ox,y:y+oy,w,h},material,clearUpper:false});
  const roads=new Set<number>();
  const path=(points:readonly (readonly [number,number])[],wide=1)=>{
    const put=(x:number,y:number)=>{for(let dy=0;dy<wide;dy++)for(let dx=0;dx<wide;dx++)if(x+dx<40&&y+dy<30)roads.add((y+dy)*40+x+dx);};
    for(let k=1;k<points.length;k++){
      const [ax,ay]=points[k-1]!,[bx,by]=points[k]!;
      const steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));
      let px=ax,py=ay;put(px,py);
      for(let n=1;n<=steps;n++){
        const x=Math.round(ax+(bx-ax)*n/steps),y=Math.round(ay+(by-ay)*n/steps);
        // Leave an elbow when both coordinates change: even the narrow trail stays 4-connected.
        if(x!==px&&y!==py)put(x,py);
        put(x,y);px=x;py=y;
      }
    }
  };
  path([[0,14],[6,14],[10,13],[14,12],[19,13],[22,15],[27,16],[33,15],[38,14]],2);
  path([[12,13],[13,17],[18,20],[20,24],[27,26],[34,27],[35,22],[35,17],[33,15]]);
  const houses=SMALL_BEODEUL_HOUSES.slice(0,count).map(h=>{
    const kit=kits.get(h.kit)!,p=kit.parts?.find(p=>p.kind==='entrance');
    if(!p) throw new ToolError(`집 입구가 없습니다: ${h.kit}`);
    const door={x:h.x+p.dx,y:h.y+p.dy+p.h};
    if(h.kit==='bd-house-village-sage')path([[door.x,door.y],[14,26],[14,21],[18,20]]);
    else if(h.kit==='bd-house-village-ochre')path([[door.x,door.y],[27,26]]);
    else path([[door.x,door.y],[door.x,h.kit==='bd-house-village-brick'?13:15]]);
    return {...h,x:h.x+ox,y:h.y+oy,width:kit.width,height:kit.height,door:{x:door.x+ox,y:door.y+oy}};
  });
  // Paint each contiguous run once; every bend uses the chipset's real road autotile.
  for(let y=0;y<30;y++)for(let x=0;x<40;x++)if(roads.has(y*40+x)){
    const start=x;while(x+1<40&&roads.has(y*40+x+1))x++;
    paint(start,y,x-start+1,1);
  }
  paint(17,16,7,3,'버들항 광장 판석');
  const placed:Array<{kit:string;x:number;y:number;kind:string}>=[];
  const stamp=(id:string,x:number,y:number,kind='prop')=>{
    const k=kits.get(id);if(!k)return false;
    const tx=x+ox,ty=y+oy;
    if(tx<0||ty<0||tx+k.width>m.width||ty+k.height>m.height)return false;
    if(kind!=='house')for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){
      if((k.rows[dy]!.upperTiles ?? [])[dx]!<0)continue;
      const i=(ty+dy)*m.width+tx+dx;
      if(layerTileAt(m,3,i)>=0||layerTileAt(m,1,i)!==737)return false;
      if(houses.some(h=>Math.abs(h.door.x-tx-dx)+Math.abs(h.door.y-ty-dy)<=1))return false;
    }
    stampTool.run(project,{objectId:`kit:beodeul_city/${id}`,mapId,x:tx,y:ty,layers:'upper'});
    placed.push({kit:id,x:tx,y:ty,kind});return true;
  };
  for(const h of houses)stamp(h.kit,h.x-ox,h.y-oy,'house');
  // The well occupies the plaza, so stamp its real native cells directly through the same primitive.
  stampTool.run(project,{objectId:'kit:beodeul_city/bd-prop-well_roofed',mapId,x:20+ox,y:16+oy,layers:'upper'});
  placed.push({kit:'bd-prop-well_roofed',x:20+ox,y:16+oy,kind:'prop'});
  for(const [id,x,y] of [
    ['bd-prop-bench_wood',22,19],['bd-prop-flowerbox_long',1,9],['bd-prop-laundry_rack',24,7],
    ['bd-out-woodpile',13,24],['bd-prop-flowerbox_long',33,26],
    ['bd-tree-03a8f7',12,2],['bd-tree-3e8732',1,19],['bd-tree-1a786c',35,2],
    ['bd-tree-1a786c',35,24],['bd-tree-3e8732',16,26],['bd-tree-1a786c',2,11],
    ['bd-tree-03a8f7',29,1],['bd-tree-1a786c',36,8],
    ['bd-tree-f4f319',13,8],['bd-tree-37f48b',7,27],['bd-tree-f4f319',25,1],
  ] as const)stamp(id,x,y,id.startsWith('bd-tree-')?'tree':'prop');
  const entrance={x:1+ox,y:14+oy};
  const seen=computeReachableCells(project,m,entrance.x,entrance.y);
  const unreachable=houses.filter(h=>!seen.has(`${h.door.x},${h.door.y}`));
  if(unreachable.length)throw new ToolError(`집 문 앞 연결 실패: ${unreachable.map(h=>h.kit).join(', ')}`);
  return {summary:`작은 버들항 마을 ${m.width}×${m.height}, 집 ${houses.length}채·서로 다른 외형 ${houses.length}종. 굽은 큰길·마당 샛길·우물 쉼터·집 곁 살림과 나무 군락.`,
    data:{mapId,width:m.width,height:m.height,houses:houses.length,distinctHouses:houses.length,
      housePlacements:houses,doors:houses.map(h=>({...h.door,kit:h.kit,reached:true})),entrance,
      start:{x:18+ox,y:17+oy},placements:placed,theme:'grass-small',seed:Number(args.seed??7)}};
}
