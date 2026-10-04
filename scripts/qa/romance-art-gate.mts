// Synthetic rejection checks only. Actual map/UI evidence is recorded separately.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runPiTeam} from '../lib/piTeamRuntime';
import {defaultTeamSpec} from '../../src/ai/piAgent/teamSpec';
import {ROMANCE_ART_AXES, romanceTownLayoutFindings} from '../../src/harnesses/romance-scene/artDirection';
import type {PiAgentDoneEvent} from '../../src/ai/piAgent/protocol';
const [beforeFile,afterFile,out] = process.argv.slice(2);
const before=JSON.parse(fs.readFileSync(beforeFile!,'utf8')),after=JSON.parse(fs.readFileSync(afterFile!,'utf8'));
assert(romanceTownLayoutFindings(before).length);assert.equal(romanceTownLayoutFindings(after).length,0);
const stats={ms:1,turns:1,toolCalls:0,toolErrors:0},cases=[];
for(const name of ['omitted','failed-axis','duplicated-axis','old-layout','valid']){
 const project=structuredClone(name==='old-layout'?before:after);
 const request={mode:'team' as const,provider:'synthetic',task:'첫 만남 미술 게이트 검사',project,mapIds:[project.startMapId],team:defaultTeamSpec()};
 let review:unknown,finishRejected=false;
 try{
  await runPiTeam(request,{runAgent:async(r,options)=>{
   const done:PiAgentDoneEvent={type:'done',project:r.project,stats,changedKeys:[]};
   const tool=(id:string)=>options!.extraTools!.find(t=>t.name===id)!;
   if(options?.extraTools?.some(t=>t.name==='report_review')){
    assert(r.task.includes('16비트 도트 미술 기준'));
    options.onEvent?.({type:'execution_status',name:'map.image.delivered',ok:true,summary:'synthetic receipt, not real pixels'});
    const artChecks=ROMANCE_ART_AXES.map(axis=>({axis,passed:!(name==='failed-axis'&&axis==='grounding'),evidence:'Synthetic observation: image coordinates (10,8) and (12,8); this is not live aesthetic evidence.'}));
    if(name==='duplicated-axis')artChecks[1]=artChecks[0]!;
    await tool('report_review').execute('review',{ok:true,findings:[],...(name==='omitted'?{}:{artChecks})});return done;
   }
   if(options?.extraTools?.some(t=>t.name==='report_task')){await tool('report_task').execute('task',{report:'synthetic review'});return done;}
   review=await tool('review_map').execute('review',{mapId:project.startMapId});
   try{await tool('finish').execute('finish',{report:'synthetic completion'});}catch{finishRejected=true;}
   return done;
  }});
  assert.equal(name,'valid');assert(!finishRejected);cases.push({name,accepted:true,review});
 }catch(error){assert.notEqual(name,'valid',String(error));assert(finishRejected);cases.push({name,accepted:false,review,reason:String(error)});}
}
fs.writeFileSync(out!,JSON.stringify({synthetic:true,beforeLayoutRejected:romanceTownLayoutFindings(before),afterLayoutPassesBlankGroundCheck:true,cases},null,2));
console.log(cases.map(c=>({name:c.name,accepted:c.accepted})));
