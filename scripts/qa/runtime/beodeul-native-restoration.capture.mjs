import assert from 'node:assert/strict';
import {firefox} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
import scenario from './beodeul-native-restoration.scenario.mjs';
const ROOT='verify-shots/beodeul-native-restoration/runtime';
const overviewOnly=process.argv.includes('--overview-only');
const server=await startPlayerQaServer();let browser;
try{
 browser=await firefox.launch({headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});
 const page=await browser.newPage();
 const report=await runRuntimeQa(page,overviewOnly?{...scenario,beats:scenario.beats.slice(0,2)}:scenario,{serverUrl:server.url,outDir:overviewOnly?`${ROOT}/overview`:ROOT});
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert(report.beats.every(b=>!b.failures.length));
 await page.evaluate(()=>{
   const s=window.__oprnHooksScene,c=s.cameras.main;
   // Fit using the camera's logical viewport; CSS scales the canvas independently.
   const zoom=Math.min(c.width/(s.map.width*16),c.height/(s.map.height*16))*.96;
   c.stopFollow();c.removeBounds();c.setZoom(zoom);c.centerOn(s.map.width*8,s.map.height*8);
 });
 await page.waitForTimeout(250);await page.screenshot({path:`${ROOT}/overview-player.png`});
 console.log(JSON.stringify({beats:report.beats.length,overviewOnly,...(overviewOnly?{}:{allSixDoorFrontsReached:true}),runtimeErrors:report.errors,overview:'overview-player.png'}));
}finally{await browser?.close();await server.close();}
