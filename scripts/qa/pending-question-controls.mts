import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createAssistantMessageEventStream} from '@oh-my-pi/pi-ai';
import {createBlankProject} from '../../src/project/defaults';
import {runPiAgent} from '../lib/piAgentRuntime';
import {withUltrabrainPlan} from '../../src/ai/piAgent/plainTurn';
const checks=[];
for (const question of ['ask_tileset_change','ask_missing_tiles']) {
 const project=createBlankProject();
 const before=JSON.stringify(project.maps);
 let requests=0;const events:any[]=[];
 const done=await runPiAgent({provider:'google-antigravity',task:withUltrabrainPlan('질문 후 답을 기다려라','1. 재료 선택을 묻는다'),project,mapIds:[project.startMapId],maxTurns:4,initialToolNames:[question,'set_project_settings']},{timeoutMs:30000,onEvent:e=>events.push(e),streamFn:((_m:any,_ctx:any)=>{
 const stream=createAssistantMessageEventStream();requests++;
 queueMicrotask(()=>{const content=requests===1?[
 {type:'toolCall',id:'ask',name:question,arguments:question==='ask_tileset_change'?{mapId:project.startMapId,toTilesetId:'joseon_baram',reason:'동굴 재료 선택'}:{need:'동굴 암반',query:'cave'}},
 {type:'toolCall',id:'unsafe',name:'set_project_settings',arguments:{title:'SHOULD NOT WRITE'}}]:[{type:'text',text:'Done'}];
 const message:any={role:'assistant',content,api:'gemini',provider:'google-antigravity',model:'scripted',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0},stopReason:requests===1?'toolUse':'stop',timestamp:Date.now()};
 stream.push({type:'start',partial:message});for(let i=0;i<content.length;i++)if(content[i].type==='toolCall')stream.push({type:'toolcall_end',contentIndex:i,toolCall:content[i],partial:message} as any);stream.push({type:'done',reason:message.stopReason,message});});return stream;}) as any});
 assert.ok(events.some(e=>e.type==='tool_end'&&e.name===question&&e.ok),JSON.stringify(events));
 assert.equal(done.project.title,project.title);assert.equal(JSON.stringify(done.project.maps),before);
 assert.equal(requests,1);assert.match(done.stoppedEarly??'',/선택을 기다립니다/);
 assert.ok(!events.some(e=>e.name==='plan_execution_rekick'));
 checks.push({question,requests,sameBatchWriteBlocked:true,rekickBlocked:true,cardResultPreserved:true});
}
writeFileSync('verify-shots/asset-store/pending-question-controls.json',JSON.stringify({kind:'scripted-real-agent-loop-control',modelCalls:0,passed:true,checks},null,2));console.log(JSON.stringify(checks));
