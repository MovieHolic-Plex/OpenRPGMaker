import catalog from '@/assets/beodeulArchitectureCatalog.json';
import { installBeodeulArchitecture } from '@/project/defaults/beodeulArchitecture';
import { layerTileAt, setLayerTileAt } from '@/project/mapLayers';
import type { Project, StructureKitDef } from '@/project/types';
import { computeReachableCells } from '@/project/lint/reachability';
import { MAP_TOOLS } from './mapTools';
import { CONSTRUCTION_TOOLS_V3 } from './v3/constructionTools';
import { SHARED_OBJECT_TOOLS } from './sharedObjectTools';
import { dressBeodeulGround } from './beodeulGroundTools';
import { ToolError, type ToolDefinition } from './types';

export function addBeodeulVillageChurch(project:Project,mapId:string){
  const map=project.maps[mapId];
  if(!map||map.tilesetId!=='beodeul_city'||map.width<40||map.height<30)throw new ToolError('40×30 이상 버들항 마을이 필요합니다.');
  installBeodeulArchitecture(project);
  const target=project.tilesets.beodeul_city!;
  const kit=target.structureKits!.find(k=>k.id==='bd-house-village-church')!;
  const x=41,y=3,front={x:48,y:16};
  const already=map.width>=53&&kit.rows.every((r,dy)=>(r.upperTiles ?? []).every((n,dx)=>n<0||layerTileAt(map,3,(y+dy)*map.width+x+dx)===n));
  if(already)return{front,alreadyPresent:true};
  if(map.width>40)for(let ty=1;ty<30;ty++)for(let tx=40;tx<Math.min(map.width,54);tx++){
    const i=ty*map.width+tx;
    if(layerTileAt(map,1,i)!==737||[2,3,4].some(l=>layerTileAt(map,l as 2|3|4,i)>=0)
      ||map.events.some(e=>e.x===tx&&e.y===ty)||map.relief?.levels[i])
      throw new ToolError('교회 예정지 오른쪽 띠에 기존 콘텐츠가 있습니다. 새 배치 또는 빈 14칸 띠가 필요합니다.');
  }
  if(map.width<54)MAP_TOOLS.find(t=>t.name==='resize_map')!.run(project,{mapId,width:54,height:map.height});
  const fill=CONSTRUCTION_TOOLS_V3.find(t=>t.name==='fill_region')!;
  fill.run(project,{mapId,rect:{x:40,y:0,w:14,h:map.height},material:'버들항 풀밭',clearUpper:false});
  // Turn south before the tower; the horizontal street cannot run through its front wall.
  fill.run(project,{mapId,rect:{x:38,y:14,w:3,h:4},material:'버들항 길 포석',clearUpper:false});
  fill.run(project,{mapId,rect:{x:40,y:16,w:12,h:4},material:'버들항 광장 판석',clearUpper:false});
  const stamp=SHARED_OBJECT_TOOLS.find(t=>t.name==='stamp_object')!;
  stamp.run(project,{mapId,objectId:'kit:beodeul_city/bd-house-village-church',x,y,layers:'upper'});
  for(const [objectId,px,py] of [['bd-prop-bench_wood',45,20],['bd-tree-1a786c',43,23],['bd-tree-1a786c',50,23]] as const)
    stamp.run(project,{mapId,objectId:`kit:beodeul_city/${objectId}`,x:px,y:py,layers:'upper'});
  const start=project.startMapId===mapId?project.startPos:{x:18,y:17};
  if(!computeReachableCells(project,map,start.x,start.y).has(`${front.x},${front.y}`))throw new ToolError('교회 문 앞이 기존 길과 연결되지 않았습니다.');
  return{front,alreadyPresent:false};
}

