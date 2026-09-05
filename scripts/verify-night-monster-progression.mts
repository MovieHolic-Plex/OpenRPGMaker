import fs from 'node:fs';
import { runSceneTest, type SceneStep } from '../src/testing/sceneTestRunner.ts';
import { projectLint } from '../src/project/lint/projectLint.ts';
import type { Project } from '../src/project/types.ts';
import { NIGHT_MONSTER_MAP_IDS as m } from '../src/project/examples/nightMonster.ts';
const project: Project=JSON.parse(fs.readFileSync('output/evidence/night-monster-upgrade/project.json','utf8'));
const at=(map:string,id:string)=>{const e=project.maps[map]!.events.find(e=>e.id===id);if(!e)throw Error(id);return {x:e.x,y:e.y};};
const inspect=(map:string,id:string):SceneStep[]=>[{kind:'walk',to:at(map,id),adjacent:true},{kind:'interact'}];
const gate=(map:string,target:string):SceneStep=>{const e=project.maps[map]!.events.find(e=>e.pages?.some(p=>p.commands.some(c=>c.kind==='transfer'&&c.mapId===target)));if(!e)throw Error(target);return {kind:'walk',to:{x:e.x,y:e.y}};};
const steps:SceneStep[]=[
 gate(m.foyer,m.gallery),{kind:'expect',mapId:m.gallery},
 ...inspect(m.gallery,'ev_examine_5'),...inspect(m.gallery,'ev_blue_restoration_lock_gate'),
 ...inspect(m.gallery,'ev_gallery_sequence_seq_2'),...inspect(m.gallery,'ev_gallery_sequence_seq_1'),...inspect(m.gallery,'ev_gallery_sequence_seq_3'),
 gate(m.gallery,m.bedroom),...inspect(m.bedroom,'map_night_bedroom_ev_examine_1'),{kind:'expect',switchOn:'sw_night_whistle'},gate(m.bedroom,m.gallery),gate(m.gallery,m.chase),
 {kind:'walk',to:{x:25,y:10}},gate(m.chase,m.finale),{kind:'expect',mapId:m.finale},
 ...inspect(m.finale,'map_night_basement_ev_examine_1'),...inspect(m.finale,'ev_restore_truth_ending'),{kind:'expect',endingReached:'ending_restore_truth'},
];
const rescue=runSceneTest(project,{mapId:m.foyer,start:project.startPos,steps});
const escape=runSceneTest(project,{mapId:m.finale,start:{x:10,y:11},steps:[...inspect(m.finale,'ev_leave_blue_ending'),{kind:'expect',endingReached:'ending_leave_it_blue'}]});
const lint=projectLint(project);
const result={scope:'story branches and walkability; real-time pursuit separately tested in player.html',rescue,escape,lint};
fs.writeFileSync('output/evidence/night-monster-upgrade/progression.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({rescue:rescue.ok,rescueFailure:rescue.failureReason,escape:escape.ok,escapeFailure:escape.failureReason,errors:lint.filter(i=>i.severity==='error'),warnings:lint.filter(i=>i.severity!=='error').map(i=>({code:i.code,mapId:i.mapId,x:i.x,y:i.y,message:i.message}))},null,2));
if(!rescue.ok||!escape.ok||lint.some(i=>i.severity==='error'))process.exitCode=1;
