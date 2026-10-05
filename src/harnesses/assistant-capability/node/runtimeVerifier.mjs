import { firefox } from 'playwright';
import { resolve } from 'node:path';
import { writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { startPlayerQaServer, runRuntimeQa } from '../../../../scripts/lib/runtimeQaRun.mjs';
import { MAP } from './checks.mjs';

const dialogue = () => [{kind:'face',dir:'up'},{kind:'action'},{kind:'waitFor',testid:'dialogue-box',state:'present'}];
const close = () => [{kind:'pressUntil',key:'Enter',testid:'dialogue-box',state:'absent',timeoutMs:15000}];
const walk = (dir,x,y,mapId=MAP) => [{kind:'dir',dir},{kind:'waitForPosition',mapId,x,y,timeoutMs:10000},{kind:'dir',dir:null}];
// Map coordinates appear before the transfer interpreter releases input.
// Observe readiness before sending a new real action; never alter runtime state.
const ready = () => [{kind:'waitForText',testid:'runtime-state-json',text:'"inputEnabled":true',timeoutMs:10000},
  {kind:'waitForText',testid:'runtime-state-json',text:'"running":false',timeoutMs:10000}];
const beat = (id,ops,expect={},typed=true) => ({id,ops:[...ops,
  ...Object.entries(expect.visibleText??{}).map(([testid,text])=>({kind:'waitForText',testid,text,timeoutMs:10000})),
  // textContent includes characters whose reveal alpha is still zero. The real
  // page cursor becomes visible only after the message has finished typing.
  ...(typed&&expect.visibleText?.['dialogue-box']&&!expect.testidPresent?.includes('runtime-choice-0')?
    [{kind:'waitForVisible',testid:'dialogue-box',descendant:'.dialogue-page-cursor',timeoutMs:10000}]:[]),
],expect,shot:true});
export function markVisualTargets(entry,out,report) {
  const ids={line:['first-message','repeat-message'],move:['first-message','repeat-message'],
    delete:['walk-through-deleted-npc'],inn:['price-dialogue','offer','decline','accept'],
    choice:['question','choices','east-branch','inn-branch','cancel'],reward:['first-message','repeat-message','after-reentry']};
  const targets=report.beats.filter(b=>b.shot&&(ids[entry.runtime]??[]).includes(b.id)).map(b=>b.shot);
  if(targets.length)appendFileSync(resolve(out,'SUMMARY.md'),'\n## 수행 하네스 필수 시각 QA\n\n비트 통과와 별도로 실제 화면을 읽어 판정한다.\n\n'+targets.map(file=>`- 즉시 확인: ${file} — 요청한 대사·선택·금액·취소 결과 또는 대상 보존`).join('\n')+'\n');
  return targets.map(file=>`runtime/${file}`);
}
export function scenarioFor(entry, projectFile, initial) {
  const position={mapId:MAP,...initial.startPos};
  const beats=[beat('title',[],{testidPresent:['title-screen']}),
    beat('start',[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],{...position,gold:100,testidAbsent:['dialogue-box','title-screen']})];
  if(['line','move'].includes(entry.runtime)) {
    const line=entry.runtime==='line'?'동문에서 만나자.':'숲의 약초꾼 세라 누나가 반짝이는 풀';
    beats.push(beat('first-line',dialogue(),{...position,visibleText:{'dialogue-box':line}}),
      beat('close',close(),{...position,testidAbsent:['dialogue-box']}),
      beat('repeat',dialogue(),{...position,visibleText:{'dialogue-box':line}}),
      beat('repeat-close',close(),{testidAbsent:['dialogue-box']}));
  } else if(entry.runtime==='delete') {
    beats.push(beat('deleted-position',[{kind:'face',dir:'up'},{kind:'action'}],{...position,testidAbsent:['dialogue-box']}));
    beats.push(beat('walk-through-deleted-npc',walk('up',8,7),{mapId:MAP,x:8,y:7}));
  } else if(entry.runtime==='inn') {
    beats.push(beat('price-dialogue',dialogue(),{visibleText:{'dialogue-box':'25G'}}),
      beat('offer',[{kind:'pressUntil',key:'Enter',testid:'inn-scene',state:'present',timeoutMs:15000}],{testidPresent:['inn-scene'],visibleText:{'inn-scene':'25'}}),
      beat('decline',[{kind:'key',key:'Escape'},{kind:'waitFor',testid:'inn-scene',state:'absent'}],{gold:100,testidAbsent:['dialogue-box','inn-scene']}),
      beat('offer-again',[...dialogue(),{kind:'pressUntil',key:'Enter',testid:'inn-scene',state:'present',timeoutMs:15000}],{gold:100,testidPresent:['inn-scene']}),
      beat('accept',[{kind:'key',key:'Enter'},{kind:'waitFor',testid:'inn-wake',state:'present'},{kind:'key',key:'Enter'},{kind:'waitFor',testid:'inn-scene',state:'absent'}],{gold:75,testidAbsent:['dialogue-box','inn-scene']}));
  } else if(entry.runtime==='choice') {
    const open=[{kind:'face',dir:'up'},{kind:'action'},{kind:'pressUntil',key:'Enter',testid:'runtime-choice-0',state:'present',timeoutMs:15000}];
    beats.push(beat('question',dialogue(),{visibleText:{'dialogue-box':'어디로 갈까?'}},false),
      beat('choices',[{kind:'pressUntil',key:'Enter',testid:'runtime-choice-0',state:'present',timeoutMs:15000}],{testidPresent:['runtime-choice-0','runtime-choice-1'],visibleText:{'runtime-choice-0':'동문','runtime-choice-1':'여관'}}),
      beat('east-branch',[{kind:'key',key:'Enter'},{kind:'waitFor',testid:'dialogue-box',state:'present'}],{visibleText:{'dialogue-box':'동문에서 만나자.'},gold:100}),
      beat('east-close',close(),{testidAbsent:['dialogue-box']}),
      beat('reopen',open,{testidPresent:['runtime-choice-0','runtime-choice-1']}),
      beat('inn-branch',[{kind:'key',key:'ArrowDown'},{kind:'key',key:'Enter'},{kind:'waitFor',testid:'dialogue-box',state:'present'}],{visibleText:{'dialogue-box':'여관에서 쉬자.'},gold:100}),
      beat('inn-close',close(),{testidAbsent:['dialogue-box']}),
      beat('reopen-cancel',open,{testidPresent:['runtime-choice-0']}),
      beat('cancel',[{kind:'key',key:'Escape'},{kind:'waitFor',testid:'runtime-choice-0',state:'absent',timeoutMs:10000},{kind:'waitFor',testid:'dialogue-box',state:'absent',timeoutMs:10000}],{gold:100,testidAbsent:['runtime-choice-0','dialogue-box']}));
  } else if(entry.runtime==='reward') {
    beats.push(beat('first-message',dialogue(),{visibleText:{'dialogue-box':'처음 선물이야.'}}),
      beat('first-reward',close(),{gold:125,testidAbsent:['dialogue-box']}),
      beat('repeat-message',dialogue(),{visibleText:{'dialogue-box':'이미 선물을 줬어.'}}),
      beat('repeat-no-reward',close(),{gold:125,testidAbsent:['dialogue-box']}),
      beat('walk-to-exit',walk('left',2,8),{gold:125}),
      beat('leave-map',[{kind:'action'},{kind:'waitForPosition',mapId:'map_capability_return',x:2,y:8}],{mapId:'map_capability_return',gold:125}),
      beat('return-map',[...ready(),{kind:'action'},{kind:'waitForPosition',mapId:MAP,x:2,y:8}],{mapId:MAP,gold:125}),
      beat('walk-back',[...ready(),...walk('right',8,8)],{gold:125}),
      beat('after-reentry',dialogue(),{visibleText:{'dialogue-box':'이미 선물을 줬어.'}}),
      beat('after-reentry-no-reward',close(),{gold:125,testidAbsent:['dialogue-box']}));
  }
  return {id:`assistant-capability-${entry.id}`,projectFixture:projectFile,beats};
}
export async function verifyRuntime(entry, dir, initial) {
  if(entry.runtime==='none')return{status:'not-required',evidence:[]};
  const out=resolve(dir,'runtime'), projectFile=resolve(dir,'player.json');
  // Use the production export projection, including its committed-event rule.
  // Reference libraries belong to the editor and can exhaust a player renderer.
  execFileSync(process.execPath,[resolve('node_modules/vite-node/vite-node.mjs'),
    '--config','vite.config.ts','src/harnesses/assistant-capability/node/runtimeProjection.ts',
    '--',resolve(dir,'live.json'),projectFile],{stdio:'pipe',maxBuffer:1024*1024});
  const scenario=scenarioFor(entry,projectFile,initial);
  writeFileSync(resolve(dir,'runtime-scenario.json'),JSON.stringify(scenario,null,2));
  const server=await startPlayerQaServer({logLevel:'silent'});let browser;
  try {
    browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
    const page=await browser.newPage();
    const assets=new Map(JSON.parse(readFileSync(`${projectFile}.assets.json`,'utf8')).map(asset=>[`/${asset.zipPath}`,asset]));
    await page.route('**/assets/uploaded/**',route=>{
      const asset=assets.get(decodeURIComponent(new URL(route.request().url()).pathname));
      return asset?route.fulfill({path:asset.file,contentType:asset.mime}):route.fulfill({status:404,body:'Saved export dependency missing'});
    });
    const report=await runRuntimeQa(page,scenario,{serverUrl:server.url,outDir:out});
    const requiredVisualEvidence=markVisualTargets(entry,out,report);
    // Follow the repository QA contract: SUMMARY first, only then relevant PNGs.
    console.log(readFileSync(resolve(out,'SUMMARY.md'),'utf8').slice(0,2000));
    const failed=report.beats.filter(b=>b.failures.length);
    return {status:failed.length||report.errors.length?'fail':'pass',
      checks:report.beats.map(b=>({id:b.id,ok:b.failures.length===0,detail:b.failures.join('; ')})),
      errors:report.errors,requiredVisualEvidence,evidence:report.beats.filter(b=>b.shot).map(b=>`runtime/${b.shot}`)};
  } finally {await browser?.close();await server.close();}
}
