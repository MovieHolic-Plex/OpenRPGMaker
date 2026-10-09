import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {firefox} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
import scenario from './beodeul-small-village.scenario.mjs';
const ROOT='verify-shots/beodeul-small-village/runtime';
const server=await startPlayerQaServer();let browser;
try{
 browser=await firefox.launch({headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});
 const page=await browser.newPage();
 const report=await runRuntimeQa(page,scenario,{serverUrl:server.url,outDir:ROOT});
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert(report.beats.every(b=>!b.failures.length));
 await page.evaluate(()=>{const s=window.__oprnHooksScene;const c=s.cameras.main;c.stopFollow();c.setZoom(.5);c.centerOn(s.map.width*8,s.map.height*8);});
 await page.waitForTimeout(250);
 await page.screenshot({path:`${ROOT}/overview-player.png`});
 console.log(JSON.stringify({beats:report.beats.length,allFiveDoorFrontsReached:true,runtimeErrors:report.errors,overview:'overview-player.png'}));
}finally{await browser?.close();await server.close();}
