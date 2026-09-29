// Minimal headless fixture: real registration/collision/movement; rendering and store access are stubbed.
import { updateAutonomousNPCs } from '@/player/playSceneAutonomous';
import { registerPageMoveRoutes } from '@/player/playScenePageMoveRoutes';
import { store } from '@/project/store';
import { initialRuntimeEventPositions } from '@/project/runtimeEventState';
const open={up:true,down:true,left:true,right:true}, wall={up:false,down:false,left:false,right:false};
function event(id:string,x:number,y:number,extra:any={}) { return {id,x,y,trigger:{kind:'action'},commands:[],pages:[{id:id+'page',conditions:[],graphic:{},trigger:{kind:'eventTouch'},priority:'same',commands:[],movement:{type:'chase',speed:8,frequency:8},...extra}]}; }
function fixture(w:number,h:number,events:any[],px:number,py:number) {
 const map:any={id:'m',width:w,height:h,tilesetId:'t',lowerTiles:Array(w*h).fill(0),upperTiles:Array(w*h).fill(-1),events};
 const project:any={id:'p',maps:{m:map},tilesets:{t:{id:'t',passability:[open,wall,open],priority:[0,0,0],ledgeDirections:{'2':'right'}}},database:{},system:{},resources:[],characters:[]};
 const session:any={currentMapId:'m',x:px,y:py,eventLocations:{},erasedEventIds:[],removedEventIds:{},flags:{},switches:{},selfSwitches:{},variables:{},partyActorIds:[],inventory:{}};
 (store as any).getCurrent=()=>project;
 const scene:any={map,session,tileX:px,tileY:py,eventPositions:initialRuntimeEventPositions(events),autonomousNPCs:new Map(),eventSprites:new Map(),pageMoveRouteKeys:new Set(),pageMoveRouteEventIds:new Set(),runtimeDom:{upsertEventMarker(){}},touches:0,runEvent(){scene.touches++;}};
 scene.registerAutonomousMover=(id:string,moves:any[],repeat:boolean)=>scene.autonomousNPCs.set(id,{moves,repeat,step:0,timer:0,strategy:'sequence',facing:'down',directionFix:false,through:false,animationEnabled:true,opacity:255,moveDurationMs:80,moveIntervalMs:80,activeMove:null});
 registerPageMoveRoutes(scene);
 return {map,project,session,scene};
}
function ticks(s:any,n=100){for(let i=0;i<n;i++)updateAutonomousNPCs(s,80);}
function pos(s:any,id='a'){return s.session.eventLocations[id]??s.eventPositions[id];}

export { event, fixture, ticks, pos };
