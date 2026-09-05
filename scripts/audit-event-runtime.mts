import fs from 'node:fs';
import {M2_COMMAND_CATALOG} from '../src/project/eventCommands/m2Catalog.ts';
import {catalogRowRuntimeSupport,m2CommandRuntimeClassification} from '../src/project/eventCommands/runtimeSupport.ts';
import {createBlankProject} from '../src/project/defaults/defaultProject.ts';
import {startSession} from '../src/project/session.ts';
import {createInterpreter} from '../src/player/interpreter.ts';
fs.mkdirSync(".omo/evidence/event-runtime-audit", {recursive:true});
const rows=M2_COMMAND_CATALOG.map(e=>({id:e.id,title:e.title,label:e.label,nativeKind:e.existingKind,mapPicker:catalogRowRuntimeSupport(e.id,e.existingKind,'map'),...m2CommandRuntimeClassification(e.id)}));
const counts=rows.reduce((a,r)=>(a[r.mapPicker]=(a[r.mapPicker]||0)+1,a),{} as Record<string,number>);
const specs=[
 ['Open Menu Screen',{}],['Open Load Menu',{}],
 ['Display Text Settings',{format:'transparent',position:'top',allowEventMovementDuringWait:true,preventObscuringPlayer:false}],
 ['Wait Until',{condition:'switchOn',target:'probe_ready',value:'',timeoutMs:0}],
 ['Pathfind Move',{target:'player',x:6,y:6,speed:4,wait:true}],
 ['Play Movie',{value:'probe-movie'}],
 ['Get Terrain ID',{x:2,y:2,variableId:'probe_terrain'}],['Get Event ID',{x:2,y:2,variableId:'probe_event'}],
 ['UI Command',{surface:'toast',message:'VISIBLE_PROBE',durationMs:1000}],
] as const;
const probes=specs.map(([title,fields])=>{
 const entry=M2_COMMAND_CATALOG.find(e=>e.title===title);if(!entry)throw Error(title);
 const p=createBlankProject();p.maps[p.startMapId]!.events.push({id:'event_at_probe',x:2,y:2,trigger:{kind:'action'},commands:[]});const s=startSession(p);s.switches.probe_ready=false;
 const i=createInterpreter([{kind:'m2Command',commandId:entry.id,fields},{kind:'text',body:'AFTER_PROBE'}],s,p);
 const first=i.start();
 const next=first.kind==='wait'?i.resume(undefined):undefined;
 return {title,id:entry.id,first,next,conditionStillFalse:s.switches.probe_ready===false,messageWindowSettings:s.messageWindowSettings,runtime:s.m2Runtime,eventLocations:s.eventLocations,variables:s.variables,playerPosition:{x:s.x,y:s.y}};
});
fs.writeFileSync('.omo/evidence/event-runtime-audit/catalog.json',JSON.stringify({scope:'Static support classification for all 125 catalog rows; not proof of all runtime effects.',counts,rows},null,2));
fs.writeFileSync('.omo/evidence/event-runtime-audit/probes.json',JSON.stringify(probes,null,2));
console.log(JSON.stringify({catalogCount:rows.length,counts,probes:probes.map(p=>({title:p.title,first:p.first,next:p.next,messageWindowSettings:p.title==='Display Text Settings'?p.messageWindowSettings:undefined}))},null,2));
