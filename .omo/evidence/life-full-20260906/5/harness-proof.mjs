import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startPlayerQaServer, runRuntimeQa } from '../../../../scripts/lib/runtimeQaRun.mjs';
const server=await startPlayerQaServer();let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
  const page=await browser.newPage();
  const report=await runRuntimeQa(page,{
    id:'life-qa-observability',projectFixture:'.omo/evidence/life-full-20260906/5/project.json',
    beats:[
      {id:'till',ops:[{kind:'key',key:'Enter'},{kind:'action',observe:true}],shot:true},
      {id:'reject',ops:[{kind:'action',observe:true}],shot:true},
    ],
  },{serverUrl:server.url,outDir:'.omo/evidence/life-full-20260906/5/runtime'});
  assert.deepEqual(report.errors,[]);for(const beat of report.beats)assert.deepEqual(beat.failures,[]);
  const [first,second]=report.beats.map(beat=>beat.state);
  assert.equal(first.energy,0);assert.equal(first.actionReceipt.sequence,1);assert.equal(first.actionReceipt.farmAttempts[0].kind,'tilled');
  assert.equal(second.actionReceipt.sequence,2);assert.equal(second.actionReceipt.handled,false);assert.equal(second.actionReceipt.farmAttempts[1].reason,'insufficient-energy');
  assert.deepEqual(second.farmPlots,first.farmPlots);
  console.log(JSON.stringify({url:server.url+'/player.html',port:server.port,config:'vite.player-qa.config.ts',browser:browser.version(),input:'actual Input.injectActionEdge via existing action op with observe:true',fixture:report.projectPath,states:[first,second],errors:report.errors}));
} finally {await browser?.close();await server.close();console.log(JSON.stringify({cleanup:'browser/page/server closed',remoteWrites:0}));}
