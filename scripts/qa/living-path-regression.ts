import assert from "node:assert/strict";
import { armTerrainComponents } from "@/project/tilePassabilityComponents";
import { createBlankMap, createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { store } from '@/project/store';
import { registerPageMoveRoutes } from '@/player/playScenePageMoveRoutes';
import { updateAutonomousNPCs } from '@/player/playSceneAutonomous';
import { registerAutonomousMover } from '@/player/playSceneSchedulers';
import { initialRuntimeEventPositions, runtimeEventViewById } from '@/project/runtimeEventState';
import { routeForLivingMovement, yieldingLivingMovers } from '@/player/npcLivingTravel';
import { canMoveFootprint } from '@/project/collision';
const page=(dest:any[], extra:any={})=>({id:'p',name:'p',conditions:[],graphic:{},trigger:{kind:'action'},priority:'same',commands:[],movement:{type:'living',speed:8,frequency:8,living:{destinations:dest,repeat:false}},...extra});
const ev=(id:string,x:number,y:number,p:any)=>({id,x,y,trigger:{kind:'action'},commands:[],pages:[p]});
const dest=(x:number,y:number,mapId='m')=>({mapId,x,y});
function fixture(w:number,h:number){
 const project:any=createBlankProject(); const base:any=Object.values(project.tilesets)[0];
 project.tilesets={t:{...base,id:'t',count:2,passability:[{up:true,down:true,left:true,right:true},{up:false,down:false,left:false,right:false}],priority:['lower','lower'],ledgeDirections:undefined}};
 const map:any={...createBlankMap('m',w,h,'t'),id:'m',lowerTiles:Array(w*h).fill(0),upperTiles:Array(w*h).fill(-1)};
 project.maps={m:map};project.startMapId='m'; return {project,map};
}
function sceneOf(project:any,map:any){
 store.getCurrent=()=>project;const s:any={map,session:startSession(project),eventPositions:initialRuntimeEventPositions(map.events),pageMoveRouteKeys:new Set(),pageMoveRouteEventIds:new Set(),autonomousNPCs:new Map(),eventSprites:new Map(),runtimeDom:{upsertEventMarker(){}},runEvent:async()=>{},tileX:-10,tileY:-10};
 s.registerAutonomousMover=(id:any,m:any,r:any)=>registerAutonomousMover(s,id,m,r);return s;
}
function frames(s:any,n:number){for(let i=0;i<n;i++){updateAutonomousNPCs(s,80);registerPageMoveRoutes(s)}}
function route(s:any,project:any,canStep?:any){return routeForLivingMovement({project,map:s.map,session:s.session,view:runtimeEventViewById(project,s.map,s.session,s.eventPositions,'a')!,canStep});}

function check(name:string,json:string) {const data=JSON.parse(json);switch(name) {
case 'wide-body': assert.deepEqual(data.initial,data.validRoute);assert.equal(data.after.y,4); break;
case 'arrival-refresh': assert.equal(data.secondSame,true);assert.equal(data.secondActive.elapsedMs,40); break;
case 'arrival-sprite-jump': assert.ok(data.nextStepStartX>16&&data.nextStepStartX<17); break;
case 'alternate-exit': assert.equal(data.blocked,undefined);assert.equal(data.afterReverse.mapId,'n'); break;
case 'occupied-transfer': assert.equal(data.arrival,undefined); break;
case 'pocket-deadlock': assert.equal(data.a.x,4);assert.equal(data.b.x,0); break;
case 'random-body': assert.equal(data.reachable,97);assert.equal(data.stalled,0);assert.equal(data.illegal,0); break;
case 'nonrepeat-disabled-tail': assert.deepEqual(data.visits,[1,2]);assert.equal(data.index.destinationIndex,2); break;
default: throw new Error(name);}}

export const livingPathCases: Record<string,()=>void> = {
'A wide body has a legal detour, but its initial anchor-only route enters a wall.':()=>{
 const {project,map}=fixture(6,5);map.lowerTiles[2*6+1]=1;
 map.events=[ev('a',0,0,page([dest(0,4)],{footprint:{width:2,height:1},passRows:1}))];
 const s=sceneOf(project,map);registerPageMoveRoutes(s);
 const initial=s.autonomousNPCs.get('a').moves;
 const oracle=route(s,project,(fx:number,fy:number,tx:number,ty:number)=>canMoveFootprint(project,map,fx,fy,{width:2,height:1},tx,ty,1));
 frames(s,500);check('wide-body',JSON.stringify({initial,validRoute:oracle?.moves,after:s.eventPositions.a,blocked:s.autonomousNPCs.get('a')?.blockedSteps}));
},
'Refresh once halfway through arrival at first destination, then again before landing.':()=>{
 const {project,map}=fixture(4,2);map.events=[ev('a',0,0,page([dest(1,0),dest(3,0)]))];
 const s=sceneOf(project,map);const sprite:any={x:0,y:0,texture:{key:''},setPosition(x:number,y:number){this.x=x;this.y=y},setDepth(){},setAlpha(){},setFrame(){}};s.eventSprites.set('a',sprite);registerPageMoveRoutes(s);updateAutonomousNPCs(s,80);updateAutonomousNPCs(s,40);const halfwayX=sprite.x;
 const old=s.autonomousNPCs.get('a');registerPageMoveRoutes(s);const after1=s.autonomousNPCs.get('a');registerPageMoveRoutes(s);const after2=s.autonomousNPCs.get('a');
 check('arrival-refresh',JSON.stringify({oldActive:old.activeMove,firstSame:old===after1,secondSame:old===after2,secondActive:after2?.activeMove,index:s.session.npcTravelStates.a,logical:s.eventPositions.a}));updateAutonomousNPCs(s,1);check('arrival-sprite-jump',JSON.stringify({halfwayX,nextStepStartX:sprite.x,jumpPixels:sprite.x-halfwayX}));
},
'First map edge is unreachable, second edge to the same target is usable.':()=>{
 const {project,map}=fixture(5,3);for(let y=0;y<3;y++)map.lowerTiles[y*5+2]=1;
 project.maps.n={...createBlankMap('n',3,3,'t'),id:'n',lowerTiles:Array(9).fill(0),upperTiles:Array(9).fill(-1)};
 map.events=[ev('a',0,1,page([dest(1,1,'n')]))];
 const link=(id:string,x:number)=>({id,npcEnabled:true,playerEnabled:true,from:{mapId:'m',x,y:1},to:{mapId:'n',x:1,y:1}});
 project.mapConnections=[link('unreachable',4),link('reachable',1)];const s=sceneOf(project,map);registerPageMoveRoutes(s);frames(s,100);
 const blocked=s.eventPositions.a;project.mapConnections.reverse();registerPageMoveRoutes(s);frames(s,10);
 check('alternate-exit',JSON.stringify({blocked,afterReverse:s.session.eventLocations.a}));
},
'Transfer directly into an occupied destination tile.':()=>{
 const {project,map}=fixture(3,3);const n:any={...createBlankMap('n',3,3,'t'),id:'n',lowerTiles:Array(9).fill(0),upperTiles:Array(9).fill(-1)};project.maps.n=n;
 n.events=[ev('resident',1,1,page([dest(1,1,'n')]))];map.events=[ev('a',1,1,page([dest(1,1,'n')]))];project.mapConnections=[{id:'door',npcEnabled:true,from:{mapId:'m',x:1,y:1},to:{mapId:'n',x:1,y:1}}];
 const s=sceneOf(project,map);registerPageMoveRoutes(s);frames(s,2);check('occupied-transfer',JSON.stringify({arrival:s.session.eventLocations.a,resident:n.events[0]}));
 assert.equal(s.autonomousNPCs.get('a').step,0);s.session.eventLocations.resident={mapId:'n',x:2,y:2};frames(s,2);assert.equal(s.session.eventLocations.a?.mapId,'n');
},
'A side pocket exists, but neither resident can plan to its goal through the other.':()=>{
 const {project,map}=fixture(5,3);map.lowerTiles.fill(1);for(let x=0;x<5;x++)map.lowerTiles[5+x]=0;map.lowerTiles[2]=0;
 map.events=[ev('a',2,1,page([dest(4,1)])),ev('b',3,1,page([dest(0,1)]))];const s=sceneOf(project,map);registerPageMoveRoutes(s);frames(s,500);
 check('pocket-deadlock',JSON.stringify(s.eventPositions));
},
'Deterministic random obstacles; independent body-aware BFS proves reachability.':()=>{
 let seed=0x9282026; const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const {project}=fixture(7,7);store.getCurrent=()=>project;
 let reachable=0,stalled=0,illegal=0,first:any;
 for(let trial=0;trial<160;trial++){
  const map:any={...createBlankMap('m',7,7,'t'),id:'m',lowerTiles:Array.from({length:49},()=>rand()<0.17?1:0),upperTiles:Array(49).fill(-1)};
  for(const i of [0,1,47,48])map.lowerTiles[i]=0;
  map.events=[ev('a',0,0,page([dest(5,6)],{footprint:{width:2,height:1},passRows:1}))];project.maps={m:map};
  const s:any={map,session:startSession(project),eventPositions:initialRuntimeEventPositions(map.events),pageMoveRouteKeys:new Set(),pageMoveRouteEventIds:new Set(),autonomousNPCs:new Map(),eventSprites:new Map(),runtimeDom:{upsertEventMarker(){}},runEvent:async()=>{},tileX:-10,tileY:-10};
  s.registerAutonomousMover=(id:any,m:any,r:any)=>registerAutonomousMover(s,id,m,r);
  const can=(fx:number,fy:number,tx:number,ty:number)=>canMoveFootprint(project,map,fx,fy,{width:2,height:1},tx,ty,1);
  const queue=[[0,0]];const seen=new Set(['0,0']);let found=false;
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i];if(x===5&&y===6){found=true;break}for(const [dx,dy] of [[0,1],[-1,0],[1,0],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(!seen.has(k)&&can(x,y,nx,ny)){seen.add(k);queue.push([nx,ny])}}}
  if(!found)continue;reachable++;registerPageMoveRoutes(s);
  for(let i=0;i<160;i++){const old={...s.eventPositions.a};frames(s,1);const p=s.eventPositions.a;if((old.x!==p.x||old.y!==p.y)&&!can(old.x,old.y,p.x,p.y))illegal++}
  const p=s.eventPositions.a;if(p.x!==5||p.y!==6){stalled++;first??={trial,tiles:map.lowerTiles,after:p}}
 }
 check('random-body',JSON.stringify({seed:'0x9282026',trials:160,reachable,stalled,illegal,first}));
},
'repeat:false with disabled final destination wraps into earlier destinations.':()=>{
 const {project,map}=fixture(5,2);map.events=[ev('a',0,0,page([dest(1,0),dest(2,0),{...dest(3,0),switchId:'gate'}]))];
 const s=sceneOf(project,map);registerPageMoveRoutes(s);const visits:any[]=[];let previous=-1;
 for(let i=0;i<40;i++){frames(s,1);const p=s.eventPositions.a;if(p.x!==previous){visits.push(p.x);previous=p.x}}
 check('nonrepeat-disabled-tail',JSON.stringify({gate:s.session.switches.gate??false,visits,index:s.session.npcTravelStates.a}));
 s.session.switches.gate=true;registerPageMoveRoutes(s);frames(s,10);assert.equal(s.eventPositions.a.x,3);
},
};
export function runLivingPathCase(run:()=>void) {const original=store.getCurrent;try{run();}finally{store.getCurrent=original;}}

