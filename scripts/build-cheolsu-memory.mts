/** Original two-map flashback. Saves only its dedicated remote project; never the selected editor project. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBlankProject } from '../src/project/defaults/defaultProject.ts';
import { createBlankMap } from '../src/project/defaults/defaultMaps.ts';
import { defaultTitleScreenSettings } from '../src/project/defaults/defaultDatabase.ts';
import { paintRoadRect, shapeRoadEdges } from '../src/project/defaults/roadAutotile.ts';
import { compileCutscene, type CutsceneBeat } from '../src/editor/cutscene/index.ts';
import { charsetFrameIndex } from '../src/assets/easyrpgRtp.ts';
import { projectLint } from '../src/project/lint/projectLint.ts';
import { DEFAULT_MESSAGE_WINDOW_SETTINGS } from '../src/project/session.ts';
import { serializePretty } from '../src/project/io.ts';
import { saveProjectToSupabase, loadProjectFromSupabase } from '../src/project/supabaseProjectSync.ts';
import { loadSupabaseEnvironment } from './lib/supabase-database-ops.mjs';
import type { Command, EventPage, GameEvent, GameMap } from '../src/project/types.ts';

const projectId = 'rpg-zzu-cheolsu-memory-20260905-df12';
const env = loadSupabaseEnvironment();
const config = {url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY, projectId};
assert(config.url && config.anonKey, 'Supabase connection is required');
// Read first: prove connectivity and refuse to replace unrelated content.
const existing = await loadProjectFromSupabase(config);
assert(!existing || existing.meta.title === '철수의 기억', 'Refusing to overwrite another project');
const project = createBlankProject();
project.meta = {...project.meta, title: '철수의 기억', author: 'RPG ZZU'};
project.system.defaultBgmResourceId = 'cc0-bgm-rtp-emo-001';
project.system.titleScreen = {...defaultTitleScreenSettings(), title:'철수의 기억', musicResourceId:'cc0-bgm-rtp-emo-001', menuLabels:{newGame:'기억을 따라',continueGame:'이어 하기',quit:'그만두기'}};
project.database.actors.find(a=>a.id==='actor_hero')!.name = '철수';
project.switches.push({id:'memory_seen',name:'아버지와의 기억'}, {id:'memory_closed',name:'현재로 돌아옴'});

function map(id:string, name:string, past:boolean):GameMap {
 const m=createBlankMap(name,26,20); m.id=id;
 const lower=(x:number,y:number,t:number)=>{m.lowerTiles[y*m.width+x]=t;};
 const upper=(x:number,y:number,t:number)=>{m.upperTiles[y*m.width+x]=t;};
 // Same river geography in both periods; the dock is the visual anchor.
 for(let y=4;y<=8;y++) for(let x=0;x<26;x++) lower(x,y,0);
 const roads=[{x:2,y:13,width:22,height:2},{x:11,y:10,width:3,height:9}];
 roads.forEach(r=>paintRoadRect(m,r)); shapeRoadEdges(m,roads);
 for(let y=8;y<=11;y++) for(let x=10;x<=15;x++) lower(x,y,222);
 for(const x of [10,15]) for(let y=8;y<=10;y++) upper(x,y,193);
 const trees=[[1,1],[4,0],[8,1],[17,0],[21,1],[24,0],[0,10],[3,10],[20,10],[23,10],[1,16],[4,17],[7,16],[17,17],[20,16],[23,17]];
 for(const [x,y] of trees) {
  upper(x!,y!,262);upper(x!+1,y!,263);lower(x!,y!+1,292);lower(x!+1,y!+1,293);
 }
 for(const [x,y] of [[5,12],[8,11],[18,12],[21,15],[8,18],[16,15]]) upper(x!,y!,past?288:-1);
 upper(6,15,327);upper(7,15,328); // intact two-cell bench
 upper(12,12,237); // keepsake box, blocked by its action event
 return m;
}
const now=map('memory_present','현재 · 돌아온 강변',false);
const past=map('memory_summer','기억 · 그해 여름',true);
project.maps={[now.id]:now,[past.id]:past};
project.mapTree={mapId:now.id,children:[{mapId:past.id,children:[]}]};
project.startMapId=now.id; project.startPos={x:12,y:13};
const say=(speaker:string,text:string):CutsceneBeat=>({kind:'say',speaker,text});
const scene=(beats:CutsceneBeat[]):Command[]=>compileCutscene(beats,{skippable:false}).flatMap((command):Command[]=>
 command.kind==='moveEvent' && command.eventId==='father' ? [
  {kind:'displayTextSettings',...DEFAULT_MESSAGE_WINDOW_SETTINGS,allowEventMovementDuringWait:true},
  command,
  {kind:'displayTextSettings',...DEFAULT_MESSAGE_WINDOW_SETTINGS},
 ] : [command]);
function page(id:string, commands:Command[], options:Partial<EventPage>={}):EventPage {
 return {id,name:id,conditions:[],graphic:{},trigger:{kind:'action'},priority:'below',movement:{type:'fixed',speed:3,frequency:3},commands,...options};
}
function event(m:GameMap,id:string,x:number,y:number,pages:EventPage[]):void {
 m.events.push({id,x,y,trigger:{kind:'action'},commands:[],pages} satisfies GameEvent);
}
const disabled=(id:string,key:'A'='A')=>page(id,[],{conditions:[{kind:'selfSwitch',key,value:true}]});
event(now,'arrival',11,15,[page('돌아온 사람',[
 ...scene([
  {kind:'music',action:'bgm',resourceId:'cc0-bgm-rtp-emo-001'},
  {kind:'tint',color:'#b9c8df',durationMs:450,wait:true},
  say('철수','집을 비우러 왔다. 아버지가 떠난 뒤, 이 강변에는 처음이다.'),
  say('철수','선착장 앞 나무 상자… 아직도 여기 있네.\n가까이에서 위를 보고 Enter로 열어 보자.'),
 ]), {kind:'setSelfSwitch',key:'A',value:true}
 ],{trigger:{kind:'auto'}}),disabled('도착 대사 끝')]);
event(now,'keepsake',12,12,[
 page('상자 속 종이배',[
  ...scene([
   say('철수','상자 안에는 빛바랜 빨간 종이배가 있다.\n접힌 모서리마다 아버지의 손자국이 남아 있다.'),
   say('철수','나는 그날, 배가 가라앉아서 울었던 걸까?'),
   {kind:'fade',direction:'out',durationMs:650,wait:true},
  ]),
  {kind:'transfer',mapId:past.id,x:12,y:11,direction:'up',fade:'black'},
 ],{priority:'same',overlapForbidden:true}),
 page('기억한 뒤의 상자',scene([
  say('철수','종이배는 상자에 두고, 빈 종이 한 장을 꺼냈다.'),
  say('철수','다음에는 누군가와 함께 접어야지.\n아버지가 내게 그랬던 것처럼.'),
 ]),{priority:'same',overlapForbidden:true,conditions:[{kind:'switch',switchId:'memory_seen',value:true}]}),
]);
event(past,'father',13,10,[page('아버지',[],{
 priority:'same',overlapForbidden:true,
 graphic:{sprite:{type:'bundled',id:'tex_easyrpg_charset_people2'},direction:'left',pattern:charsetFrameIndex({characterIndex:1,direction:'left',pattern:1})},
})]);
event(past,'summer_scene',17,12,[page('그해 여름',[
 ...scene([
  {kind:'tint',color:'#ead2a0',durationMs:0},
  {kind:'fade',direction:'in',durationMs:600,wait:true},
  say('그해 여름','열 살의 여름.\n세상에서 가장 먼 곳이 강 건너 마을이던 시절.'),
  {kind:'moveActor',target:'player',moves:[{kind:'move',dir:'up'},{kind:'turn',dir:'right'}],wait:true},
  say('어린 철수','아빠, 내 배는 자꾸 가라앉아.\n아빠 것처럼 멀리 보내고 싶은데.'),
  say('아버지','이리 줘 봐. 여기를 한 번 더 접으면 돼.\n천천히. 잘못 접어도 다시 펴면 되니까.'),
  say('어린 철수','…아빠도 어릴 때 잘 못 접었어?'),
  say('아버지','그럼. 네 할아버지랑 종이를 한 상자나 썼지.'),
  {kind:'moveActor',target:'father',moves:[{kind:'turn',dir:'up'}],wait:true},
  {kind:'moveActor',target:'player',moves:[{kind:'turn',dir:'up'}],wait:true},
  {kind:'camera',mode:'pan',x:12,y:7,durationMs:1100,wait:true},
  say('어린 철수','저기! 이번에는 떠 있어!\n…그런데 저 멀리 가면 다시 못 만나잖아.'),
  say('아버지','배는 돌아오지 않아도 괜찮아.\n우리 둘이 여기서 함께 접었다는 건 남으니까.'),
  {kind:'wait',ms:700},
  say('철수','이제야 기억났다.\n그날 아버지는 배보다 내 얼굴을 오래 보고 있었다.'),
  {kind:'camera',mode:'return',durationMs:650,wait:true},
  {kind:'fade',direction:'out',durationMs:650,wait:true},
 ]),
 {kind:'setSwitch',switchId:'memory_seen',value:true},
 {kind:'setSelfSwitch',key:'A',value:true},
 {kind:'transfer',mapId:now.id,x:12,y:13,direction:'up',fade:'black'},
],{trigger:{kind:'auto'}}),disabled('여름 장면 끝')]);
event(now,'return_scene',14,15,[page('다시 현재',[
 ...scene([
  {kind:'tint',color:'neutral',durationMs:500,wait:true},
  {kind:'fade',direction:'in',durationMs:600,wait:true},
  say('철수','강물 소리가 다시 가까워졌다.\n돌아오지 않는 것만 세느라, 남아 있는 걸 잊고 살았구나.'),
  say('철수','아빠. 이번에는 내가 먼저 접어 볼게.\n잘못 접으면… 다시 펴면 되니까.'),
  say('철수의 기억','끝.\n잠시 강변을 걸어도 좋습니다. 상자를 다시 조사하면 철수의 마지막 생각을 들을 수 있습니다.'),
 ]), {kind:'setSwitch',switchId:'memory_closed',value:true},
],{trigger:{kind:'auto'},conditions:[{kind:'switch',switchId:'memory_seen',value:true},{kind:'switch',switchId:'memory_closed',value:false}]}),
 page('귀환 완료',[],{conditions:[{kind:'switch',switchId:'memory_closed',value:true}]})]);
event(now,'bench',6,15,[page('오래된 벤치',scene([say('철수','아버지는 늘 강 쪽 자리를 내게 내어 주셨다.\n그때는 그게 당연한 줄 알았다.')] ),{priority:'same',overlapForbidden:true})]);

const lint=projectLint(project,{reachability:[{mapId:now.id,from:project.startPos,targets:[{x:12,y:12},{x:6,y:15}]},{mapId:past.id,from:{x:12,y:11},targets:[{x:12,y:10}]}]});
console.log('lint',JSON.stringify({errors:lint.filter(i=>i.severity==='error'),warningCodes:[...new Set(lint.map(i=>i.code))]}));
assert(!lint.some(i=>i.severity==='error'),'Project lint errors');
const spine=(p:typeof project)=>JSON.stringify({maps:p.maps,start:p.startPos,startMapId:p.startMapId,title:p.meta.title,switches:p.switches});
const saved=await saveProjectToSupabase(project,config);
assert.equal(saved.kind,'saved');
const reloaded=await loadProjectFromSupabase(config);assert(reloaded);
assert.equal(reloaded.system.defaultBgmResourceId, project.system.defaultBgmResourceId);
assert.deepEqual(JSON.parse(spine(reloaded)),JSON.parse(spine(project)),'Remote content changed during persistence');
const out='.omo/evidence/cheolsu-memory';fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/project.json`,JSON.stringify(reloaded));
fs.writeFileSync(`${out}/철수의 기억.oprn`,serializePretty(reloaded));
fs.writeFileSync(`${out}/persistence.json`,JSON.stringify({projectId,title:reloaded.meta.title,saved:saved.kind,sha256:saved.sha256,reloaded:true,contentSha256:createHash('sha256').update(spine(reloaded)).digest('hex'),maps:Object.keys(reloaded.maps),lint,verifiedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({projectId,saved:saved.kind,reloaded:true,maps:Object.keys(reloaded.maps),events:Object.values(reloaded.maps).reduce((n,m)=>n+m.events.length,0)}));