export const BEODEUL_ARCHITECTURE_TOOLS:readonly ToolDefinition[]=[{
  name:'refine_beodeul_village',mode:'write',domains:['map','tile'],preservesAuthoredRaster:true,
  description:'기존 작은 버들항 마을의 원본 집과 성당의 지붕·윤곽·도트 질감을 보존하고 중복 문과 창문·벽 일부만 고친다. 측면은 필수가 아니다. 집당 문 1개·벽 재질/색 콘셉트 1개와 공용 접지 기초를 적용한다. 원래 집 좌표·길·나무·꾸밈·이벤트는 보존한다. church:true이면 비어 있는 오른쪽에 석조 교회와 마당을 추가하며 폭 54칸까지 넓힌다. 정확한 원본 또는 이전 공용 보정 키트 전체 배열만 바꾸며 임의 편집된 집이나 이벤트가 붙은 집은 거부한다. 참고문서 beodeul-ground-dressing의 3/4 건물 사전과 그림을 먼저 읽는다.',
  parameters:{type:'object',properties:{mapId:{type:'string'},church:{type:'boolean'}},required:['mapId'],additionalProperties:false},
  run(project,args){
    const map=project.maps[String(args.mapId)],ts=map&&project.tilesets[map.tilesetId];
    if(!map||ts?.id!=='beodeul_city')throw new ToolError('버들항 맵이 필요합니다.');
    const previousKits=new Map((ts.structureKits??[]).filter(k=>k.id.startsWith('bd-house-village-')).map(k=>[k.id,structuredClone(k)]));
    installBeodeulArchitecture(project);
    const grafts=new Map(ts.tileGrafts?.map(g=>[g.targetTile,g]));
    const native=(n:number)=>{const g=grafts.get(n);return g?.sourceChipset==='tex_beodeul_city'?g.sourceTile:n;};
    const changed=[];
    for(const b of catalog.buildings){
      const next=ts.structureKits!.find(k=>k.id===b.id)!;
      const candidates=[previousKits.get(b.id),ts.structureKits!.find(k=>k.id===b.sourceKit)].filter((k):k is StructureKitDef=>!!k);
      for(const old of candidates){
      const normalized=old.id===b.sourceKit?native:(n:number)=>n;
      const first=old.rows.flatMap((r,y)=>(r.upperTiles ?? []).map((n,x)=>({n,x,y}))).find(p=>p.n>=0)!;
      for(let i=0;i<map.width*map.height;i++)if(normalized(layerTileAt(map,3,i))===first.n){
        const x=i%map.width-first.x,y=Math.floor(i/map.width)-first.y;
        if(x<0||y<0||x+old.width>map.width||y+old.height>map.height)continue;
        if(!old.rows.every((r,dy)=>(r.upperTiles ?? []).every((n,dx)=>n<0||normalized(layerTileAt(map,3,(y+dy)*map.width+x+dx))===n)))continue;
        if(next.rows.some((r,dy)=>(r.upperTiles ?? []).some((n,dx)=>n>=0&&(old.rows[dy]!.upperTiles ?? [])[dx]!<0&&layerTileAt(map,3,(y+dy)*map.width+x+dx)>=0)))
          throw new ToolError('새 지붕 면이 들어갈 칸에 기존 그림이 있습니다. 기존 그림을 보존하기 위해 보정을 취소합니다.');
        if(map.events.some(e=>e.x>=x&&e.x<x+old.width&&e.y>=y&&e.y<=y+old.height))throw new ToolError('출입 이벤트가 있는 집은 이 외장 보정에서 제외합니다.');
        for(let dy=0;dy<old.height;dy++)for(let dx=0;dx<old.width;dx++){
          const at=(y+dy)*map.width+x+dx;
          if((old.rows[dy]!.upperTiles ?? [])[dx]!>=0||(next.rows[dy]!.upperTiles ?? [])[dx]!>=0)setLayerTileAt(map,3,at,(next.rows[dy]!.upperTiles ?? [])[dx]!);
        }
        // Remove only the older, flat foundation underneath this house, including its grass row.
        for(let dy=0;dy<=old.height;dy++)for(let dx=0;dx<old.width;dx++){
          const at=(y+dy)*map.width+x+dx,g=grafts.get(layerTileAt(map,4,at));
          if(g?.sourceChipset==='tex_beodeul_ground'&&g.sourceTile>=21&&g.sourceTile<=32)setLayerTileAt(map,4,at,-1);
        }
        changed.push({kit:b.id,x,y,concept:b.concept,windowStyle:b.windowStyle,doors:1});
      }
      }
    }
    const church=args.church===true?addBeodeulVillageChurch(project,map.id):undefined;
    const dressing=dressBeodeulGround(project,map.id);
    return{summary:`버들항 집 ${changed.length}채를 원본 지붕·윤곽을 보존하며 문 1개·개별 창문·기초로 보정${church?'하고 석조 교회를 연결했습니다.':'.'}`,
      data:{mapId:map.id,changed,church,dressing:dressing.data}};
  },
}];
