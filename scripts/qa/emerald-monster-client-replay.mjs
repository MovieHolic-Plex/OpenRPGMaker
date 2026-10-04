// Private browser replay of recorded REAL model output. No model, host DB or canonical writes.
// Transport envelopes are reconstructed from the final artifact; original checkpoint events were not recorded.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const source=path.resolve(arg('real-run','/tmp/oprn-emerald-20261004/monster-runner-real'));
const out=path.resolve(arg('out','/tmp/oprn-emerald-20261004/monster-client-replay-browser'));
const origin=arg('browser-url','http://127.0.0.1:9853');
await fs.mkdir(out,{recursive:true,mode:0o700});
const candidatePath=path.join(source,'candidate-private.json'),candidateBytes=await fs.readFile(candidatePath);
const candidateServer=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin','Access-Control-Allow-Private-Network':'true','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,OPTIONS'});createReadStream(candidatePath).pipe(res);});
await new Promise(resolve=>candidateServer.listen(0,'127.0.0.1',resolve));
const candidateUrl='http://127.0.0.1:'+candidateServer.address().port+'/candidate-private.json';
const summary=JSON.parse(await fs.readFile(path.join(source,'SUMMARY.json'),'utf8'));
const setup=JSON.parse(await fs.readFile(path.join(source,'setup.json'),'utf8'));
const broker=JSON.parse(await fs.readFile(path.join(source,'broker.json'),'utf8'));
const images=broker.filter(x=>x.toolName==='show_opening_image').map(x=>x.data.resourceId);
const errors=[],networkFailures=[],suppressedWrites=[],progress=[];
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-features=LocalNetworkAccessChecks']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('crash',()=>errors.push('Private browser page crashed'));
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>networkFailures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400)networkFailures.push({url:r.url(),status:r.status()});});
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.text().startsWith('REPLAY:')){progress.push(m.text());console.log(m.text());}});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()!=='GET'&&req.method()!=='HEAD'){
   suppressedWrites.push({method:req.method(),path:url.pathname});
   // Observability disk mirrors are suppressed; this page has no storage bridge or target.
   await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"qaSuppressed":true}'});return;
  }
  if(url.pathname==='/emerald-client-replay.html'){
   await route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="UTF-8"><title>Recorded real Pi client replay</title><style>body{background:#101b27;color:#e5edf4;font:16px sans-serif;padding:24px}h1{font-size:22px}#receipt{white-space:pre-wrap}#media img{max-height:230px;max-width:300px;image-rendering:pixelated;margin:8px}#cards{max-height:280px;overflow:auto}pre{white-space:pre-wrap}</style></head><body><h1>Recorded real model output — private frontend replay</h1><p>No second model call · reconstructed transport · no canonical save</p><pre id="receipt">Preparing production modules…</pre><section id="media"></section><section id="cards"></section></body></html>'});return;
  }
  await route.continue();
 });
 await page.goto(new URL('/emerald-client-replay.html?blankProject=1',origin).href);
 const report=await page.evaluate(async ({summary,setup,images,candidateUrl})=>{
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  const log=text=>console.log('REPLAY: '+text);
  const originalFetch=window.fetch.bind(window);
  const {store}=await import('/src/project/store.ts');
  const {projectRepository}=await import('/src/project/persistence/repository.ts');
  const {createBlankProject}=await import('/src/project/defaults/blankProject.ts');
  const {classifyPlainPiTurn}=await import('/src/ai/piAgent/plainTurn.ts');
  const {resolveAutonomy}=await import('/src/ai/autonomyLevels.ts');
  const {plainPiCommand,runPiCommand}=await import('/src/editor/panels/aiPiAgentCommand.ts');
  const protocol=await import('/src/ai/piAgent/protocol.ts');
  const {captureApplyAuthority,applyProposedProject}=await import('/src/editor/tools/applyChangesetToStore.ts');
  const {defaultAiConfig,saveAiConfig}=await import('/src/ai/llmClient.ts');
  const {reviewMonsterGame,monsterGameFingerprint}=await import('/src/editor/tools/monsterGameReview.ts');
  const {getEditActivityEntries}=await import('/src/editor/editActivityLog.ts');
  const {openingImageProject}=await import('/src/ai/piAgent/openingProduction.ts');
  assert(projectRepository().kind==='memory'&&projectRepository().currentTarget()===null,'A durable target is attached; refusing private replay');
  saveAiConfig({...defaultAiConfig(),providerId:setup.provider,model:setup.model,liteModel:setup.model,
   piApply:'yolo',piTeam:false,autonomyLevel:'autonomous',roleModels:{deep:{provider:setup.provider,model:setup.model,thinkingLevel:'medium'},writer:{provider:setup.provider,model:setup.model,thinkingLevel:'medium'}}});
  log('Production modules loaded; memory repository has no durable target');
  const candidate=await (await originalFetch(candidateUrl)).json();
  assert(!candidate.spatialAuthoring,'Recorded spatial authority is unavailable; refusing to fabricate proof');
  const actual=reviewMonsterGame(candidate);assert(!actual.issues.length,'Recorded candidate has production issues: '+actual.issues.join('; '));
  const candidateFingerprint=monsterGameFingerprint(candidate),requests=[],acks=[],clientEvents=[],statuses=[],receipts=[],runs=[];
  let replayKind='done',base,oldAuthority;
  async function bodyOf(init){
   if(!init?.body)return {};
   let response=new Response(init.body);
   if(new Headers(init.headers).get('Content-Encoding')==='gzip')response=new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
   return JSON.parse(await response.text());
  }
  function streamEvents(events){
   async function* lines(){for(const event of events){const line=JSON.stringify(event)+'\n';for(let i=0;i<line.length;i+=262144)yield new TextEncoder().encode(line.slice(i,i+262144));}}
   const iterator=lines();return new ReadableStream({async pull(controller){const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}});
  }
  window.fetch=async (url,init)=>{
   const address=new URL(typeof url==='string'?url:url.url,location.href);
   if(!address.pathname.startsWith('/v1/agent/'))return originalFetch(url,init);
   const body=await bodyOf(init);
   if(address.pathname==='/v1/agent/run'){
    const request=body;requests.push({replayKind,mode:request.mode,task:request.task,mapIds:request.mapIds,scopeStrict:request.scopeStrict,mapBundleMerge:request.mapBundleMerge,initialToolNames:request.initialToolNames,runId:request.runId,heavyKeys:Object.keys(request.heavy??{})});
    assert(request.task.includes('포켓몬 같은 게임 만들어')&&request.initialToolNames?.includes('build_monster_game'),'Native ordinary request did not activate whole-game production');
    assert(request.scopeStrict===false&&!request.mapBundleMerge,'Native ordinary request was restricted to a map bundle');
    const wire=protocol.slimProjectForWire(base,candidate);
    const events=[];
    if(replayKind==='checkpoint'){
     events.push({type:'checkpoint',checkpointId:'recorded-final-candidate',label:'QA replay: actual final model candidate',toolName:'build_monster_game',...wire});
     // Repeat the SAME authored result with all heavy fields omitted. No fake intermediate model work.
     events.push({type:'checkpoint',checkpointId:'recorded-final-heavy-omitted',label:'QA replay: identical final candidate, heavy restoration',toolName:'read_monster_game',project:protocol.slimCheckpointProject(candidate,['assets','database','tilesets']),unchangedKeys:['assets','database','tilesets']});
     for(const resourceId of images)events.push({type:'render_request',renderId:'recorded-image-'+resourceId,toolName:'show_opening_image',data:{resourceId},project:openingImageProject(candidate,[resourceId])});
    }
    events.push({type:'assistant',text:'[Recorded real-run replay: final authored result; no second model request]'});
    events.push({type:'done',...wire,stats:summary.stats,changedKeys:summary.changedKeys,monsterGameProduction:summary.monsterGameProduction,gameSystemProduction:summary.gameSystemProduction,...(summary.openingProduction?{openingProduction:summary.openingProduction}:{})});
    log(replayKind+' NDJSON: reconstructed envelopes; candidateFingerprint '+candidateFingerprint+'; unchanged tilesets '+wire.unchangedTilesetIds.length);
    return new Response(streamEvents(events),{headers:{'Content-Type':'application/x-ndjson','X-Oprn-Run-Id':request.runId}});
   }
   if(address.pathname==='/v1/agent/checkpoint'){
    acks.push({kind:'checkpoint',id:body.checkpointId,ok:body.ok,issue:body.issue,returnedMapCount:Object.keys(body.project?.maps??{}).length,returnedUploadedCount:Object.keys(body.project?.assets?.uploaded??{}).length,returnedSpeciesCount:body.project?.database?.monsterSpecies?.length??0});
    assert(body.ok,'Native checkpoint apply failed: '+body.issue);
    return new Response('{}',{headers:{'Content-Type':'application/json'}});
   }
   if(address.pathname==='/v1/agent/render'){
    const bytes=body.png?Uint8Array.from(atob(body.png),c=>c.charCodeAt(0)):new Uint8Array();
    const pngHeader=[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
    acks.push({kind:'render',id:body.renderId,issue:body.issue,pngBytes:bytes.length,pngHeader});
    assert(!body.issue&&pngHeader,'Actual browser image restoration/render failed: '+body.issue);
    const img=new Image();img.src='data:image/png;base64,'+body.png;img.alt=body.renderId;document.querySelector('#media').append(img);await img.decode();
    return new Response('{}',{headers:{'Content-Type':'application/json'}});
   }
   throw Error('Unexpected companion operation during recorded replay: '+address.pathname);
  };
  function surface(){return {
   appendBubble:(role,text)=>{const p=document.createElement('p');p.textContent=role+': '+text;document.querySelector('#cards').append(p);},
   appendCard:node=>document.querySelector('#cards').append(node),appendProcess:()=>{},
   setStatus:text=>statuses.push(text),getCurrentMapId:()=>store.getCurrent().startMapId,
   onRunAudit:rows=>clientEvents.push({type:'audit',count:rows.length}),
   showChangeReceipt:r=>receipts.push({title:r.title,detail:r.detail,mapId:r.mapId,maps:Object.keys(r.after.maps).length,species:r.after.database.monsterSpecies.length}),
  };}
  async function run(kind){
   replayKind=kind;store.replaceProject(createBlankProject(),{label:'Private recorded-output replay seed',origin:'system'});base=store.getCurrent();oldAuthority=captureApplyAuthority(base);
   const route=await classifyPlainPiTurn({project:base,text:setup.task,currentMapId:base.startMapId,selection:null,hasActivePlan:false,autonomy:resolveAutonomy('autonomous'),piTeam:false,declarer:()=>{throw Error('Unexpected second intent model request');}});
   assert(route.mode==='single'&&route.routingAudit.startsWith('intent:emerald-monster-game'),'Ordinary frontend classifier missed the whole game');
   const command=plainPiCommand(setup.task,route.mode,base.startMapId);
   const ok=await runPiCommand(command,surface(),{...route.plan,initialToolNames:route.initialToolNames,intentNote:route.intentNote,routingAudit:route.routingAudit});
   const current=store.getCurrent(),review=reviewMonsterGame(current);
   assert(ok&&!review.issues.length&&review.maps===72&&review.species===60,'Native '+kind+' application did not produce actual complete campaign');
   assert(monsterGameFingerprint(current)===candidateFingerprint,'Native application changed the recorded authored candidate');
   const beforeFingerprint=monsterGameFingerprint(current);
   const stale=await applyProposedProject(candidate,{...oldAuthority,source:'agent',summary:'QA stale original blank authority must reject',toolNames:['pi_agent'],mapDestructionApproved:true});
   assert(!stale.ok&&['stale-base','stale-baseline'].includes(stale.reason),'Stale proposal authority was accepted');
   assert(monsterGameFingerprint(store.getCurrent())===beforeFingerprint,'Stale application mutated the actual applied campaign');
   runs.push({kind,ok,routingAudit:route.routingAudit,commandMapIds:command.mapIds,scopedByUser:command.scopedByUser??false,review,candidateFingerprint,appliedFingerprint:beforeFingerprint,staleRejected:stale.reason});
   log(kind+' native runPiCommand applied '+review.maps+'/'+review.species+'; stale source rejected '+stale.reason);
  }
  await run('done');await run('checkpoint');
  assert(acks.filter(x=>x.kind==='checkpoint').length===2,'Checkpoint ACKs missing');
  assert(acks.filter(x=>x.kind==='render').length===images.length,'Real-run image IDs were not delivered');
  assert(receipts.length===2&&receipts.every(r=>r.maps===72&&r.species===60),'Native final receipt callback missing');
  const activities=getEditActivityEntries().map(e=>({origin:e.origin,label:e.label,scope:e.scope}));
  const result={scope:'Recorded real-model final output replay through actual browser classifier/plainPiCommand/runPiCommand/client NDJSON/checkpoint publication/apply gate/store. Reconstructed envelopes; no second live model request.',requests,acks,runs,receipts,statuses,activities,repository:{kind:projectRepository().kind,target:projectRepository().currentTarget()},openingImageIds:images,finalFingerprint:monsterGameFingerprint(store.getCurrent()),canonicalSaved:false,originalCheckpointEventsRecorded:false};
  document.querySelector('#receipt').textContent=JSON.stringify({scope:result.scope,runs:runs.map(r=>({kind:r.kind,maps:r.review.maps,species:r.review.species,issues:r.review.issues,staleRejected:r.staleRejected})),receipts,acks,repository:result.repository},null,2);
  window.__emeraldClientReplayReceipt=result;window.fetch=originalFetch;
  return result;
 },{summary,setup,images,candidateUrl});
 await page.screenshot({path:path.join(out,'browser-receipt.png'),fullPage:true});
 const receipt={...report,realRun:{candidateSha256:createHash('sha256').update(candidateBytes).digest('hex'),stats:summary.stats,task:setup.task,source},browserUrl:origin,errors,networkFailures,suppressedWrites,progress};
 await fs.writeFile(path.join(out,'SUMMARY.json'),JSON.stringify(receipt,null,2),{mode:0o600});
 console.log(JSON.stringify({done:report.runs.map(r=>({kind:r.kind,maps:r.review.maps,species:r.review.species,staleRejected:r.staleRejected})),images:report.openingImageIds,errors,networkFailures,out}));
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:String(error),errors,networkFailures,suppressedWrites,progress},null,2));throw error;}
finally{await browser.close();await new Promise(resolve=>candidateServer.close(resolve));}
