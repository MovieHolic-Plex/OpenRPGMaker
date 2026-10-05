import { inspectWorldAtlas } from '@/project/worldAtlasAudit';
import { canMove, isPassable } from '@/project/collision';
import { setLayerTileAt } from '@/project/mapLayers';
import { ensureAtlasCartographyTerrain } from '@/project/defaults/atlasCartography';
import {atlasRoomDimensions} from '@/project/worldAtlasGeometry';
import {paintAtlasLandscape,fieldTerrain,worldTerrain,atlasRoad,atlasLandmark,paintAtlasRoom} from './atlasLandscape';
import { WORLD_ATLAS_CATALOG, type WorldAtlas, type WorldAtlasStructure, type WorldAtlasNode, type AtlasPoint, type AtlasNodeKind } from '@/project/worldAtlas';
import type { Command, GameEvent, GameMap, Project } from '@/project/types';

type Spec = { name: string; kind: AtlasNodeKind; x: number; y: number; grants?: number[] };
type Link = [number, number, number?, boolean?];
export interface AtlasAuthorRequest { id: string; name?: string; structure: WorldAtlasStructure; seed: number; overworldMapId?: string }

function recipe(structure: WorldAtlasStructure): { specs: Spec[]; links: Link[]; abilities: string[]; width: number; height: number } {
  if (structure === 'region-routes') return {
    width: 120, height: 84, abilities: ['물길 통행증'],
    specs: [
      {name:'새싹 마을',kind:'town',x:12,y:57}, {name:'1번 도로',kind:'route',x:34,y:57},
      {name:'솔바람 시티',kind:'town',x:55,y:57,grants:[0]}, {name:'2번 도로',kind:'route',x:55,y:34},
      {name:'호수 마을',kind:'town',x:78,y:34}, {name:'물결 도로',kind:'route',x:78,y:13},
      {name:'별빛 리그',kind:'town',x:100,y:13}, {name:'숲샛길',kind:'route',x:34,y:34},
    ], links: [[0,1],[1,2],[2,3],[3,4],[4,5,0],[5,6],[1,7],[7,3]],
  };
  if (structure === 'field-overview') return {
    width: 120, height: 90, abilities: ['수문 열쇠','유적 열쇠'],
    specs: ['북서 숲','산길','고대 성문','서쪽 강변','중앙 들판','동쪽 호수','시작 마을','나루터','묻힌 신전'].map((name,i)=>
      ({name,kind:i===6?'town':i===8?'dungeon':'field',x:(i%3)*40,y:Math.floor(i/3)*30,grants:i===0?[0]:i===2?[1]:[]})),
    links: [[6,3],[3,0],[0,1],[1,2],[3,4],[4,1],[6,7],[7,4],[4,5,0],[5,2],[7,8,1],[8,5,1]],
  };
  if (structure === 'stage-nodes') return {
    width: 120, height: 84, abilities: ['숲의 비밀 출구'],
    specs: [
      {name:'새싹 언덕',kind:'stage',x:10,y:58}, {name:'개울길',kind:'stage',x:30,y:58},
      {name:'햇살 숲',kind:'stage',x:48,y:42,grants:[0]}, {name:'호수 요새',kind:'stage',x:76,y:42},
      {name:'돌 고개',kind:'stage',x:96,y:26}, {name:'별빛 성',kind:'stage',x:96,y:10},
      {name:'비밀 섬',kind:'stage',x:30,y:20}, {name:'무지개 샛길',kind:'stage',x:63,y:12},
    ], links:[[0,1,-1],[1,2,-2],[2,3,-3],[3,4,-4],[4,5,-5],[2,6,0,true],[6,7,-7],[7,5,-8]],
  };
  if (structure === 'room-network') return {
    width: 120, height: 90, abilities: ['봉인 해제','깊은 성소 열쇠'],
    specs: [
      {name:'지상의 우물',kind:'room',x:9,y:4}, {name:'잊힌 교차로',kind:'room',x:9,y:32},
      {name:'순례자의 방',kind:'room',x:35,y:32,grants:[0]}, {name:'푸른 회랑',kind:'room',x:61,y:35},
      {name:'바람의 탑',kind:'room',x:66,y:1,grants:[1]}, {name:'이끼 저장고',kind:'room',x:9,y:55},
      {name:'깊은 수로',kind:'room',x:35,y:55}, {name:'침묵의 서고',kind:'room',x:61,y:55},
      {name:'어둠의 관문',kind:'room',x:87,y:55}, {name:'깊은 성소',kind:'room',x:87,y:75},
    ], links:[[0,1],[1,2],[2,3,0],[3,4],[1,5],[5,6],[6,7,0],[7,3],[7,8,1],[8,9],[4,8,1,true]],
  };
  if (structure === 'run-path') {
    const specs: Spec[] = [{name:'출발 캠프',kind:'camp',x:55,y:75}];
    const rows: AtlasNodeKind[][] = [['battle','event','battle'],['treasure','elite','shop'],['camp','battle','event'],['elite','camp'],['boss']];
    const labels: Record<string,string>={battle:'전투',event:'사건',treasure:'보물',elite:'정예',shop:'상점',camp:'휴식',boss:'최종 관문'};
    rows.forEach((row,r)=>row.forEach((kind,c)=>specs.push({name:`${r+1}층 ${labels[kind]}`,kind,x:row.length===1?55:row.length===2?35+c*40:15+c*40,y:62-r*13})));
    return {width:120,height:90,abilities:[],specs,links:[[0,1,-1],[0,2,-1],[0,3,-1],[1,4,-2],[1,5,-2],[2,5,-3],[2,6,-3],[3,6,-4],[4,7,-5],[4,8,-5],[5,8,-6],[6,8,-7],[6,9,-7],[7,10,-8],[8,10,-9],[8,11,-9],[9,11,-10],[10,12,-11],[11,12,-12]]};
  }
  return {width:96,height:72,abilities:['옛 성문 열쇠'],specs:[],links:[]};
}

