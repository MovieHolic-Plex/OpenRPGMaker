// 버들항 웨이브 장소(되살림) — scripts/content/beodeul-wave-places/sample-project.mts 가 SQLite 에 저장·재로드한 프로젝트를
// 전용 플레이어(player.html, 출하 shim 경로)로 띄워 장소마다 입구에서 볼거리를 지나 걷는 1배속 영상과 끝 장면을 남긴다.
//   node scripts/qa/runtime/beodeul-wave-places.capture.mjs [mapId...]   (네트워크 격리 안에서: unshare -rn)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
const ROOT='verify-shots/beodeul-wave-places/runtime';
const routes=JSON.parse(fs.readFileSync('output/wave-places/routes.json','utf8'));
const only=process.argv.slice(2);
const server=await startPlayerQaServer();let browser;const out={};
try{
 browser=await chromium.launch({headless:true,args:['--disable-background-networking','--disable-features=NetworkChangeNotifier']});
 for(const [mapId,r] of Object.entries(routes)){
  if(only.length&&!only.includes(mapId))continue;
  const dir=`${ROOT}/${mapId}`;fs.mkdirSync(dir,{recursive:true});
  const ctx=await browser.newContext({viewport:{width:960,height:720},recordVideo:{dir,size:{width:960,height:720}}});
  const page=await ctx.newPage();
  const scenario={id:`wave-${mapId}`,projectFixture:`output/wave-places/${mapId}.project.json`,
   beats:[{id:'title',expect:{testidPresent:['title-screen']}},
    {id:'start',shot:true,note:`${mapId} 입구`,ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{playerSpriteTextureLoaded:true}},
    {id:'walk',shot:true,note:'입구 → 볼거리 → 끝',ops:[{kind:'playerRoute',moves:r.moves.map(dir=>({kind:'move',dir}))},{kind:'waitForPosition',mapId,x:r.end[0],y:r.end[1],timeoutMs:120000}]}]};
  const report=await runRuntimeQa(page,scenario,{serverUrl:server.url,outDir:dir});
  await page.waitForTimeout(1200);
  const video=page.video();await ctx.close();
  const vp=video?await video.path():null;
  out[mapId]={video:vp,beats:report.beats.map(b=>({id:b.id,failures:b.failures})),errors:report.errors};
  console.log(JSON.stringify({mapId,...out[mapId]}));
 }
 fs.writeFileSync(`${ROOT}/report.json`,JSON.stringify(out,null,1));
 for(const v of Object.values(out))assert.equal(v.errors.length,0,JSON.stringify(v.errors));
}finally{await browser?.close();await server.close();}