livingPathCases['2 wide and custom unit passage bypass armed terrain index'] = () => {
 for (const width of [1,2]) {
  const {project,map}=fixture(3,1);project.tilesets.t.passability.push({up:true,down:true,left:true,right:false});project.tilesets.t.priority.push('lower');map.lowerTiles[0]=2;
  map.events=[ev('a',0,0,page([dest(1,0)],{footprint:{width,height:1},passRows:1}))];const s=sceneOf(project,map);armTerrainComponents(project,map,3);
  assert.equal(route(s,project,width===1?()=>true:undefined)?.moves.length,1);
 }
};
livingPathCases['1 and 3 furniture before and after planning; terrain blockage'] = () => {
 for(const initial of [true,false]) for(const kind of ['furniture','terrain']) {
  const {project,map}=fixture(4,2);map.events=[ev('a',0,1,page([dest(3,1)]))];const s=sceneOf(project,map);
  if(!initial)registerPageMoveRoutes(s);
  if(kind==='terrain')map.lowerTiles[5]=1;
  else {project.database.homeDecorationTypes=[{id:'box',blocksMovement:true,footprint:{width:1,height:1}}];s.session.homeDecorationPlacements={box:{instanceId:'box',typeId:'box',mapId:'m',x:1,y:1,orientation:'down'}};}
  if(initial)registerPageMoveRoutes(s);
  for(let i=0;i<60;i++)updateAutonomousNPCs(s,80);
  assert.equal(s.eventPositions.a.x,3);
 }
};
livingPathCases['8 reverse order, legal steps, and no pocket'] = () => {
 for(const pocket of [true,false]) {
  const {project,map}=fixture(5,3);map.lowerTiles.fill(1);for(let x=0;x<5;x++)map.lowerTiles[5+x]=0;if(pocket)map.lowerTiles[2]=0;
  map.events=[ev('b',3,1,page([dest(0,1)])),ev('a',2,1,page([dest(4,1)]))];const s=sceneOf(project,map);registerPageMoveRoutes(s);
  for(let i=0;i<100;i++) {const old=structuredClone(s.eventPositions);frames(s,1);const {a,b}=s.eventPositions;assert.ok(a.x!==b.x||a.y!==b.y);for(const id of ['a','b'])assert.ok(Math.abs(old[id].x-s.eventPositions[id].x)+Math.abs(old[id].y-s.eventPositions[id].y)<=1);}
  assert.equal(s.eventPositions.a.x,pocket?4:2);assert.equal(s.eventPositions.b.x,pocket?0:3);
 }
};