function blankMap(id: string, name: string, width=40, height=30, dungeon=false): GameMap {
  return {id,name,width,height,tilesetId:'atlas_cartography',tileSize:32,
    lowerTiles:new Array<number>(width*height).fill(dungeon?47:0),upperTiles:new Array<number>(width*height).fill(-1),events:[],
    mapRole:dungeon?'dungeon':'field',encounterRate:0,minimap:{enabled:true}};
}
function addSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some(s=>s.id===id)) project.switches.push({id,name});
}
function event(map: GameMap, id: string, name: string, p: AtlasPoint, commands: Command[], touch=false, sprite?: GameEvent['sprite']): GameEvent {
  const trigger = {kind:touch?'playerTouch':'action'} as GameEvent['trigger'];
  const e: GameEvent = {id,name,...p,trigger,commands,pages:[{id:id+'_page',name,conditions:[],graphic:sprite?{sprite,direction:'down',pattern:1}:{transparent:true},
    priority:touch?'below':'same',trigger,movement:{type:'fixed',speed:3,frequency:3},commands}]};
  map.events.push(e); return e;
}
function gated(commands: Command[], requires: string[], atlas: WorldAtlas): Command[] {
  if (!requires.length) return commands;
  return [{kind:'fork',condition:{kind:'all',conditions:requires.map(switchId=>({kind:'switch',switchId,value:true}))},then:commands,
    else:[{kind:'text',body:`아직 열린 길이 아닙니다. 필요: ${requires.map(id=>atlas.abilities.find(a=>a.switchId===id)?.name??'앞 관문 클리어').join(' · ')}`}]}];
}
function fieldExit(map: GameMap, from: WorldAtlasNode, to: WorldAtlasNode): AtlasPoint {
  const dx=to.x-from.x,dy=to.y-from.y;
  if(Math.abs(dx)>Math.abs(dy)) return {x:dx>0?map.width-1:0,y:Math.floor(map.height/2)};
  return {x:Math.floor(map.width/2),y:dy>0?map.height-1:0};
}
function nearestOpen(project: Project,map: GameMap,p: AtlasPoint): AtlasPoint {
  let best: AtlasPoint | undefined, distance=Infinity;
  for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)if(isPassable(project,map,x,y)) {
    const d=Math.abs(x-p.x)+Math.abs(y-p.y);if(d<distance){best={x,y};distance=d;}
  }
  if(!best)throw new Error('열린 입구가 없는 맵: '+map.id);return best;
}
function reachableDoor(project: Project,map: GameMap,from: AtlasPoint,target: AtlasPoint): AtlasPoint {
  const seen=new Set([from.y*map.width+from.x]),queue=[from];let best=from,distance=Infinity;
  for(let i=0;i<queue.length;i++){const p=queue[i]!,d=Math.abs(p.x-target.x)+Math.abs(p.y-target.y);if(d<distance){distance=d;best=p;}
    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx!,y=p.y+dy!,k=y*map.width+x;
      if(x<0||y<0||x>=map.width||y>=map.height||seen.has(k)||!canMove(project,map,p.x,p.y,x,y))continue;seen.add(k);queue.push({x,y});}}
  return best;
}
function doorLanding(project:Project,map:GameMap,door:AtlasPoint,home:AtlasPoint):AtlasPoint{
  const points=[{x:door.x+1,y:door.y},{x:door.x-1,y:door.y},{x:door.x,y:door.y+1},{x:door.x,y:door.y-1}];
  const p=points.filter(p=>canMove(project,map,door.x,door.y,p.x,p.y)&&!map.events.some(e=>e.x===p.x&&e.y===p.y))
    .sort((a,b)=>(Math.abs(a.x-home.x)+Math.abs(a.y-home.y))-(Math.abs(b.x-home.x)+Math.abs(b.y-home.y)))[0];
  if(!p)throw new Error('출입구 착지 칸이 없습니다: '+map.id);return p;
}

