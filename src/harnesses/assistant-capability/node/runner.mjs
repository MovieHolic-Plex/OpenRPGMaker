import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { evaluate, knownGood, resultStatus, MAP } from './checks.mjs';
import { execute, digest, stored, observeSaved, writeRuntimeProject, captureSaved } from './editorDriver.mjs';
import { verifyRuntime } from './runtimeVerifier.mjs';

const seedPath=resolve('harness-data/assistant-capability/seed.json');
const seed=JSON.parse(readFileSync(seedPath,'utf8'));
const args=process.argv.slice(2), stage=args[0];
function option(name,fallback) {const i=args.indexOf(`--${name}`);if(i<0)return fallback;const value=args[i+1];if(!value||value.startsWith('--'))throw Error(`--${name} 값 필요`);return value;}
const root=resolve(option('out','qa-runs/harnesses/assistant-capability/latest'));
const chosen=option('case');
let stopRequested=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopRequested=true;});
const entries=seed.cases.filter(entry=>!chosen||chosen.split(',').includes(entry.id));
if(!entries.length)throw Error(`모르는 과제 ${chosen}`);
const save=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const gate=(checks)=>({status:checks.every(c=>c.ok)?'pass':'fail',checks});
function persistenceGate(receipt) {
  if(receipt.sameTarget&&receipt.reloadEqual&&receipt.libraryRevisionChange?.gameContentEqual)return {status:'blocked',detail:'재로드 중 공용 라이브러리 판본이 바뀌었다. 게임 내용은 같지만 동일 판본의 저장 게이트는 판정할 수 없다.',receipt};
  return gate([{id:'same-target-reload',ok:receipt.sameTarget&&receipt.sameStoredDocument&&receipt.reloadEqual&&!receipt.flush.dirty,detail:JSON.stringify(receipt)}]);
}
function lockCase(dir) {
  const file=resolve(dir,'run.lock'),fd=openSync(file,'wx');
  writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));closeSync(fd);
  // Crashed-run locks are deliberately retained until the owner and workers have
  // actually exited. A second harness must not silently start on the same map.
  return ()=>unlinkSync(file);
}
const harnessDigest=digest(['checks.mjs','editorDriver.mjs','runtimeVerifier.mjs','runner.mjs','fixture.ts','runtimeProjection.ts'].map(file=>readFileSync(resolve('src/harnesses/assistant-capability/node',file),'utf8')).join('\n'));
const escaped=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function results(runRoot=root) {
  return seed.cases.map(entry=>{
    const dir=resolve(runRoot,entry.id),file=resolve(dir,'result.json');
    if(!existsSync(file))return{caseId:entry.id,title:entry.title,status:'unexecuted',gates:{}};
    const result=JSON.parse(readFileSync(file,'utf8'));
    const traceFile=resolve(dir,'trace.json');
    const trace=existsSync(traceFile)?JSON.parse(readFileSync(traceFile,'utf8')):null;
    if(result.gates.execution?.status==='pass'&&!trace?.events?.some(e=>e.type==='done'))
      result.gates.execution={status:'blocked',detail:'모델 요청 영수증은 있으나 원본 SSE done 기록이 누락되어 실행 증거를 완성할 수 없다. 이전 실행기 재시작 관측 장애는 보존·요구 판정과 구분한다.'};
    const reviewFile=resolve(dir,'visual-review.json');
    if(existsSync(reviewFile)) {
      const review=JSON.parse(readFileSync(reviewFile,'utf8'));
      const fresh=review.resultDigest===digest(readFileSync(file)) && review.images.length>0 && review.images.every(image=>
        existsSync(resolve(dir,image.file))&&digest(readFileSync(resolve(dir,image.file)))===image.sha256);
      if(fresh)result.gates.visual={status:review.status,reviewer:review.reviewer,notes:review.notes,evidence:review.images.map(i=>i.file)};
    }
    result.status=resultStatus(result);return result;
  });
}
function aggregateRows() {
  const sources=option('sources','').split(',').filter(Boolean).map(p=>resolve(p));
  if(!sources.length)throw Error('aggregate --sources <실행 폴더,...> --out <집계 폴더>');
  const attempts=sources.flatMap(source=>results(source).filter(r=>r.status!=='unexecuted').map(r=>{
    const trace=resolve(source,r.caseId,'trace.json');
    const native=r.models?.some(q=>q.endpoint==='/v1/agent/run')||(existsSync(trace)&&JSON.parse(readFileSync(trace,'utf8')).requests.some(q=>q.endpoint==='/v1/agent/run'));
    return {...r,sourceDir:source,nativeInput:native};
  }));
  return seed.cases.map(entry=>{
    const candidates=attempts.filter(r=>r.caseId===entry.id).sort((a,b)=>String(a.startedAt).localeCompare(String(b.startedAt)));
    // Choose the first actual model trial, never the best or latest trial.
    const first=candidates.find(r=>r.nativeInput)??candidates[0]??{caseId:entry.id,title:entry.title,status:'unexecuted',gates:{}};
    return {...first,attempts:candidates.map(r=>({sourceDir:r.sourceDir,startedAt:r.startedAt,status:r.status,nativeInput:r.nativeInput}))};
  });
}
function report() {
  mkdirSync(root,{recursive:true});
  const rows=stage==='aggregate'?aggregateRows():results();
  const counts=Object.fromEntries(['pass','fail','blocked','pending','unexecuted'].map(s=>[s,rows.filter(r=>r.status===s).length]));
  const summary={schemaVersion:1,suite:seed.suite,seedDigest:digest(readFileSync(seedPath)),counts,total:rows.length,
    strictPassRate:counts.pass/rows.length,executed:rows.length-counts.unexecuted,
    bootstrapAttempts:rows.flatMap(r=>r.attempts??[]).filter(a=>!a.nativeInput).length,
    actualModelTrials:rows.filter(r=>r.nativeInput).length,coverageGaps:seed.coverageGaps,results:rows};
  save(resolve(root,'summary.json'),summary);
  const statuses={pass:'통과',fail:'실패',blocked:'환경 차단',pending:'미검증',unexecuted:'미실행','not-required':'해당 없음'};
  const lines=['# 조수 기능 검증', '',`전체 ${rows.length} · 통과 ${counts.pass} · 실패 ${counts.fail} · 환경 차단 ${counts.blocked} · 미검증 ${counts.pending} · 미실행 ${counts.unexecuted}`,'',
    '| 기능 | 최종 | 실제 실행 | 요구 | 보존·반례 | 플레이 | 저장 | 시각 |','|---|---|---|---|---|---|---|---|'];
  for(const r of rows)lines.push(`| ${r.title} | ${statuses[r.status]} | ${['execution','requirements','adversarial','runtime','persistence','visual'].map(k=>statuses[r.gates[k]?.status]??'미실행').join(' | ')} |`);
  if(stage==='aggregate')lines.push('',`최초 실제 모델 과제 ${summary.actualModelTrials}/${rows.length}. 입력 전 기동 장애 ${summary.bootstrapAttempts}건은 attempts에 별도 보존한다. 재관측은 모델 재실행이 아니다.`,
    '',...rows.map(r=>`- ${r.caseId}: ${r.sourceDir??'미실행'} (시도 ${r.attempts.length}개)`));
  lines.push('','## 실패·미검증 근거','');
  for(const r of rows.filter(r=>r.status!=='pass'&&r.status!=='unexecuted')) {
    lines.push(`- ${r.caseId}: ${r.failure??Object.entries(r.gates).filter(([,g])=>['fail','blocked','pending'].includes(g.status)).map(([k,g])=>`${k}: ${(g.checks??[]).filter(c=>!c.ok).map(c=>c.id+': '+c.detail).join('; ')||g.detail||g.notes||g.status}`).join(' / ')}`);
  }
  lines.push('','## 아직 측정하지 않은 기능','',...seed.coverageGaps.map(v=>`- ${v}`));
  writeFileSync(resolve(root,'SUMMARY.md'),lines.join('\n')+'\n');
  const htmlRows=rows.map(r=>{
    const dir=resolve(r.sourceDir??root,r.caseId),link=relative(root,dir);
    return `<tr><td><details><summary>${escaped(r.title)}</summary><p>${escaped(seed.cases.find(c=>c.id===r.caseId).prompt)}</p><pre>${escaped(JSON.stringify(r.gates,null,2))}</pre>${existsSync(resolve(dir,'after.png'))?`<a href="${escaped(link)}/after.png">변경 화면</a> · <a href="${escaped(link)}/reloaded.png">재로드 화면</a>`:''}</details></td><td>${statuses[r.status]}</td>${['execution','requirements','adversarial','runtime','persistence','visual'].map(k=>`<td>${statuses[r.gates[k]?.status]??'미실행'}</td>`).join('')}</tr>`;
  }).join('');
  writeFileSync(resolve(root,'report.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>조수 기능 검증</title><style>body{font:16px system-ui;max-width:1300px;margin:24px auto;padding:0 16px;color-scheme:light dark}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border-bottom:1px solid GrayText}pre{white-space:pre-wrap;max-width:650px}summary{cursor:pointer}p{max-width:650px}.scroll{overflow:auto}</style><h1>조수 기능 검증</h1><p>통과 ${counts.pass} · 실패 ${counts.fail} · 환경 차단 ${counts.blocked} · 미검증 ${counts.pending} · 미실행 ${counts.unexecuted}</p><div class="scroll"><table><thead><tr><th>기능</th><th>최종</th><th>실제 실행</th><th>요구</th><th>보존·반례</th><th>플레이</th><th>저장</th><th>시각</th></tr></thead><tbody>${htmlRows}</tbody></table></div><p>측정 범위 밖: ${escaped(seed.coverageGaps.join(' · '))}</p></html>`);
  console.log(JSON.stringify({out:root,counts,total:rows.length}));return summary;
}
async function selfCheck() {
  const checks=[];
  const fallback=seed.cases.find(entry=>existsSync(resolve(root,entry.id,'initial.json')));
  if(!fallback)throw Error('prepare로 초기 정본부터 준비하세요');
  for(const entry of seed.cases) {
    const caseDir=resolve(root,existsSync(resolve(root,entry.id,'initial.json'))?entry.id:fallback.id);
    const file=resolve(caseDir,existsSync(resolve(caseDir,'initial-check.json'))?'initial-check.json':'initial.json');
    const before=JSON.parse(readFileSync(file,'utf8'));
    // Content-addressed tile dictionaries keep the same preservation contract
    // without repeatedly cloning tens of megabytes of unrelated reference text.
    if(!existsSync(resolve(caseDir,'initial-check.json'))) before.tilesets=Object.fromEntries(Object.entries(before.tilesets).map(([id,value])=>[id,{$blob:digest(JSON.stringify(value))}]));
    const answer=entry.check==='inspect'?'미루 (8,7) 첫 대사 반짝이는 풀 / 마사 (12,7) 15G': '일회성 보상은 처음 대화에서 한 번만 주고 스위치를 이용하여 재대화에서는 지급하지 않는 계획입니다.';
    const good=knownGood(entry,before);
    const evaluateAll=p=>Object.values(evaluate(entry,before,p,answer)).flat().every(c=>c.ok);
    checks.push({id:`${entry.id}:known-good`,ok:evaluateAll(good)});
    const wrong=structuredClone(good);wrong.maps[MAP].events.find(e=>e.id==='ev_ember_guard').x++;
    checks.push({id:`${entry.id}:unrelated-edit-rejected`,ok:!evaluateAll(wrong)});
    if(!['inspect','plan'].includes(entry.check))checks.push({id:`${entry.id}:no-op-rejected`,ok:!evaluateAll(before)});
    const lost=structuredClone(good);delete lost.maps.map_mist_forest;
    checks.push({id:`${entry.id}:other-map-loss-rejected`,ok:!evaluateAll(lost)});
    if(entry.check==='graphic') {
      const wrongChip=structuredClone(good);wrongChip.maps[MAP].events.find(e=>e.id==='ev_ember_child').pages[0].graphic.sprite.id=entry.textureKey==='tex_easyrpg_charset_monster2'?'tex_easyrpg_charset_people3':'tex_easyrpg_charset_monster2';
      checks.push({id:`${entry.id}:wrong-sheet-rejected`,ok:!evaluateAll(wrongChip)});
      const wrongFrame=structuredClone(good);wrongFrame.maps[MAP].events.find(e=>e.id==='ev_ember_child').pages[0].graphic.pattern=entry.frame===73?4:1;
      checks.push({id:`${entry.id}:slot-as-frame-rejected`,ok:!evaluateAll(wrongFrame)});
    }
    if(entry.check==='choice') {
      const separate=structuredClone(good),first=separate.maps[MAP].events.find(e=>e.id==='ev_ember_child').pages[0];
      delete first.commands[0].prompt;first.commands.unshift({kind:'text',body:'어디로 갈까?',speaker:'꼬마 미루'});
      checks.push({id:'choice:separate-question-accepted',ok:evaluateAll(separate)});
      const broken=structuredClone(good);broken.maps[MAP].events.find(e=>e.id==='ev_ember_child').pages[0].commands[0].options[1].branch=[];
      checks.push({id:'choice:missing-branch-rejected',ok:!evaluateAll(broken)});
      const cancel=structuredClone(good);cancel.maps[MAP].events.find(e=>e.id==='ev_ember_child').pages[0].commands[0].cancelBranch=[{kind:'changeGold',op:'+=',amount:999}];
      checks.push({id:'choice:cancel-reward-rejected',ok:!evaluateAll(cancel)});
    }
    if(entry.check==='reward') {
      const broken=structuredClone(good);const npc=broken.maps[MAP].events.find(e=>e.id==='ev_ember_child');
      npc.pages=npc.pages.filter(p=>p.id!=='child_reward_done');npc.pages[0].commands=npc.pages[0].commands.filter(c=>c.kind!=='setSelfSwitch');
      checks.push({id:'reward:unguarded-reward-rejected',ok:!evaluateAll(broken)});
    }
  }
  // Empty/missing evidence must never result in PASS.
  checks.push({id:'gate:empty-not-pass',ok:resultStatus({gates:{}})!=='pass'},
    {id:'gate:pending-not-pass',ok:resultStatus({gates:{visual:{status:'pending'}}})!=='pass'},
    {id:'gate:failure-overrides-passes',ok:resultStatus({gates:{data:{status:'pass'},visual:{status:'fail'}}})==='fail'});
  const stable={sameTarget:true,sameStoredDocument:true,reloadEqual:true,flush:{dirty:false}};
  const edition={...stable,sameStoredDocument:false,libraryRevisionChange:{gameContentEqual:true}};
  checks.push({id:'persistence:stable-reload',ok:persistenceGate(stable).status==='pass'},
    {id:'persistence:changed-game-rejected',ok:persistenceGate({...stable,reloadEqual:false}).status==='fail'},
    {id:'persistence:library-change-blocked',ok:persistenceGate(edition).status==='blocked'},
    {id:'persistence:other-target-not-library-exception',ok:persistenceGate({...edition,sameTarget:false}).status==='fail'});
  const outcome={schemaVersion:1,kind:'checker-calibration',pass:checks.every(c=>c.ok),checks};
  save(resolve(root,'self-check.json'),outcome);console.log(JSON.stringify(outcome,null,2));return outcome.pass?0:1;
}
async function runCases() {
  const calibration=resolve(root,'self-check.json');
  if(!existsSync(calibration)||JSON.parse(readFileSync(calibration,'utf8')).pass!==true)throw Error('검증기 self-check 통과 영수증이 먼저 필요합니다');
  for(const entry of entries) {
    if(stopRequested)break;
    const dir=resolve(root,entry.id), fixture=resolve(dir,'fixture.json');
    if(!existsSync(fixture))throw Error(`초기 정본 없음: ${entry.id}. prepare 먼저 실행`);
    if(args.includes('--skip-completed')&&existsSync(resolve(dir,'result.json')))continue;
    if(existsSync(resolve(dir,'result.json')))throw Error(`기존 시도 덮어쓰기 거부: ${entry.id}. 새 --out 사용`);
    const release=lockCase(dir);
    const result={schemaVersion:1,caseId:entry.id,title:entry.title,inputMode:args.includes('--direct-pi')?'pi-command':'natural',seedDigest:digest(readFileSync(seedPath)),
      codeCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      harnessDigest,
      startedAt:new Date().toISOString(),gates:Object.fromEntries(['execution','requirements','adversarial','runtime','persistence','visual'].map(k=>[k,{status:'pending'}]))};
    const initial=JSON.parse(readFileSync(resolve(dir,'initial.json'),'utf8'));
    try {
      const timeout=Number(option('timeout-ms',seed.timeoutMs));
      if(!Number.isFinite(timeout)||timeout<=0)throw Error('양수 timeout-ms 필요');
      const submitted = args.includes('--direct-pi') ? { ...entry, prompt: `/pi ${entry.prompt}` } : entry;
      const run=await execute(submitted,dir,timeout,{});
      result.gates.execution=gate([{id:'native-pi-run',ok:run.realRun,detail:'입력창 POST와 실제 Pi done 영수증'},
        {id:'no-editor-errors',ok:!run.errors.length,detail:run.errors.join('; ')},
        {id:'no-model-errors',ok:!run.events.some(e=>e.type==='error'||e.type==='stream_error'),detail:run.events.filter(e=>['error','stream_error'].includes(e.type)).map(e=>e.message).join('; ')}]);
      if(!run.realRun && run.events.some(e=>e.type==='error'&&/auth|credential|401|403|로그인|인증|quota|rate.limit/i.test(e.message??''))) {
        result.gates.execution={status:'blocked',detail:'실제 모델 인증·서비스 오류. trace.json 참조'};
      }
      const checks=evaluate(entry,run.before,run.after,run.answer);
      if(entry.check==='graphic') checks.required.push({id:'actual-candidate-image-received',ok:run.events.some(e=>e.type==='execution_status'&&e.name==='charset.image.received'&&e.ok&&e.data?.selectionIds?.includes(`charset:${entry.textureKey}:${entry.frame===73?4:0}`)),detail:'실제 제공자 입력의 검색 결과와 후보 PNG를 포함한 모델 응답 완료 영수증'});
      result.gates.requirements=gate(checks.required);result.gates.adversarial=gate(checks.adversarial);
      result.gates.persistence=persistenceGate(run.receipt);
      result.elapsedMs=run.elapsedMs;result.models=run.requests;result.projectId=run.receipt.projectId;result.projectDir=run.receipt.projectDir;
      result.gates.visual={status:'pending',detail:'변경·재로드·필수 플레이 그림을 실제로 읽은 독립 검수 영수증 필요',evidence:run.evidence};
      try{result.gates.runtime=await verifyRuntime(entry,dir,initial);}catch(error){result.gates.runtime={status:'fail',detail:error.message};}
      // No automatic repairs: every attempt evaluates the assistant's own result.
    }catch(error){
      result.failure=error.message;
      result.failurePhase=error.harnessPhase??'host-start';
      result.gates.execution={status:['editor-start','baseline','host-start'].includes(result.failurePhase)||/번들|bridge|startup|host exited|auth|credential/i.test(error.message)?'blocked':'fail',detail:error.message};
    }
    result.finishedAt=new Date().toISOString();result.status=resultStatus(result);
    save(resolve(dir,'result.json'),result);release();report();console.log(`${entry.id}: ${result.status}`);
  }
  report();return results().filter(r=>entries.some(e=>e.id===r.caseId)).every(r=>r.status==='pass')?0:1;
}
async function runtimeSelfCheck() {
  const file=resolve(root,'self-check-runtime.json');
  const previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')).checks:[];
  const checks=previous.filter(c=>!entries.some(e=>e.id===c.caseId));
  for(const entry of entries.filter(e=>e.runtime!=='none')) {
    const initial=JSON.parse(readFileSync(resolve(root,entry.id,'initial.json'),'utf8'));
    const dir=resolve(root,'checker-runtime',entry.id);mkdirSync(dir,{recursive:true});
    writeFileSync(resolve(dir,'live.json'),JSON.stringify(knownGood(entry,initial)));
    let outcome;
    try { outcome=await verifyRuntime(entry,dir,initial); }
    catch(error){outcome={status:'fail',detail:error.message};}
    checks.push({caseId:entry.id,...outcome});console.log(`runtime checker ${entry.id}: ${outcome.status}`);
    save(file,{kind:'runtime-checker-calibration',harnessDigest,caseIds:entries.map(e=>e.id),pass:entries.filter(e=>e.runtime!=='none').every(e=>checks.some(c=>c.caseId===e.id&&c.status==='pass')),checks});
  }
  return checks.length&&checks.every(c=>c.status==='pass')?0:1;
}
async function recheckSaved() {
  if(!chosen||entries.length!==1)throw Error('recheck --case <id>는 저장된 한 시도만 검증합니다');
  const entry=entries[0],dir=resolve(root,entry.id),file=resolve(dir,'result.json');
  const release=lockCase(dir);
  try {
  const trace=JSON.parse(readFileSync(resolve(dir,'trace.json'),'utf8'));
  if(!trace.requests.some(r=>r.endpoint==='/v1/agent/run')||!trace.events.some(e=>e.type==='done'))throw Error('완료된 실제 조수 시도만 재관측할 수 있습니다');
  const previous=JSON.parse(readFileSync(file,'utf8'));
  const archive=resolve(dir,'verification-history',String(Date.now()));mkdirSync(archive,{recursive:true});
  copyFileSync(file,resolve(archive,'result.json'));
  for(const name of ['visual-review.json','persistence.json','self-check-runtime.json'])if(existsSync(resolve(dir,name)))copyFileSync(resolve(dir,name),resolve(archive,name));
  if(existsSync(resolve(dir,'runtime')))renameSync(resolve(dir,'runtime'),resolve(archive,'runtime'));
  let receipt=existsSync(resolve(dir,'persistence.json'))?JSON.parse(readFileSync(resolve(dir,'persistence.json'),'utf8')):await observeSaved(entry,dir);
  const saved=stored(resolve(dir,'project'));
  const applied=JSON.parse(readFileSync(resolve(dir,'after.json'),'utf8'));
  const comparable=structuredClone(saved.project);
  comparable.meta.bootNormalization=applied.meta.bootNormalization;
  const changedOnReload=receipt.afterSha256!==saved.sha256&&isDeepStrictEqual(comparable,applied)&&applied.meta.bootNormalization?.lib!==saved.project.meta.bootNormalization?.lib;
  if(receipt.afterSha256!==saved.sha256&&!changedOnReload)throw Error('원래 저장 결과가 바뀌었으므로 재검증 거부');
  const before=JSON.parse(readFileSync(resolve(dir,'before.json'),'utf8'));
  if(changedOnReload) {
    if(applied.meta.bootNormalization?.lib!==saved.project.meta.bootNormalization?.lib)receipt={...receipt,libraryRevisionChange:{before:applied.meta.bootNormalization?.lib,after:saved.project.meta.bootNormalization?.lib,gameContentEqual:true}};
  }
  const checks=evaluate(entry,before,applied,trace.events.filter(e=>e.type==='assistant').map(e=>e.text??'').join('\n'));
  if(entry.check==='graphic') checks.required.push({id:'actual-candidate-image-received',ok:trace.events.some(e=>e.type==='execution_status'&&e.name==='charset.image.received'&&e.ok&&e.data?.selectionIds?.includes(`charset:${entry.textureKey}:${entry.frame===73?4:0}`)),detail:'원본 실행의 실제 제공자 입력과 후보 PNG 응답 완료 영수증'});
  const result={...previous,gates:{
    execution:gate([{id:'native-pi-run',ok:true,detail:'원본 trace.json의 실제 입력과 done'},
      {id:'no-editor-errors',ok:!trace.errors.length,detail:trace.errors.join('; ')},
      {id:'no-model-errors',ok:!trace.events.some(e=>['error','stream_error'].includes(e.type)),detail:trace.events.filter(e=>['error','stream_error'].includes(e.type)).map(e=>e.message).join('; ')}]),
    requirements:gate(checks.required),adversarial:gate(checks.adversarial),
    persistence:persistenceGate(receipt),
    visual:{status:'pending',detail:'재검증 결과와 실제 그림에 묶은 시각 영수증 필요',evidence:['after.png','reloaded.png']},
  },verification:{harnessDigest,priorResultDigest:digest(readFileSync(resolve(archive,'result.json'))),archive:relative(dir,archive),at:new Date().toISOString(),newModelTurn:false},
    projectId:saved.projectId,projectDir:resolve(dir,'project')};
  delete result.failure;delete result.failurePhase;
  {
    // Test the originally captured SQLite output; changing a boot stamp on
    // reload still fails persistence and is never repaired in the project.
    writeRuntimeProject(resolve(dir,'project'),resolve(dir,'live.json'),changedOnReload?applied:undefined);
    try{result.gates.runtime=await verifyRuntime(entry,dir,JSON.parse(readFileSync(resolve(dir,'initial.json'),'utf8')));}catch(error){result.gates.runtime={status:'blocked',detail:`검증 환경: ${error.message}`};}
  }
  result.status=resultStatus(result);save(file,result);report();return result.status==='fail'?1:0;
  } finally {release();}
}
function review() {
  if(!chosen)throw Error('review --out <실행> --case <id> --status pass|fail --reviewer <검수자> --images <PNG,...> --notes <근거>');
  const dir=resolve(root,chosen),file=resolve(dir,'result.json');
  const status=option('status'),reviewer=option('reviewer'),notes=option('notes');
  if(!['pass','fail'].includes(status)||!reviewer||!notes?.trim())throw Error('검수 상태·검수자·실제 관측 근거 필요');
  const files=option('images','').split(',').filter(Boolean);
  const result=JSON.parse(readFileSync(file,'utf8'));
  if(!files.includes('after.png')||!files.includes('reloaded.png'))throw Error('변경 화면과 재로드 화면 둘 다 실제 검수해야 합니다');
  if(entries[0].runtime!=='none'&&!files.some(f=>f.startsWith('runtime/')))throw Error('이 과제는 실제 플레이 PNG 검수도 필수입니다');
  if(status==='pass'&&(result.gates.runtime.requiredVisualEvidence??[]).some(file=>!files.includes(file)))throw Error('플레이 SUMMARY에 표시된 필수 시각 QA 그림을 모두 읽고 --images에 포함하세요');
  if(entries[0].visual==='database'&&!files.includes('database.png'))throw Error('아이템 상세 화면 검수 필수');
  const images=files.map(file=>{
    const path=resolve(dir,file),rel=relative(dir,path);
    if(rel.startsWith(`..${sep}`)||rel==='..'||!file.endsWith('.png')||!existsSync(path))throw Error(`유효하지 않은 검수 그림 ${file}`);
    return{file,sha256:digest(readFileSync(path))};
  });
  save(resolve(dir,'visual-review.json'),{schemaVersion:1,status,reviewer,notes,images,resultDigest:digest(readFileSync(resolve(dir,'result.json'))),reviewedAt:new Date().toISOString()});
  report();return status==='pass'?0:1;
}
async function recapture() {
  for(const entry of entries) {
    const dir=resolve(root,entry.id);
    if(!existsSync(resolve(dir,'after.json')))continue;
    const release=lockCase(dir);
    try {
      const archive=resolve(dir,'capture-history',String(Date.now()));mkdirSync(archive,{recursive:true});
      for(const file of ['after.png','reloaded.png','database.png','visual-review.json'])if(existsSync(resolve(dir,file)))copyFileSync(resolve(dir,file),resolve(archive,file));
      const receipt=await captureSaved(entry,dir,args.includes('--refresh-after'));
      save(resolve(dir,'visual-recapture.json'),receipt);console.log(`${entry.id}: rendered context captured`);
    } finally {release();}
  }
  report();return 0;
}
let code;
if(stage==='list'){console.log(seed.cases.map(c=>`${c.id} — ${c.title} (플레이: ${c.runtime})`).join('\n'));code=0;}
else if(stage==='self-check')code=await selfCheck();
else if(stage==='self-check-runtime')code=await runtimeSelfCheck();
else if(stage==='self-check-errors')code=await (await import('./errorControls.mjs')).checkErrorUi(root,args.includes('--recheck'));
else if(stage==='recheck')code=await recheckSaved();
else if(stage==='recapture')code=await recapture();
else if(stage==='run')code=await runCases();
else if(stage==='review')code=review();
else if(stage==='report'){report();code=0;}
else if(stage==='aggregate'){report();code=0;}
else throw Error('단계: list | prepare | self-check | self-check-runtime | run | recheck | recapture | review | report | aggregate');
process.exitCode=code;
