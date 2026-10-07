import fs from 'node:fs';import assert from 'node:assert/strict';import {firefox} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
const routes=JSON.parse(fs.readFileSync('output/beodeul-facilities/routes.json','utf8'));
const scenario={id:'beodeul-facilities',projectFixture:'output/beodeul-facilities/reloaded-project.json',beats:[
 {id:'title',expect:{testidPresent:['title-screen']}},
 {id:'start',shot:true,note:'SQLite 재로드한 50×50 생활 시설 마을',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{...routes.start,playerSpriteTextureLoaded:true}},
 ...routes.stops.map(stop=>({id:stop.id,shot:true,note:`${stop.id} 문앞/잔교까지 실제 도보 이동`,ops:[{kind:'playerRoute',moves:stop.moves},{kind:'waitForPosition',...stop.to,timeoutMs:30000}],expect:{...stop.to,playerSpriteTextureLoaded:true}}))]};
const server=await startPlayerQaServer();let browser;
try{browser=await firefox.launch({headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});const page=await browser.newPage();
 const report=await runRuntimeQa(page,scenario,{serverUrl:server.url,outDir:'verify-shots/beodeul-facilities/runtime'});
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert(report.beats.every(b=>!b.failures.length));
 console.log(JSON.stringify({beats:report.beats.length,fiveFacilityFrontsAndDockReached:true,runtimeErrors:report.errors}));
}finally{await browser?.close();await server.close();}
