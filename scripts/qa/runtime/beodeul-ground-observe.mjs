// Dedicated player QA after actual assistant ground dressing, preserving door opening and return.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {firefox} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
import scenario from './assistant-house-entry.scenario.mjs';
const ROOT='verify-shots/beodeul-ground';
const proof=JSON.parse(await fs.readFile('verify-shots/beodeul-door/applied/canonical-proof.json','utf8'));
const data=proof.result.data;
const server=await startPlayerQaServer();
let browser;
try {
 browser=await firefox.launch({headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});
 const page=await browser.newPage();
 await page.addInitScript(({states,door,mapId})=>{
  let current;
  let attached=false;
  window.__doorObservations=[];
  Object.defineProperty(window,'__oprnHooksScene',{configurable:true,get:()=>current,set(scene){
   current=scene;
   if(!scene||attached) return;
   attached=true;
   scene.game.events.on('postrender',()=>{
    const active=current;
    if(!active?.map||active.map.id!==mapId) return;
    const top=active.map.upperTiles[door.y*active.map.width+door.x];
    const bottom=active.map.upperTiles[(door.y+1)*active.map.width+door.x];
    const stage=states.find(s=>s.top===top&&s.bottom===bottom)?.stage;
    if(stage===undefined||window.__doorObservations.at(-1)?.stage===stage) return;
    window.__doorObservations.push({stage,frame:scene.game.loop.frame,at:performance.now(),png:scene.game.canvas.toDataURL('image/png')});
   });
  }});
 },{states:data.states,door:data.door,mapId:data.mapId});
 const outDir=`${ROOT}/runtime`;
 const report=await runRuntimeQa(page,{...scenario,id:'beodeul-ground-applied'},{serverUrl:server.url,outDir});
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));
 assert(report.beats.every(b=>b.failures.length===0),JSON.stringify(report.beats.map(b=>b.failures)));
 try { await page.waitForFunction(()=>window.__doorObservations.at(-1)?.stage===0,{},{timeout:15000}); }
 catch(error) {
  const diagnostic=await page.evaluate(()=>({observed:window.__doorObservations?.map(({png,...o})=>o),mapId:window.__oprnHooksScene?.map?.id,
    top:window.__oprnHooksScene?.map?.upperTiles?.[5*20+10],hook:!!window.__oprnHooksScene}));
  await fs.writeFile(`${ROOT}/observation-failure.json`,JSON.stringify(diagnostic,null,2));
  throw error;
 }
 const observations=await page.evaluate(()=>window.__doorObservations);
 const sequence=observations.map(o=>o.stage);
 for(const stage of [1,2,3,4,5,6,7]) assert(sequence.includes(stage),`Missing rendered stage ${stage}: ${sequence}`);
 assert.equal(sequence.at(-1),0);
 assert(sequence.lastIndexOf(6)>sequence.indexOf(7),'Return closing must render after entering');
 await fs.mkdir(`${ROOT}/frames`,{recursive:true});
 for(let i=0;i<observations.length;i++) {
  const item=observations[i];
  await fs.writeFile(`${ROOT}/frames/${String(i).padStart(2,'0')}-stage-${item.stage}.png`,Buffer.from(item.png.split(',')[1],'base64'));
 }
 const evidence={sequence,observations:observations.map(({png,...o})=>o),allEightStatesRendered:true,returnedClosed:true,runtimeErrors:report.errors};
 await fs.writeFile(`${ROOT}/rendered-stages.json`,JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));
} finally {await browser?.close();await server.close();}
