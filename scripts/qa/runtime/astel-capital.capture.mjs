// 왕도 아스텔 조각 견본 맵(scripts/content/beodeul-capital/sample-map.mts 가 SQLite 에 저장·재로드한 프로젝트)을 전용 플레이어(player.html)로 띄워
// 시작 화면과 카메라 1배(맵 1px = 캔버스 1px) 구역 사진을 남긴다. 성문루 통로를 걸어 기둥 깊이(foot-dy)도 찍는다.
//   node scripts/qa/runtime/astel-capital.capture.mjs
import assert from 'node:assert/strict';
import {firefox} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
const ROOT='verify-shots/astel-capital/runtime';
const scenario={id:'astel-capital',projectFixture:'output/astel-capital/reloaded-project.json',
 beats:[{id:'title',expect:{testidPresent:['title-screen']}},
  {id:'start',shot:true,note:'SQLite 재로드한 왕도 아스텔 조각 견본 맵 시작',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{playerSpriteTextureLoaded:true}},
  {id:'to-gate',shot:true,note:'성문루 통로로 걸어 들어감(기둥 깊이)',ops:[{kind:'playerRoute',moves:['up','up','up','left','left','up','up','up','up','up','up','up'].map(dir=>({kind:'move',dir}))},{kind:'waitForPosition',mapId:'astel_capital_sample',x:10,y:8,timeoutMs:30000}]}]};
const server=await startPlayerQaServer();let browser;
try{
 browser=await firefox.launch({headless:true,firefoxUserPrefs:{'webgl.force-enabled':true}});
 const page=await browser.newPage();
 const report=await runRuntimeQa(page,scenario,{serverUrl:server.url,outDir:ROOT});
 const info=await page.evaluate(()=>{const s=window.__oprnHooksScene,c=s.cameras.main,cv=s.game.canvas;return {cam:[c.width,c.height,c.zoom],canvas:[cv.width,cv.height],css:[cv.clientWidth,cv.clientHeight],map:[s.map.width,s.map.height]};});
 console.log(JSON.stringify(info));
 // 1배: 카메라 확대 1 · 캔버스 화소 그대로 잘라 저장(브라우저 확대 없이)
 const shots=[['overview-fit',null],['north-wall',[17*16,6*16]],['plaza',[11*16,15*16]],['canal',[23*16,15*16]],['south-wall',[18*16,23*16]]];
 for(const [name,at] of shots){
  await page.evaluate((at)=>{const s=window.__oprnHooksScene,c=s.cameras.main;c.stopFollow();c.removeBounds();
    if(at){c.setZoom(1);c.centerOn(at[0],at[1]);}else{const z=Math.min(c.width/(s.map.width*16),c.height/(s.map.height*16));c.setZoom(z);c.centerOn(s.map.width*8,s.map.height*8);}},at);
  await page.waitForTimeout(400);
  const dataUrl=await page.evaluate(()=>new Promise(r=>{const s=window.__oprnHooksScene;s.game.renderer.snapshot(img=>r(img.src));}));
  const fs=await import('node:fs');fs.writeFileSync(`${ROOT}/${name}-1x.png`,Buffer.from(dataUrl.split(',')[1],'base64'));
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));
 console.log(JSON.stringify({beats:report.beats.map(b=>({id:b.id,failures:b.failures})),runtimeErrors:report.errors}));
}finally{await browser?.close();await server.close();}
