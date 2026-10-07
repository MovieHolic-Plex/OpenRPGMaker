import assert from 'node:assert/strict';
import {firefox} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
import scenario from './beodeul-river-town.scenario.mjs';
const server=await startPlayerQaServer();let browser;
try{
 browser=await firefox.launch({headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});
 const page=await browser.newPage();
 const report=await runRuntimeQa(page,scenario,{serverUrl:server.url,outDir:'verify-shots/beodeul-river-town/runtime'});
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert(report.beats.every(b=>!b.failures.length));
 console.log(JSON.stringify({beats:report.beats.length,threeBridgesCrossed:true,manorChurchSmithyReached:true,runtimeErrors:report.errors}));
}finally{await browser?.close();await server.close();}
