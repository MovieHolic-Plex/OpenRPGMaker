// Bounded real Pi + LLM + browser image-model dogfood. Produces a PRIVATE candidate,
// never writes canonical storage. Save/reload and exported-player QA are separate gates.
// bun scripts/qa/opening-assistant-run.mts --project-json <file> --media-json <portable-file>
//   --browser-url http://127.0.0.1:9853 --model opencodex/gpt-6-astra --task "..."
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {buildModel} from '@oh-my-pi/pi-catalog/build';
import {runPiAgent} from '../lib/piAgentRuntime';
import {requestPiOpeningGeneration,requestPiRender,resolvePiRender} from '../lib/piRenderBroker';
import {restoreCheckpointProject,type PiAgentEvent} from '../../src/ai/piAgent/protocol';
import {buildSessionRegistryTools} from '../../src/ai/sessionToolExposure';
import {decodeCinematicWire} from '../../src/project/cinematicWire';
import type {Project} from '../../src/project/types';
const arg=(name:string,fallback?:string)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const input=arg('project-json'),origin=arg('browser-url');
if(!input||!origin)throw Error('--project-json and --browser-url are required');
const out=path.resolve(arg('out','/tmp/oprn-opening-assistant-'+Date.now())!);fs.mkdirSync(out,{recursive:true,mode:0o700});
const raw=fs.readFileSync(input),project=decodeCinematicWire(JSON.parse(raw.toString()) as Project);
const mediaPath=arg('media-json'),portable=mediaPath?JSON.parse(fs.readFileSync(mediaPath,'utf8')) as Project:undefined;
const transport:{id:string;sha256:string}[]=[];
for(const [id,asset] of Object.entries(project.assets.uploaded)) if(asset.ref){
 const url=portable?.assets.uploaded[id]?.dataUrl,match=/^data:([^;,]+);base64,(.+)$/.exec(url??'');
 if(!match)throw Error('SQLite media requires SHA-matched --media-json: '+id);
 const sha=createHash('sha256').update(Buffer.from(match[2],'base64')).digest('hex');
 if(sha!==asset.ref.sha256)throw Error('Media SHA mismatch: '+id);
 transport.push({id,sha256:sha});delete asset.ref;asset.dataUrl=url;
}
const baseline=structuredClone(project);
const [provider,modelId]=arg('model','opencodex/gpt-6-astra')!.split('/');
const cfg=Bun.YAML.parse(fs.readFileSync(path.join(os.homedir(),'.omp/agent/models.yml'),'utf8')) as any;
const prov=(cfg.providers??cfg)[provider],md=prov?.models?.find((m:any)=>m.id===modelId),apiKey=prov?.apiKey;
if(!md||typeof apiKey!=='string'||!apiKey)throw Error('Local OMP model/credential unavailable');
const model=buildModel({id:md.id,name:md.name,api:prov.api,provider,baseUrl:prov.baseUrl,reasoning:md.reasoning,thinking:md.thinking,input:md.input,cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:md.contextWindow,maxTokens:md.maxTokens,compat:{...prov.compat,...md.compat}} as never);
const redact=(v:any):any=>typeof v==='string'?v.split(apiKey).join('[redacted]').replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/g,'[media-redacted]'):Array.isArray(v)?v.map(redact):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,/^(dataUrl|apiKey|accessToken|refreshToken|authorization|token|png|base64)$/i.test(k)?'[redacted]':redact(x)])):v;
const write=(file:string,value:unknown)=>fs.writeFileSync(path.join(out,file),JSON.stringify(redact(value),null,2),{mode:0o600});
const task=arg('task','오프닝이 밋밋해. 기존 인물과 첫 플레이를 확인해서 사건과 캐릭터의 매력을 그림으로 보여주는 도입을 새로 만들어줘. 설명만 길게 하지 말고 타이틀·맵·NPC·전투·시작 세션은 유지해.')!;
const maxTurns=Number(arg('max-turns','32')),timeoutMs=Number(arg('timeout-ms','900000'));
const intent={mode:'modify',space:'none',facility:null,targetMapId:null,useSelection:false,clarify:null,clarifyOptions:[],needsPlan:true,resetsContext:false,summary:task,source:'llm',tools:['get_opening','list_opening_media','review_opening','set_opening','edit_opening','generate_opening_image','get_database_records','list_resources','get_game_design_brief']};
const initialToolNames=buildSessionRegistryTools({requestText:task,intent:intent as never}).map(t=>t.function.name);
const bridge=spawn(process.execPath.includes('bun')?'node':process.execPath,[path.resolve('scripts/qa/opening-assistant-browser-bridge.mjs'),origin,...(arg('image-provider')?[arg('image-provider')!,arg('image-model','codex-image-default')!]:[])],{stdio:['ignore','pipe','pipe']});
bridge.stderr.on('data',()=>{}); // Never echo an upstream credential-bearing diagnostic.
const port=await new Promise<number>((resolve,reject)=>{
 let lines='';const timer=setTimeout(()=>{bridge.kill();reject(Error('Browser bridge startup timed out'));},60000);
 bridge.stdout.on('data',chunk=>{lines+=chunk;const line=lines.split('\n').find(s=>s.startsWith('{"ready":'));if(line){clearTimeout(timer);resolve(JSON.parse(line).port);}});
 bridge.on('exit',code=>{clearTimeout(timer);reject(Error('Browser bridge exited: '+code));});
});
const events:unknown[]=[],calls:unknown[]=[],brokerCalls:unknown[]=[];
const emitQA=(e:PiAgentEvent)=>{if(e.type!=='render_request')return;
 brokerCalls.push({toolName:e.toolName,data:e.data});write('broker.json',brokerCalls);
 void(async()=>{try{
  const draft=restoreCheckpointProject(project,e.project,e.unchangedKeys,e.unchangedTilesetIds),generation=e.toolName==='generate_opening_image';
  const response=await fetch(`http://127.0.0.1:${port}/${generation?'generate':'render'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(generation?{project:draft,args:e.data}:{project:draft,toolName:e.toolName,data:e.data}),signal:AbortSignal.timeout(300000)});
  const reply=await response.json() as any;if(!response.ok||(generation&&!reply.ok))throw Error(reply.error??reply.summary??'Actual browser image tool failed');
  if(!resolvePiRender(generation?{renderId:e.renderId,still:reply}:{renderId:e.renderId,png:reply.png}))throw Error('Broker rejected image reply');
 }catch(error){resolvePiRender({renderId:e.renderId,issue:String(redact(String(error)))});}})();
};
write('setup.json',{provider,model:modelId,task,maxTurns,timeoutMs,initialToolNames,inputSha256:createHash('sha256').update(raw).digest('hex'),transport,method:'Real Pi runtime/model, actual browser image helpers and production render broker. Fixed opening intent exposure; frontend intent classifier/client NDJSON dispatcher not exercised. Private candidate only; canonical save and shipping playback separate.'});
try{
 const done=await runPiAgent({provider,model:modelId,task,mapIds:[],scopeStrict:false,project,maxTurns,thinkingLevel:'high',initialToolNames},{model:model as never,apiKey,timeoutMs,
  generateOpeningImage:(p,args,signal)=>requestPiOpeningGeneration(p,project,args,emitQA,signal??new AbortController().signal),
  renderToolImage:(p,name,data,signal)=>requestPiRender(p,project,name,data,emitQA,signal??new AbortController().signal),
  onToolCall:r=>{calls.push(r);write('calls.json',calls);process.stdout.write(r.name+' '+r.result.ok+'\n');},
  onEvent:e=>{if(['assistant','error','turn','execution_status','tool_end'].includes(e.type)){events.push(e);write('events.json',events);}},
 });
 fs.writeFileSync(path.join(out,'candidate-private.json'),JSON.stringify(done.project),{mode:0o600});
 write('SUMMARY.json',{stats:done.stats,stoppedEarly:done.stoppedEarly,openingProduction:done.openingProduction,changedKeys:done.changedKeys,mapsPreserved:isDeepStrictEqual(baseline.maps,done.project.maps),databasePreserved:isDeepStrictEqual(baseline.database,done.project.database),sessionPreserved:isDeepStrictEqual(baseline.session,done.project.session),canonicalSaved:false,playbackVerified:false});
 if(done.stoppedEarly||done.openingProduction?.issues.length)process.exitCode=1;
 console.log('Evidence: '+out);
}catch(error){write('failure.json',{error:String(error)});process.exitCode=1;console.error('Actual assistant run failed; see private evidence.');}
finally{bridge.kill('SIGTERM');}
