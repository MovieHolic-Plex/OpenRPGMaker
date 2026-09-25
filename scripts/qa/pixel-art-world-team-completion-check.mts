// Team plumbing only; fake builders verify failure propagation, not placement quality.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {runPiTeam} from '../lib/piTeamRuntime';
const project=JSON.parse(fs.readFileSync('output/paw-direct-v2/home-repair/result-project.json','utf8'));
const done=(p:any,reports:any[]=[])=>({type:'done' as const,project:p,stats:{ms:1,turns:1,toolCalls:1,toolErrors:0},changedKeys:['maps'],interiorCompletion:reports});
async function observe(repair:boolean){
 let attempts=0;const events:any[]=[];
 const result=await runPiTeam({provider:'test',mode:'team',task:'현대 주택 보수',mapIds:[],project,team:{version:1,orchestratorNotes:'',members:[{id:'builder',label:'시공',kind:'builder',summary:'보수',prompt:'보수',toolDomains:[],maxTurns:5,enabled:true}]}},{onEvent:e=>events.push(e),runAgent:async(r:any,o:any)=>{
  const call=async(name:string,args:any)=>o.extraTools.find((t:any)=>t.name===name).execute('probe',args);
  if(o.extraTools?.some((t:any)=>t.name==='assign_map_agent')){
   await call('assign_map_agent',{mapId:'direct-home',task:'보수',member:'builder'});await call('wait_agents',{});
   if(repair){await call('assign_map_agent',{mapId:'direct-home',task:'재검사 후 보수',member:'builder'});await call('wait_agents',{});}
   return done(r.project);
  }
  attempts++;const p=structuredClone(r.project);p.maps['direct-home'].name='시공 '+attempts;
  return done(p,attempts===1?[{mapId:'direct-home',issues:[{code:'REQUIRED_OBJECT_COUNT'}]}]:[]);
 }});
 assert(events.some(e=>e.type==='agent_done'&&e.agentId.startsWith('builder-')&&!e.ok));
 assert.equal(result.interiorCompletion?.length,repair?0:1);
}
await observe(false);await observe(true);
const proof={pass:true,failedChildNotCompleted:true,unresolvedFailureInFinalResult:true,repairedChildClearsFailure:true,simulatedBuilders:true,liveModel:false};
fs.writeFileSync('output/paw-direct-v2/team-contract-check.json',JSON.stringify(proof,null,2));console.log(proof);
