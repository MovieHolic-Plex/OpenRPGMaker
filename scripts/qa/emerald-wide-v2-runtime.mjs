import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=process.env.RPG_ZZU_QA_SOURCE_ROOT??process.cwd();
const {runRuntimeQa,startPlayerQaServer}=await import(pathToFileURL(path.join(root,'scripts/lib/runtimeQaRun.mjs')));
const out=path.resolve('output/evidence/emerald-wide-v2'),runtimeOut=path.resolve('verify-shots/runtime-qa/emerald-wide-v2');
const walks=JSON.parse(fs.readFileSync(`${out}/walks.json`,'utf8'));
process.chdir(root);
const server=await startPlayerQaServer(),browser=await chromium.launch({args:['--no-sandbox']});
try{const page=await browser.newPage();const beats=[{id:'title',expect:{testidPresent:['title-screen']}},{id:'entry',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:walks[0].mapId,x:3,y:55,playerSpriteTextureLoaded:true},shot:true}];
for(const w of walks)beats.push({id:w.id,intent:'실제 보행으로 주요 지점 연결 확인',ops:[{kind:'dir',dir:null},{kind:'playerRoute',moves:w.moves},{kind:'waitForPosition',mapId:w.mapId,x:w.to[0],y:w.to[1],timeoutMs:120000},{kind:'dir',dir:null}],expect:{mapId:w.mapId,x:w.to[0],y:w.to[1],playerSpriteTextureLoaded:true},shot:true});
const report=await runRuntimeQa(page,{id:'emerald-wide-v2',projectFixture:`${out}/runtime-project.json`,beats},{serverUrl:server.url,outDir:runtimeOut});
console.log(JSON.stringify({errors:report.errors,beats:report.beats.map(b=>({id:b.id,failures:b.failures}))}));
const selected=report.beats.filter(b=>['entry','west-stair-top','north-trail','upper-lookout','forest-loop','east-stair-foot','south-exit'].includes(b.id));
fs.writeFileSync(`${runtimeOut}/VISUAL-SUMMARY.md`,'# 실제 플레이 시각 검사\n\n전용 player.html 스크린샷. 다음 지정 샷은 실제 커스텀 팔레트와 걷는 위치를 확인하기 위한 지정 샷이다.\n\n| PNG | 확인 이유 |\n|---|---|\n'+selected.map(b=>`| ${b.shot} | 즉시 확인 — ${b.id}, 실제 지형·통행·팔레트 |`).join('\n')+'\n');
assert.deepEqual(report.errors,[]);assert.ok(report.beats.every(b=>b.failures.length===0));
}finally{await browser.close();await server.close();}