export function authorWorldAtlas(project: Project, request: AtlasAuthorRequest): WorldAtlas {
  if (!/^[a-z][a-z0-9_-]{0,60}$/.test(request.id)) throw new Error('지도 id는 영문 소문자로 시작하는 1~61자입니다.');
  if(project.worldAtlases?.some(a=>a.id===request.id)||Object.keys(project.maps).some(id=>id.startsWith(request.id+'_')&&id!==request.overworldMapId))throw new Error('이미 있는 지도 id입니다: '+request.id);
  ensureAtlasCartographyTerrain(project);
  const r=recipe(request.structure);
  const atlas: WorldAtlas={version:1,id:request.id,name:request.name??WORLD_ATLAS_CATALOG.find(c=>c.id===request.structure)!.name,
    structure:request.structure,seed:request.seed,width:r.width,height:r.height,startNodeId:request.id+'_n0',nodes:[],edges:[],
    abilities:r.abilities.map((name,i)=>({name,switchId:`${request.id}_ability${i}`})),pins:[]};
  if(request.structure==='field-overview')atlas.startNodeId=request.id+'_n6';
  let specs=r.specs;
  if(request.structure==='scaled-world') {
    const world=blankMap(request.overworldMapId??request.id+'_overworld','쌍둥이 대륙',96,72);
    world.characterScale=.5;project.maps[world.id]=world;
    paintAtlasLandscape(world,request.seed,worldTerrain);
    atlas.overviewMapId=world.id;atlas.width=world.width;atlas.height=world.height;
    const places=[['모래 나루',18,54],['잎새 마을',28,37],['눈빛 관문',24,17],['고원 수도',44,16],['호수 항구',47,39],['돌빛 탑',70,32],['새벽 성',77,17],['동쪽 유적',69,49]] as const;
    specs=places.map(([name,x,y],i)=>({name,kind:i===5||i===7?'dungeon':'town',x,y,grants:i===1?[0]:[]}));
    r.links=places.slice(1).map((_,i)=>[i,i+1,i===2?0:undefined]);
    for(let i=0;i<places.length;i++){
      const [,x,y]=places[i]!,icon=[0,1,6,3,2,5,3,4][i]!;
      if(i>0){const [,ax,ay]=places[i-1]!;atlasRoad(world,{x:ax,y:ay},{x,y});}
      atlasLandmark(world,icon,x-1,y-3);
      atlasRoad(world,{x,y},{x,y:y+2},1);
      (specs[i] as Spec&{worldEntrance:AtlasPoint}).worldEntrance={x,y};
    }
  }
  const compact=['room-network','run-path','stage-nodes'].includes(request.structure);
  specs.forEach((spec,i)=>{
    const dims=request.structure==='room-network'?atlasRoomDimensions(i):{width:request.structure==='stage-nodes'?64:40,height:compact?24:30};
    const map=blankMap(`${request.id}_map${i}`,spec.name,dims.width,dims.height,compact||spec.kind==='dungeon');
    project.maps[map.id]=map;
    const node: WorldAtlasNode={id:`${request.id}_n${i}`,name:spec.name,mapId:map.id,kind:spec.kind,
      x:spec.x,y:spec.y,w:request.structure==='field-overview'?40:request.structure==='room-network'?[15,24,19,24,13,22,27,24,15,24][i]!:6,h:request.structure==='field-overview'?30:request.structure==='room-network'?[19,14,17,12,29,16,11,18,16,13][i]!:6,
      entry:{x:2,y:compact?map.height-3:Math.floor(map.height/2)},visitSwitchId:`${request.id}_visit${i}`,clearSwitchId:`${request.id}_clear${i}`,
      grants:(spec.grants??[]).map(n=>atlas.abilities[n]!.switchId),
      ...(request.structure==='room-network'?{roomShape:i}:{}),
      ...('worldEntrance'in spec?{worldEntrance:(spec as Spec&{worldEntrance:AtlasPoint}).worldEntrance}:{})};
    atlas.nodes.push(node);addSwitch(project,node.visitSwitchId,`${atlas.name} · ${node.name} 발견`);addSwitch(project,node.clearSwitchId,`${atlas.name} · ${node.name} 클리어`);
    const pin={nodeId:node.id,switchId:`${request.id}_pin${i}`};atlas.pins.push(pin);addSwitch(project,pin.switchId,`${node.name} 지도 핀`);
  });
  atlas.abilities.forEach(a=>addSwitch(project,a.switchId,`${atlas.name} · ${a.name}`));
  r.links.forEach(([from,to,gate,secret],i)=>atlas.edges.push({id:`${request.id}_edge${i}`,from:atlas.nodes[from]!.id,to:atlas.nodes[to]!.id,
    requires:gate===undefined?[]:gate<0?[atlas.nodes[-gate-1]!.clearSwitchId]:[atlas.abilities[gate]!.switchId],
    oneWay:request.structure==='run-path',...(secret?{secret:true}:{})}));
  // A new map must already belong to the tree before calling existing-map authoring facades.
  project.mapTree.children??=[];
  project.mapTree.children.push({mapId:`${request.id}_folder`,kind:'folder',name:atlas.name,children:atlas.nodes.map(node=>({mapId:node.mapId,children:[]}))});
  // Separate maps use genuine doors. Stage and run atlases choose destinations through guarded UI.
  const physical=['region-routes','field-overview','room-network'].includes(request.structure);
  for(const node of atlas.nodes){let map=project.maps[node.mapId]!;
    const index=atlas.nodes.indexOf(node);
    if(compact){
      paintAtlasRoom(map,index);
      if(request.structure==='stage-nodes'){
        // Actual platform courses: open sky, stone ground and staggered low platforms.
        for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
          setLayerTileAt(map,1,y*map.width+x,y>=map.height-2?55:63);setLayerTileAt(map,3,y*map.width+x,-1);
        }
        for(let x=9;x<map.width-8;x+=10)for(let dx=0;dx<6;dx++)setLayerTileAt(map,1,(map.height-4-index%2)*map.width+x+dx,55);
      }
    }else{
      if(request.structure==='field-overview')paintAtlasLandscape(map,request.seed,fieldTerrain,node.x,node.y);
      else paintAtlasLandscape(map,request.seed+index,(x,y)=>{
        if(x>map.width-9&&index%3===1)return 'water';
        if(y<5&&index%3===2)return 'stone';
        if(x<9||y<7||x>map.width-5)return 'forest';
        return 'grass';
      });
      const home={x:Math.floor(map.width/2),y:Math.floor(map.height/2)};
      const neighbours=atlas.edges.flatMap(e=>e.from===node.id?[atlas.nodes.find(n=>n.id===e.to)!]:e.to===node.id?[atlas.nodes.find(n=>n.id===e.from)!]:[]);
      for(const neighbour of neighbours)atlasRoad(map,home,fieldExit(map,node,neighbour));
      atlasRoad(map,home,{x:home.x+4,y:home.y},2);
      if(node.kind==='town')atlasLandmark(map,index%2,home.x-2,home.y-5);
      if(node.kind==='dungeon')atlasLandmark(map,4,home.x-1,home.y-4);
      if(request.structure==='field-overview'&&index===2)atlasLandmark(map,6,home.x-2,home.y-5);
      node.entry=nearestOpen(project,map,home);
    }
    // Clearing is an actual interactable goal; merely opening the atlas never grants rewards.
    const goal=compact?{x:map.width-6,y:map.height-3}:nearestOpen(project,map,{x:Math.floor(map.width/2)+2,y:Math.floor(map.height/2)});
    const earned=request.structure==='stage-nodes'&&atlas.nodes.indexOf(node)===2?[]:node.grants;
    const grant: Command[]=[{kind:'setSwitch',switchId:node.clearSwitchId,value:true},...earned.map(switchId=>({kind:'setSwitch',switchId,value:true} as Command))];
    if(node.kind==='camp')grant.push({kind:'recoverAll'});
    let ready: Command[]=[...grant,{kind:'text',body:earned.length?`${node.name} — ${earned.map(id=>atlas.abilities.find(a=>a.switchId===id)!.name).join(' · ')} 획득. 지도에서 열린 길을 확인하세요.`:
      `${node.name} 관문을 통과했습니다.${node.kind==='camp'?' 모두 회복했습니다.':''} 지도에서 다음 길을 확인하세요.`}];
    if(request.structure==='run-path'){
      const reward: Command={kind:'changeGold',op:'+=',amount:node.kind==='elite'?80:node.kind==='treasure'?120:25};
      if(['battle','elite','boss'].includes(node.kind)){
        const troops=project.database.troops.filter(t=>t.members.length>0);
        if(!troops.length)throw new Error('런의 전투 무리가 없습니다. 전투 무리를 먼저 등록하세요.');
        const troop=troops[Math.min(node.kind==='boss'?2:node.kind==='elite'?1:0,troops.length-1)]!;
        ready=[{kind:'battleProcessing',troopId:troop.id,canEscape:true,canLose:true,branchOnResult:true,victoryBranch:[reward,...ready],
          defeatBranch:[{kind:'text',body:'관문을 통과하지 못했습니다. 회복하고 다시 도전하세요.'}],escapeBranch:[{kind:'text',body:'도주했습니다. 다음 층은 아직 열리지 않았습니다.'}]}];
      }else if(node.kind==='treasure')ready=[reward,...ready];
      else if(node.kind==='shop')ready=[{kind:'shop',itemIds:project.database.items.slice(0,4).map(item=>item.id),allowSell:true},...ready];
      else if(node.kind==='event')ready=[{kind:'choices',prompt:'숲길의 여행자가 도움을 청합니다.',options:[
        {text:'쉬어 가며 서로 치료한다',branch:[{kind:'recoverAll'},...ready]},
        {text:'물자를 받아 계속 간다 (+25G)',branch:[reward,...ready]},
      ]}];
    }
    const marker: GameEvent['sprite']={type:'bundled',id:'tex_easyrpg_charset_actor1'};
    const goalEvent=event(map,`${node.id}_goal`,`${node.name} 관문`,goal,[{kind:'fork',condition:{kind:'switch',switchId:node.clearSwitchId,value:true},then:[{kind:'text',body:'이 관문은 이미 통과했습니다.'}],else:ready}],false,marker);
    if(compact)goalEvent.pages![0]!.priority='above';
    if(request.structure==='stage-nodes'&&atlas.nodes.indexOf(node)===2){
      const p=reachableDoor(project,map,node.entry,{x:5,y:5});event(map,`${node.id}_secret`,'비밀 출구',p,[{kind:'setSwitch',switchId:atlas.abilities[0]!.switchId,value:true},{kind:'text',body:'비밀 출구를 발견했습니다. 작은 섬으로 가는 길이 열렸습니다.'}],false,marker);
    }
  }
  const doorSlots=new Map<string,Set<number>>();
  function roomDoor(map:GameMap,want:number):AtlasPoint{const used=doorSlots.get(map.id)??new Set<number>();doorSlots.set(map.id,used);
    const x=[want,20,9,29,15,25].find(x=>x>0&&x<map.width-1&&!used.has(x));if(x===undefined)throw new Error('방 출입구가 너무 많습니다.');used.add(x);return {x,y:map.height-3};}
  if(physical)for(const edge of atlas.edges){const from=atlas.nodes.find(n=>n.id===edge.from)!,to=atlas.nodes.find(n=>n.id===edge.to)!;
    const a=project.maps[from.mapId]!,b=project.maps[to.mapId]!;
    const room=request.structure==='room-network';
    const ea=room?roomDoor(a,to.x>=from.x?a.width-2:1):reachableDoor(project,a,from.entry,fieldExit(a,from,to));
    const eb=room?roomDoor(b,from.x>=to.x?b.width-2:1):reachableDoor(project,b,to.entry,fieldExit(b,to,from));
    edge.fromExit=ea;edge.toExit=eb;
    // Events cannot land on the return door: move one tile inward to stop ping-pong transfers.
    const entryA=doorLanding(project,a,ea,from.entry),entryB=doorLanding(project,b,eb,to.entry);
    if(!room){for(const [m,p]of[[a,ea],[b,eb]] as const){setLayerTileAt(m,1,p.y*m.width+p.x,4);setLayerTileAt(m,3,p.y*m.width+p.x,-1);}}
    event(a,edge.id+'_out',to.name,ea,gated([{kind:'setSwitch',switchId:to.visitSwitchId,value:true},{kind:'transfer',mapId:b.id,...entryB}],edge.requires,atlas),true);
    event(b,edge.id+'_back',from.name,eb,gated([{kind:'setSwitch',switchId:from.visitSwitchId,value:true},{kind:'transfer',mapId:a.id,...entryA}],edge.requires,atlas),true);
  }
  if(atlas.overviewMapId){const world=project.maps[atlas.overviewMapId]!;
    for(const node of atlas.nodes){const p=node.worldEntrance!,map=project.maps[node.mapId]!;
      const requires=atlas.edges.find(e=>e.to===node.id)?.requires??[];
      event(world,node.id+'_enter',node.name,p,gated([{kind:'setSwitch',switchId:node.visitSwitchId,value:true},{kind:'transfer',mapId:node.mapId,...node.entry}],requires,atlas),true);
      const back=[{x:p.x,y:p.y+1},{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1}].find(q=>canMove(project,world,p.x,p.y,q.x,q.y)&&!atlas.nodes.some(n=>n.worldEntrance?.x===q.x&&n.worldEntrance?.y===q.y));
      if(!back)throw new Error('대륙 거점의 귀환 칸이 없습니다: '+node.name);
      const door=reachableDoor(project,map,node.entry,{x:1,y:map.height-3});
      event(map,node.id+'_return','대륙으로 나가기',door,[{kind:'transfer',mapId:world.id,...back}],true);
    }
  }
  project.worldAtlases??=[];project.worldAtlases.push(atlas);
  const audit=inspectWorldAtlas(project,atlas);if(!audit.ok)throw new Error(audit.issues.join('\n'));
  return atlas;
}
