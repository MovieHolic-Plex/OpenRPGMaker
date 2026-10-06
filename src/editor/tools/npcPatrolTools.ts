import type { ToolDefinition, JsonSchema } from './types';
import { ToolError } from './types';
import type { Project, GameMap, Dir } from '@/project/types';
import { canMove } from '@/project/collision';
import { eventAlwaysBlocks, eventsCutOffBy } from '@/project/eventPassageBlock';
const directions:Record<Dir,readonly[number,number]>={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const schema=(properties:Record<string,JsonSchema>,required:string[]):JsonSchema=>({type:'object',additionalProperties:false,properties,required});
function commandsVisit(commands:readonly unknown[],visit:(command:Record<string,unknown>)=>void):void{
  for(const raw of commands){if(!raw||typeof raw!=='object')continue;const command=raw as Record<string,unknown>;visit(command);for(const value of Object.values(command)){if(Array.isArray(value))commandsVisit(value,visit);else if(value&&typeof value==='object')for(const inner of Object.values(value))if(Array.isArray(inner))commandsVisit(inner,visit);}}
}
function protectedCells(p:Project,map:GameMap):{x:number;y:number}[]{
  const cells:{x:number;y:number}[]=[];
  if(map.id===p.startMapId)cells.push(p.startPos);
  for(const source of Object.values(p.maps))for(const event of source.events)for(const page of event.pages??[])commandsVisit(page.commands,command=>{
    if(command.kind==='transfer'){
      if(source.id===map.id)cells.push({x:event.x,y:event.y});
      if(command.mapId===map.id&&typeof command.x==='number'&&typeof command.y==='number')cells.push({x:command.x,y:command.y});
    }
  });
  for(const event of map.events)if(event.name?.includes('표지')||event.name?.includes('안내'))cells.push({x:event.x,y:event.y});
  return cells;
}
export const NPC_PATROL_TOOLS:readonly ToolDefinition[]=[
 {name:'read_npc_layout',description:'실제 NPC 좌표·그림 칸·이동·통로 차단을 조회. 배치 전에 읽고 이야기 인물과 생활 주민을 구분한다.',mode:'read',parameters:schema({mapId:{type:'string'}},[]),run:(p,args)=>{
   const maps=args.mapId?[p.maps[String(args.mapId)]]:Object.values(p.maps);if(maps.some(m=>!m))throw new ToolError('맵 없음.',{code:'invalid-args'});
   return {summary:'NPC의 실제 저작 좌표와 이동 설정입니다. 출하 재생은 별도로 확인하세요.',data:maps.map(map=>({mapId:map.id,name:map.name,npcs:map.events.filter(e=>e.pages?.some(page=>page.graphic.sprite!==undefined&&!page.graphic.transparent)).map(e=>({id:e.id,name:e.name,x:e.x,y:e.y,pages:e.pages?.map(page=>({id:page.id,graphic:page.graphic,movement:page.movement})),cutOffEventIds:eventsCutOffBy(p,map,e).map(other=>other.id)}))}))};
 }},
 {name:'configure_npc_patrol',description:'기존 생활 NPC에 안전한 닫힌 순찰 경로를 저작. 모든 걸음의 실제 양방향 충돌·넓은 통행·출입구/시작점 보호·다른 NPC를 검사. 플레이어가 막으면 기다리며 건너뛰지 않음. 교수/상인/스토리 NPC에 무분별하게 적용 금지.',mode:'write',preservesAuthoredRaster:true,parameters:schema({mapId:{type:'string'},eventId:{type:'string'},x:{type:'integer'},y:{type:'integer'},directions:{type:'array',items:{type:'string',enum:['up','down','left','right']}},intervalMs:{type:'integer',minimum:800,maximum:5000}},['mapId','eventId','directions']),run:(p,args)=>{
   const map=p.maps[String(args.mapId)],event=map?.events.find(e=>e.id===args.eventId);if(!map||!event||!event.pages?.length)throw new ToolError('실제 NPC 없음.',{code:'invalid-args'});
   if(event.pages.length!==1||event.pages[0].conditions.length||event.pages[0].commands.some(command=>command.kind!=='text'))throw new ToolError('조건부 이야기/거래/전투 NPC의 이동은 이 도구로 덮지 않습니다. 단일 대사 페이지 생활 주민을 선택하세요.',{code:'protected-npc'});
   const route=args.directions;if(!Array.isArray(route)||route.length<2||route.length>12||route.some(dir=>typeof dir!=='string'||!Object.hasOwn(directions,dir)))throw new ToolError('순찰은 2..12 방향의 닫힌 경로입니다.',{code:'invalid-args'});
   const x=args.x===undefined?event.x:Number(args.x),y=args.y===undefined?event.y:Number(args.y),interval=args.intervalMs===undefined?1600:Number(args.intervalMs);
   if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!Number.isSafeInteger(interval)||interval<800||interval>5000)throw new ToolError('좌표/걷기 간격 오류.',{code:'invalid-args'});
   if(event.pages.some(page=>!page.graphic.sprite||page.graphic.transparent===true||(page.footprint?.width??1)!==1||(page.footprint?.height??1)!==1))throw new ToolError('이 도구는 1칸 사람 NPC에 사용합니다.',{code:'invalid-args'});
   const occupied=new Set<string>();
   for(const other of map.events){
     if(other.id===event.id)continue;
     if(eventAlwaysBlocks(other))occupied.add(`${other.x},${other.y}`);
     // Reserve every cell of another closed patrol, not just its initial position.
     for(const page of other.pages??[]){
       if(page.movement.type!=='custom'||!page.movement.route?.repeat)continue;
       let current={x:other.x,y:other.y};occupied.add(`${current.x},${current.y}`);
       for(const move of page.movement.route.moves){if(move.kind==='wait')continue;if(move.kind!=='move'||!Object.hasOwn(directions,move.dir))break;const [dx,dy]=directions[move.dir];current={x:current.x+dx,y:current.y+dy};occupied.add(`${current.x},${current.y}`);}
     }
   }
   const protectedAt=protectedCells(p,map),cells=[{x,y}];let at={x,y};
   for(const dir of route as Dir[]){const [dx,dy]=directions[dir],next={x:at.x+dx,y:at.y+dy};if(!canMove(p,map,at.x,at.y,next.x,next.y)||!canMove(p,map,next.x,next.y,at.x,at.y))throw new ToolError('벽/지형을 가로지르는 순찰입니다.',{code:'unsafe-patrol'});cells.push(next);at=next;}
   if(at.x!==x||at.y!==y)throw new ToolError('출발점으로 돌아오는 순찰이어야 합니다.',{code:'unsafe-patrol'});
   for(const cell of cells){
     if(cell.x<2||cell.y<2||cell.x>=map.width-2||cell.y>=map.height-2||protectedAt.some(entry=>Math.abs(entry.x-cell.x)+Math.abs(entry.y-cell.y)<=2))throw new ToolError('출입구/시작점/안내 주변 보호 구역입니다: '+JSON.stringify({cell,near:protectedAt.filter(entry=>Math.abs(entry.x-cell.x)+Math.abs(entry.y-cell.y)<=2)}),{code:'unsafe-patrol'});
     if(Object.values(directions).filter(([dx,dy])=>canMove(p,map,cell.x,cell.y,cell.x+dx,cell.y+dy)).length<3)throw new ToolError('좁은 통로에서 순찰할 수 없습니다.',{code:'unsafe-patrol'});
     if(occupied.has(`${cell.x},${cell.y}`))throw new ToolError('다른 NPC 또는 순찰 경유 칸과 겹칩니다.',{code:'unsafe-patrol'});
     const candidate={...event,x:cell.x,y:cell.y};const cut=eventsCutOffBy(p,map,candidate);if(cut.length)throw new ToolError('다른 이벤트에 닿지 못하는 순찰입니다: '+cut.map(other=>other.id).join(','),{code:'unsafe-patrol'});
   }
   event.x=x;event.y=y;for(const page of event.pages)page.movement={type:'custom',speed:2,frequency:2,moveIntervalMs:interval,route:{repeat:true,skippable:false,moves:[...(route as Dir[]).map(dir=>({kind:'move' as const,dir})),{kind:'wait' as const}]}};
   return {summary:'출입구를 피하는 닫힌 순찰을 저장했습니다. 막힌 걸음은 기다립니다.',data:{mapId:map.id,eventId:event.id,cells,intervalMs:interval,nativePlaybackVerified:false}};
 }},
];
