// Browser contract QA only: real Pi loop/registry, scripted model, detached project fixtures.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createAssistantMessageEventStream } from '@oh-my-pi/pi-ai';
import { runPiAgent } from '../lib/piAgentRuntime.ts';
import { selectPiToolDefinitions } from '../../src/ai/piAgent/toolAdapter.ts';
import { buildSessionRegistryTools } from '../../src/ai/sessionToolExposure.ts';
import { declaredIntent } from '../../test/intentFixture.ts';
const out = process.env.OUT ?? '.omo/evidence/ai-tool-exposure';
mkdirSync(out, { recursive: true });
const full = selectPiToolDefinitions();
const schema = (t: any) => ({name:t.name, description:t.description, parameters:t.parameters});
const fullChars = JSON.stringify(full.map(schema)).length;
const cases = [
  ['RPG foundation', '중세 게임 RPG 만들어줘', {adventure:{village:true,dungeon:true,party:true,battle:true,world:true,characters:true,appearance:true}}],
  ['Party', '시작 파티를 두 명으로 바꿔줘', {tools:['set_party']}],
  ['Portrait', '주인공 얼굴을 바꿔줘', {tools:['upsert_actor']}],
  ['Opening', '오프닝 만들어줘', {tools:['set_opening']}],
] as const;
const metrics = cases.map(([name,requestText,intent]) => {
  const tools = buildSessionRegistryTools({requestText,intent:declaredIntent(intent as never)}).map(t => t.function);
  const chars = JSON.stringify(tools).length;
  return {name,count:tools.length,schemaChars:chars,reductionPercent:Math.round((1-chars/fullChars)*1000)/10,names:tools.map(t=>t.name)};
});
writeFileSync(`${out}/catalog-metrics.json`,JSON.stringify({method:'JSON character counts; not provider tokens. Intent declarations are fixed QA inputs.',fullCount:full.length,fullSchemaChars:fullChars,cases:metrics},null,2));
let index = 0;
const server = Bun.serve({hostname:'127.0.0.1',port:0,idleTimeout:0,async fetch(req) {
  const request = await req.json() as any;
  const events: any[] = [], rounds: any[] = [];
  const task = request.task as string;
  const party = task.includes('파티');
  const miss = task.includes('빈 검색');
  const ids = request.project.database.actors.slice(0,2).map((a:any)=>a.id);
  const steps = request.readOnly ? [{name:'get_project_summary',args:{}}]
    : miss ? [{name:'find_tools',args:{query:'쀍쀍쀍쀍쀍'}},{name:'get_project_summary',args:{}}]
    : [{name:'find_tools',args:{query:party?'set_party':'set_project_settings'}},
       {name:party?'set_party':'set_project_settings',args:party?{scope:'start',actorIds:ids}:{title:'검증된 프로젝트'}}];
  const streamFn = (_model:any,context:any) => {
    rounds.push({names:context.tools.map((t:any)=>t.name),schemaChars:JSON.stringify(context.tools.map(schema)).length});
    const step=steps[rounds.length-1];
    const stream=createAssistantMessageEventStream();
    queueMicrotask(()=>{
      const msg:any={role:'assistant',api:'gemini',provider:'google-antigravity',model:'scripted',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0},timestamp:Date.now(),stopReason:step?'toolUse':'stop',
        content:step?[{type:'toolCall',id:`t${rounds.length}`,name:step.name,arguments:step.args}]:[{type:'text',text:request.readOnly?'프로젝트 정보를 조회했습니다.':miss?'빈 검색 뒤 전체 툴 목록을 복구하고 프로젝트 정보를 확인했습니다.':party?'시작 파티를 두 명으로 설정했습니다.':'프로젝트 제목을 변경했습니다.'}]};
      stream.push({type:'start',partial:msg} as never);
      stream.push({type:'done',reason:msg.stopReason,message:msg} as never);
    }); return stream;
  };
  const done=await runPiAgent({...request,provider:'google-antigravity',model:undefined,maxTurns:6},{streamFn:streamFn as never,onEvent:e=>events.push(e)});
  const report={scriptedModel:true,task,initialToolNames:request.initialToolNames,readOnly:request.readOnly,rounds,stats:done.stats,changedKeys:done.changedKeys,party:done.project.system.startActorIds,title:done.project.meta.title,events:events.filter(e=>['tool_start','tool_end','error'].includes(e.type))};
  writeFileSync(`${out}/browser-run-${++index}.json`,JSON.stringify(report,null,2));
  return new Response(events.map(e=>JSON.stringify(e)).join('\n')+'\n',{headers:{'Content-Type':'application/x-ndjson'}});
}});
writeFileSync(`${out}/worker-port.txt`,String(server.port));
console.log(`QA worker: ${server.port}`);