// 적대적 리뷰(review12) 반례: 대피 뒤 상대가 비충돌이 되거나, 대피 칸을 제3자가 먼저 차지한 경우.
function yieldCorridor(opts:{bottomPocket?:boolean}={}) {
 const {project,map}=fixture(5,3);map.lowerTiles.fill(1);for(let x=0;x<5;x++)map.lowerTiles[5+x]=0;map.lowerTiles[2]=0;if(opts.bottomPocket)map.lowerTiles[12]=0;
 map.events=[ev('a',2,1,page([dest(4,1)])),ev('b',3,1,page([dest(0,1)]))];const s=sceneOf(project,map);s.commandMoveRouteEventIds=new Set();registerPageMoveRoutes(s);return {project,map,s};
}
function untilYield(s:any){for(let i=0;i<100;i++){frames(s,1);if(yieldingLivingMovers.has(s.autonomousNPCs.get('a')))return;}throw new Error('a never yielded');}
livingPathCases['9 a yielding resident resumes once the peer turns non-solid'] = () => {
 const {map,s}=yieldCorridor();untilYield(s);
 map.events[1].pages=[{...page([]),id:'other',priority:'below',movement:{type:'fixed'}}];registerPageMoveRoutes(s);
 frames(s,200);
 assert.equal(s.eventPositions.a.x,4);assert.equal(s.eventPositions.a.y,1);
 assert.equal(yieldingLivingMovers.has(s.autonomousNPCs.get('a')),false);
};
livingPathCases['10 a yielding resident picks the other pocket when a third resident takes the first'] = () => {
 const {map,s}=yieldCorridor({bottomPocket:true});untilYield(s);
 const chosen=s.autonomousNPCs.get('a').moves[0].dir;
 const stolenY=chosen==='up'?0:2;
 map.events.push(ev('c',2,stolenY,page([])));registerPageMoveRoutes(s);
 frames(s,300);
 assert.equal(s.eventPositions.a.x,4);assert.equal(s.eventPositions.b.x,0);
};


livingPathCases['11 a yielding resident picks the other pocket when the player takes the first'] = () => {
 const {s}=yieldCorridor({bottomPocket:true});untilYield(s);
 const chosen=s.autonomousNPCs.get('a').moves[0].dir;
 s.tileX=2;s.tileY=chosen==='up'?0:2;
 for(let i=0;i<300;i++){updateAutonomousNPCs(s,100);registerPageMoveRoutes(s);}
 assert.equal(s.eventPositions.a.x,4);assert.equal(s.eventPositions.b.x,0);
};

if(process.argv[1]?.endsWith('living-path-regression.ts')) {
 for(const [name,run] of Object.entries(livingPathCases)) {try {runLivingPathCase(run);console.log('PASS',name);}catch(error){console.log('FAIL',name,String(error));process.exitCode=1;}}
}
