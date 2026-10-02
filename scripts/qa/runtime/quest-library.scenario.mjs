import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Play three representative generated presets using actual movement and action.
// The only added QA helpers are ordinary map transfer events between their maps.
const project = JSON.parse(await readFile(resolve('output/evidence/quest-library/project.json'),'utf8'));
const deliveryMap = 'map_library_delivery', escortMap = 'map_library_escort', puzzleMap = 'map_library_puzzle_choice';
project.startMapId = deliveryMap; project.startPos = { x: 5, y: 6 };
project.session.currentMapId = deliveryMap; project.session.x = 5; project.session.y = 6;
project.session.gold = 0; project.session.inventory = {}; project.session.switches = {}; project.session.variables = {}; project.session.followers = [];
project.system.opening = { ...project.system.opening, enabled: false };
project.system.timeSystem = { enabled: false };
const portal = (from,to) => project.maps[from].events.push({ id: `qa_portal_${from}`, x: 9, y: 6, trigger: { kind:'action' }, commands: [], pages: [{
  id:`qa_portal_${from}_page`, name:'다음 의뢰', conditions:[], graphic:{transparent:true}, trigger:{kind:'action'}, priority:'below', overlapForbidden:false,
  movement:{type:'fixed',speed:3,frequency:3}, commands:[{kind:'transfer',mapId:to,x:5,y:6}],
}] });
portal(deliveryMap,escortMap); portal(escortMap,puzzleMap);
const itemId = project.quests.find(q => q.presetId === 'delivery').steps[0].itemId;
const projectFixture = resolve('output/evidence/quest-library/runtime.json');
await writeFile(projectFixture,JSON.stringify(project));
const key = key => ({kind:'key',key});
const visible = testid => ({kind:'waitForVisible',testid});
const face = dir => ({kind:'face',dir});
const action = {kind:'action'};
const dismiss = {kind:'pressUntil',key:'Enter',testid:'dialogue-box',state:'absent',timeoutMs:250,maxPresses:20};
const accept = [face('up'),{kind:'pressUntil',key:'Enter',testid:'dialogue-box',state:'present',timeoutMs:250,maxPresses:12},{kind:'pressUntil',key:'Enter',testid:'runtime-choices',state:'present',timeoutMs:250},key('Enter'),dismiss];
const move = (mapId,dir,x,y) => [{kind:'dir',dir},{kind:'waitForPosition',mapId,x,y},{kind:'dir',dir:null}];
export default {
  id:'quest-library',projectFixture,viewport:{width:960,height:720},
  beats:[
    {id:'field',ops:[key('Enter'),{kind:'waitForRuntime'}],expect:{mapId:deliveryMap,x:5,y:6}},
    {id:'delivery-accept',note:'실제 수락으로 배달품을 받는다',ops:accept,expect:{switches:{sw_library_delivery_started:true},inventory:{[itemId]:1},gold:0}},
    {id:'delivery-hand-over',note:'걸어서 NPC에게 실제 물품을 전달·소비',ops:[...move(deliveryMap,'right',8,6),face('up'),action,visible('dialogue-box')],expect:{inventory:{[itemId]:0},gold:0},shot:true},
    {id:'delivery-report',note:'돌아와 보고하여 100G',ops:[dismiss,...move(deliveryMap,'left',5,6),face('up'),action,visible('dialogue-box')],expect:{switches:{sw_library_delivery_done:true},gold:100},shot:true},
    {id:'delivery-repeat-report',ops:[dismiss,action,visible('dialogue-box')],expect:{gold:100}},
    {id:'travel-to-escort',ops:[dismiss,...move(deliveryMap,'right',9,6),face('up'),action,{kind:'waitForPosition',mapId:escortMap,x:5,y:6},{kind:'waitForRuntime'}],expect:{mapId:escortMap,x:5,y:6}},
    {id:'escort-accept',ops:accept,expect:{switches:{sw_library_escort_started:true},gold:100}},
    {id:'escort-join',note:'실제 NPC가 뒤따르는 동행자가 된다',ops:[...move(escortMap,'right',8,6),face('up'),action,visible('dialogue-box'),dismiss,...move(escortMap,'right',11,6)],expect:{switches:{sw_library_escort_escort0:true},followerSpriteCount:1,gold:100},shot:true},
    {id:'escort-arrival',note:'직접 목적지까지 이동하여 동행 완료',ops:[...move(escortMap,'right',14,6),...move(escortMap,'down',14,9),visible('dialogue-box')],expect:{switches:{sw_library_escort_step0:true},followerSpriteCount:0,gold:100},shot:true},
    {id:'escort-report',ops:[dismiss,...move(escortMap,'up',14,6),...move(escortMap,'left',5,6),face('up'),action,visible('dialogue-box')],expect:{switches:{sw_library_escort_done:true},gold:200}},
    {id:'travel-to-puzzle',ops:[dismiss,...move(escortMap,'right',9,6),face('up'),action,{kind:'waitForPosition',mapId:puzzleMap,x:5,y:6},{kind:'waitForRuntime'}],expect:{mapId:puzzleMap,x:5,y:6}},
    {id:'puzzle-accept',ops:accept,expect:{switches:{sw_library_puzzle_choice_started:true},gold:200}},
    {id:'puzzle-clue',note:'실제 단서 조사',ops:[...move(puzzleMap,'right',8,6),face('up'),action,visible('dialogue-box'),dismiss],expect:{switches:{sw_library_puzzle_choice_step0:true},gold:200}},
    {id:'puzzle-wrong-answer',note:'오답은 비용·완료를 남기지 않고 재도전 가능',ops:[...move(puzzleMap,'right',10,6),face('up'),action,visible('runtime-choices'),key('ArrowDown'),key('Enter'),visible('dialogue-box')],expect:{switches:{sw_library_puzzle_choice_step1:false},gold:200},shot:true},
    {id:'puzzle-correct-answer',note:'정답 선택과 마지막 목표 완료',ops:[dismiss,action,visible('runtime-choices'),key('Enter'),visible('dialogue-box'),dismiss],expect:{switches:{sw_library_puzzle_choice_step1:true},variables:{var_library_puzzle_choice_progress:2},gold:200}},
    {id:'puzzle-report',note:'세 의뢰를 물리 이동·상호작용으로 완료: 총 300G',ops:[...move(puzzleMap,'left',5,6),face('up'),action,visible('dialogue-box')],expect:{switches:{sw_library_puzzle_choice_done:true},gold:300},shot:true},
  ],
};
